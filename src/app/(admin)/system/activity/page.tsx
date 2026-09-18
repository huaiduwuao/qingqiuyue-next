'use client';

import React, { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import AddIcon from '@mui/icons-material/Add';
import type { GridColDef } from '@mui/x-data-grid';
import { DataGridTable } from '@/components/tables/DataGridTable';
import {
  listActivities,
  saveActivity,
  listSubmissions,
  judgeSubmission,
  type AdminActivity,
  type AdminSubmission,
} from '@/apis/admin-activity';

/**
 * 创作者活动:新建、编辑、发布活动(发布时通知开启了活动提醒的用户),投稿截止后评审入围与获奖
 * (获奖会通知作者)。活动状态由四个时间点推导,前台列表按真实报名、投稿和点赞数据展示。
 *
 * 活动列表统一走 DataGridTable;「投稿与评审」Dialog 内的表单仍保留原 TableRow 结构
 * (每行需要编辑控件,不适合无状态行组件)。
 */

const CATEGORY_LABEL: Record<AdminActivity['category'], string> = {
  official: '官方',
  topic: '话题',
  challenge: '挑战',
  brand: '品牌',
  support: '扶持',
};
const STATUS_LABEL: Record<string, string> = {
  upcoming: '即将开始',
  signup: '报名中',
  active: '投稿中',
  judging: '评审中',
  ended: '已结束',
};
const RESULT_LABEL: Record<AdminSubmission['result'], string> = { '': '未评审', shortlist: '入围', won: '获奖', lost: '未获奖' };

const toLocal = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocal = (local: string) => (local ? new Date(local).toISOString() : '');
const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

const blankActivity = (): AdminActivity => {
  const day = 86_400_000;
  const now = Date.now();
  return {
    title: '', subtitle: '', desc: '', category: 'official', gradient: 'linear-gradient(135deg,#FE2C55 0%,#FFB400 100%)',
    organizer: '', rules: [], requirements: [], prizes: [], totalReward: '', totalRewardValue: 0,
    signupAt: new Date(now).toISOString(), startAt: new Date(now + 3 * day).toISOString(),
    endAt: new Date(now + 17 * day).toISOString(), resultAt: new Date(now + 24 * day).toISOString(), published: false,
  };
};

export default function SystemActivityPage() {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<{ text: string; severity: 'success' | 'error' } | null>(null);
  const [edit, setEdit] = useState<AdminActivity | null>(null);
  const [prizeText, setPrizeText] = useState('');
  const [judging, setJudging] = useState<AdminActivity | null>(null);

  // 后端 admin activity 接口(2026-09)不分页,前端在 DataGridTable 内做切片。
  const activitiesAll = React.useRef<AdminActivity[]>([]);
  const fetchActivities = useCallback(async (params: { pageNumber: number; pageSize: number }) => {
    activitiesAll.current = await listActivities();
    const totalRow = activitiesAll.current.length;
    const start = (params.pageNumber - 1) * params.pageSize;
    return { records: activitiesAll.current.slice(start, start + params.pageSize), totalRow };
  }, []);

  const columns: GridColDef[] = [
    { field: 'title', headerName: '活动', flex: 1.5, minWidth: 200 },
    { field: 'category', headerName: '分类', width: 90, valueFormatter: (v) => CATEGORY_LABEL[v as AdminActivity['category']] },
    { field: 'status', headerName: '阶段', width: 100, valueFormatter: (v) => STATUS_LABEL[v as string ?? ''] ?? '-' },
    { field: 'endAt', headerName: '投稿截止', width: 170,
      valueFormatter: (v) => v ? new Date(v as string).toLocaleString('zh-CN', { hour12: false }) : '-' },
    { field: 'signupCount', headerName: '报名', type: 'number', width: 80, align: 'right', headerAlign: 'right',
      valueGetter: (_, row) => (row as AdminActivity).signupCount ?? 0 },
    { field: 'submissionCount', headerName: '投稿', type: 'number', width: 80, align: 'right', headerAlign: 'right',
      valueGetter: (_, row) => (row as AdminActivity).submissionCount ?? 0 },
    { field: 'published', headerName: '发布', width: 90,
      renderCell: (p) => <Chip size="small" label={p.value ? '已发布' : '草稿'} color={p.value ? 'success' : 'default'} /> },
  ];

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      setMsg({ text: ok, severity: 'success' });
      qc.invalidateQueries({ queryKey: ['admin-activity'] });
      return true;
    } catch (err: any) {
      setMsg({ text: err?.message || '操作失败', severity: 'error' });
      return false;
    }
  };

  const openEdit = (a: AdminActivity) => {
    setEdit({ ...a });
    setPrizeText((a.prizes ?? []).map((p) => `${p.rank}|${p.count}|${p.reward}`).join('\n'));
  };

  const submitEdit = async () => {
    if (!edit) return;
    const prizes = lines(prizeText).map((l, i) => {
      const [rank, count, reward] = l.split('|').map((x) => x.trim());
      return { rank: rank || `奖项${i + 1}`, count: Number(count) || 1, reward: reward || '', color: ['#FE2C55', '#FFB400', '#25F4EE', '#8B5CF6'][i % 4] };
    });
    if (await run(() => saveActivity({ ...edit, prizes }), '已保存')) setEdit(null);
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 } }}>
      <Typography variant="h5" sx={{ mb: 2 }}>创作者活动</Typography>
      <DataGridTable
        title="活动"
        columns={columns}
        fetchData={fetchActivities}
        onEdit={(row) => openEdit(row as AdminActivity)}
        toolBarRender={() => (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openEdit(blankActivity())}>
            新建活动
          </Button>
        )}
        customActions={[{
          label: '投稿与评审',
          color: 'primary',
          onClick: (row) => setJudging(row as AdminActivity),
        }]}
      />

      {/* 活动编辑 */}
      <Dialog open={!!edit} onClose={() => setEdit(null)} maxWidth="md" fullWidth>
        <DialogTitle>{edit?.id ? '编辑活动' : '新建活动'}</DialogTitle>
        {edit && (
          <DialogContent>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, pt: 1 }}>
              <TextField label="标题" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
              <TextField label="副标题" value={edit.subtitle} onChange={(e) => setEdit({ ...edit, subtitle: e.target.value })} />
              <TextField label="活动介绍" value={edit.desc} onChange={(e) => setEdit({ ...edit, desc: e.target.value })} multiline minRows={3} sx={{ gridColumn: '1 / -1' }} />
              <TextField select label="分类" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value as AdminActivity['category'] })}>
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
              </TextField>
              <TextField label="主办方" value={edit.organizer} onChange={(e) => setEdit({ ...edit, organizer: e.target.value })} />
              <TextField label="报名开始" type="datetime-local" value={toLocal(edit.signupAt)} onChange={(e) => setEdit({ ...edit, signupAt: fromLocal(e.target.value) })} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField label="投稿开始" type="datetime-local" value={toLocal(edit.startAt)} onChange={(e) => setEdit({ ...edit, startAt: fromLocal(e.target.value) })} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField label="投稿截止" type="datetime-local" value={toLocal(edit.endAt)} onChange={(e) => setEdit({ ...edit, endAt: fromLocal(e.target.value) })} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField label="公布结果" type="datetime-local" value={toLocal(edit.resultAt)} onChange={(e) => setEdit({ ...edit, resultAt: fromLocal(e.target.value) })} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField label="活动规则(每行一条)" value={edit.rules.join('\n')} onChange={(e) => setEdit({ ...edit, rules: lines(e.target.value) })} multiline minRows={3} />
              <TextField label="投稿要求(每行一条)" value={edit.requirements.join('\n')} onChange={(e) => setEdit({ ...edit, requirements: lines(e.target.value) })} multiline minRows={3} />
              <TextField
                label="奖项(每行:名次|名额|奖励)"
                value={prizeText}
                onChange={(e) => setPrizeText(e.target.value)}
                multiline
                minRows={3}
                placeholder={'冠军|1|¥5,000\n亚军|3|¥2,000'}
                helperText="奖励只做展示,获奖名单在「投稿与评审」里确定"
              />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField label="奖金总额(展示)" value={edit.totalReward} onChange={(e) => setEdit({ ...edit, totalReward: e.target.value })} placeholder="¥10,000" />
                <TextField label="奖金总额(元,用于统计)" type="number" value={edit.totalRewardValue} onChange={(e) => setEdit({ ...edit, totalRewardValue: Number(e.target.value) || 0 })} />
              </Box>
              <TextField label="卡片背景 CSS" value={edit.gradient} onChange={(e) => setEdit({ ...edit, gradient: e.target.value })} />
              <FormControlLabel
                control={<Switch checked={edit.published} onChange={(e) => setEdit({ ...edit, published: e.target.checked })} />}
                label="发布(首次发布会通知开启活动提醒的用户)"
              />
            </Box>
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setEdit(null)}>取消</Button>
          <Button variant="contained" onClick={submitEdit}>保存</Button>
        </DialogActions>
      </Dialog>

      {/* 投稿与评审 */}
      <Dialog open={!!judging} onClose={() => setJudging(null)} maxWidth="lg" fullWidth>
        <DialogTitle>投稿与评审 · {judging?.title}</DialogTitle>
        <DialogContent>
          {judging && Date.now() < new Date(judging.endAt).getTime() && (
            <Alert severity="info" sx={{ mb: 2 }}>投稿截止后才能评审;现在可以先查看投稿。</Alert>
          )}
          <JudgingTable judgingId={judging?.id} onSave={(sub, body) => run(() => judgeSubmission(sub.id, body), '已保存评审结果')} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJudging(null)}>关闭</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!msg} autoHideDuration={3000} onClose={() => setMsg(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={msg?.severity ?? 'success'} sx={{ width: '100%' }}>{msg?.text}</Alert>
      </Snackbar>
    </Box>
  );
}

/** 投稿与评审:每行有 TextField 编辑控件,保留原 TableRow 形式。 */
function JudgingTable({
  judgingId,
  onSave,
}: {
  judgingId?: number;
  onSave: (sub: AdminSubmission, body: { result: AdminSubmission['result']; prizeRank: string; reward: string }) => void;
}) {
  const { useQuery } = require('@tanstack/react-query') as typeof import('@tanstack/react-query');
  const subsQ = useQuery({
    queryKey: ['admin-activity', 'subs', judgingId],
    queryFn: () => judgingId ? listSubmissions(judgingId) : Promise.resolve([]),
    enabled: !!judgingId,
  });
  if (!judgingId) return null;
  const list = subsQ.data ?? [];
  return (
    <Box component="table" sx={{ width: '100%', fontSize: 12.5, '& td, & th': { py: 1, px: 1.5 } }}>
      <thead>
        <tr>
          <th align="left">作品</th>
          <th align="left">作者</th>
          <th align="right">播放</th>
          <th align="right">点赞</th>
          <th align="left">附言</th>
          <th align="left">结果</th>
          <th align="left">奖项</th>
          <th align="left">奖励</th>
          <th align="left" />
        </tr>
      </thead>
      <tbody>
        {list.map((s) => <JudgeRow key={s.id} sub={s} onSave={(body) => onSave(s, body)} />)}
        {list.length === 0 && (
          <tr><td colSpan={9} style={{ color: 'rgba(0,0,0,0.5)', textAlign: 'center' }}>还没有投稿</td></tr>
        )}
      </tbody>
    </Box>
  );
}

function JudgeRow({ sub, onSave }: { sub: AdminSubmission; onSave: (body: { result: AdminSubmission['result']; prizeRank: string; reward: string }) => void }) {
  const [result, setResult] = useState(sub.result);
  const [prizeRank, setPrizeRank] = useState(sub.prizeRank);
  const [reward, setReward] = useState(sub.reward);
  return (
    <tr>
      <td>{sub.workTitle || `#${sub.contentId}`}</td>
      <td>{sub.userName || sub.userId}</td>
      <td align="right">{sub.views}</td>
      <td align="right">{sub.likes}</td>
      <td style={{ maxWidth: 200 }}>{sub.caption || '-'}</td>
      <td>
        <TextField select size="small" value={result} onChange={(e) => setResult(e.target.value as AdminSubmission['result'])} sx={{ minWidth: 100 }}>
          {Object.entries(RESULT_LABEL).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
        </TextField>
      </td>
      <td>
        <TextField size="small" value={prizeRank} disabled={result !== 'won'} onChange={(e) => setPrizeRank(e.target.value)} placeholder="冠军" sx={{ width: 100 }} />
      </td>
      <td>
        <TextField size="small" value={reward} disabled={result !== 'won'} onChange={(e) => setReward(e.target.value)} placeholder="¥5,000" sx={{ width: 110 }} />
      </td>
      <td>
        <Button size="small" onClick={() => onSave({ result, prizeRank, reward })}>保存</Button>
      </td>
    </tr>
  );
}
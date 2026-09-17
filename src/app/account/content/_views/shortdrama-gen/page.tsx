'use client';

/**
 * AI 短剧生成 —— 入口:项目列表 + 新建;选中项目进入工作台(Workbench)。
 *
 * 七个数字员工(编剧 / 角色美术 / 分镜 / 视觉生成 / 节奏 / 质检 / 反馈优化)住在 Agent 平台
 * (internal/agentmanager/shortdrama),这里只是它们的工作台前端。
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import { dramaAPI, type Project } from '@/apis/shortdrama';
import { ListLayout, ListLayoutSwitch } from '@/components/common/ListLayout';
import { MediaThumb } from './common';
import { qk, useAgents, useCapabilities, useCurrentProjectId } from './useProject';
import Workbench from './Workbench';

const GENRES = ['都市情感', '甜宠', '悬疑', '古装', '逆袭爽剧', '奇幻', '职场', '校园', '家庭伦理', '科幻'];
const STYLES = ['写实电影感', '国风水墨', '日系动漫', '3D 动画', '赛博朋克', '复古胶片', '高饱和漫画'];
const STAGE_LABEL: Record<string, string> = {
  intent: '待开工', script: '剧本', visual: '视觉设定', storyboard: '分镜', pacing: '节奏', render: '出图', qc: '质检',
};

export default function ShortdramaGenPage() {
  const [pid, setPid] = useCurrentProjectId();
  if (pid > 0) {
    return <Workbench projectId={pid} onExit={() => setPid(0)} />;
  }
  return <ProjectList onOpen={setPid} />;
}

function ProjectList({ onOpen }: { onOpen: (id: number) => void }) {
  const qc = useQueryClient();
  const projects = useQuery({ queryKey: qk.projects, queryFn: dramaAPI.listProjects });
  const caps = useCapabilities();
  const agents = useAgents();
  const [creating, setCreating] = useState(false);

  const capsData = caps.data?.capabilities;
  const llmReady = caps.data?.llm_ready ?? agents.data?.llm_ready;

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3, alignItems: { sm: 'center' } }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" gutterBottom>
            AI 短剧生成
          </Typography>
          <Typography variant="body2" color="text.secondary">
            一句话故事意图 → 编剧、角色美术、分镜、节奏、视觉生成、质检、反馈优化七位数字员工接力,产出可编辑的剧本、角色设定、分镜与画面。
          </Typography>
        </Box>
        <ListLayoutSwitch sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }} />
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setCreating(true)}>
          新建短剧
        </Button>
      </Stack>

      {caps.data && llmReady === false && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Agent 平台还没有配置默认 LLM 供应商,数字员工无法工作。请管理员在「系统 → Agent 平台 → 模型供应商」里配置。
        </Alert>
      )}
      {capsData && !capsData.t2i.available && !capsData.i2i.available && (
        <Alert severity="info" sx={{ mb: 2 }}>
          当前没有启用的 ComfyUI 出图工作流:剧本、角色设定、分镜、节奏、质检都能正常进行,出图/出片环节会跳过。管理员可在项目「设置」里导入并启用模板。
        </Alert>
      )}

      {projects.isLoading ? (
        <ListLayout rows minColumnWidth={340} gap={16}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={220} />
          ))}
        </ListLayout>
      ) : projects.isError ? (
        <Alert severity="error">{(projects.error as Error).message}</Alert>
      ) : (projects.data?.length ?? 0) === 0 ? (
        <Card variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <AutoAwesomeRoundedIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
          <Typography variant="h6" gutterBottom>
            还没有短剧项目
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            写下一句故事意图,比如「外卖员意外捡到一部能预知未来 10 分钟的手机」,数字员工会把它变成剧本、角色和分镜。
          </Typography>
          <Button variant="contained" onClick={() => setCreating(true)}>
            开始第一部
          </Button>
        </Card>
      ) : (
        <ListLayout rows minColumnWidth={340} gap={16}>
          {projects.data!.map((p) => (
            <ProjectCard key={p.id} project={p} onOpen={() => onOpen(p.id)} />
          ))}
        </ListLayout>
      )}

      <CreateProjectDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(p) => {
          qc.invalidateQueries({ queryKey: qk.projects });
          setCreating(false);
          onOpen(p.id);
        }}
      />
    </Container>
  );
}

function ProjectCard({ project: p, onOpen }: { project: Project; onOpen: () => void }) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardActionArea onClick={onOpen} sx={{ height: '100%', alignItems: 'stretch' }}>
        <Box sx={{ display: 'flex', gap: 1.5, p: 1.5 }}>
          <MediaThumb src={p.cover_url} height={120} ratio={p.aspect === '16:9' ? '16 / 9' : '9 / 16'} />
          <CardContent sx={{ p: 0, flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 600 }} variant="subtitle1" noWrap>
              {p.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', mb: 1 }}>
              {p.logline || p.intent}
            </Typography>
            <Stack sx={{ flexWrap: 'wrap' }} direction="row" spacing={0.5} useFlexGap>
              <Chip size="small" label={STAGE_LABEL[p.stage] ?? p.stage} color={p.status === 'done' ? 'success' : 'default'} />
              {p.genre && <Chip size="small" variant="outlined" label={p.genre} />}
              <Chip size="small" variant="outlined" label={`${p.episodes} 集 · ${p.ep_seconds}s`} />
            </Stack>
          </CardContent>
        </Box>
      </CardActionArea>
    </Card>
  );
}

function CreateProjectDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (p: Project) => void }) {
  const [form, setForm] = useState<Partial<Project>>({ intent: '', genre: '都市情感', style: '写实电影感', episodes: 3, ep_seconds: 60, aspect: '9:16' });
  const [autostart, setAutostart] = useState(true);
  const [err, setErr] = useState('');
  const m = useMutation({
    mutationFn: () => dramaAPI.createProject(form, autostart ? 'pipeline' : undefined),
    onSuccess: (res) => onCreated(res.project),
    onError: (e: Error) => setErr(e.message),
  });
  const set = (k: keyof Project, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>新建短剧</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {err && <Alert severity="error">{err}</Alert>}
          <TextField
            label="故事意图"
            placeholder="用一两句话说清楚你想讲什么故事、给谁看、什么感觉"
            multiline
            minRows={3}
            value={form.intent}
            onChange={(e) => set('intent', e.target.value)}
            autoFocus
          />
          <TextField label="标题(可留空,编剧会起)" value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl fullWidth>
              <InputLabel>题材</InputLabel>
              <Select label="题材" value={form.genre} onChange={(e) => set('genre', e.target.value)}>
                {GENRES.map((g) => (
                  <MenuItem key={g} value={g}>
                    {g}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>视觉风格</InputLabel>
              <Select label="视觉风格" value={form.style} onChange={(e) => set('style', e.target.value)}>
                {STYLES.map((g) => (
                  <MenuItem key={g} value={g}>
                    {g}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="集数" type="number" fullWidth value={form.episodes} onChange={(e) => set('episodes', Math.max(1, Math.min(30, Number(e.target.value) || 1)))} />
            <TextField label="每集秒数" type="number" fullWidth value={form.ep_seconds} onChange={(e) => set('ep_seconds', Math.max(15, Math.min(600, Number(e.target.value) || 60)))} />
            <FormControl fullWidth>
              <InputLabel>画幅</InputLabel>
              <Select label="画幅" value={form.aspect} onChange={(e) => set('aspect', e.target.value)}>
                <MenuItem value="9:16">竖屏 9:16</MenuItem>
                <MenuItem value="16:9">横屏 16:9</MenuItem>
                <MenuItem value="1:1">方形 1:1</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <FormControlLabel
            control={<Switch checked={autostart} onChange={(e) => setAutostart(e.target.checked)} />}
            label="创建后立即一键生成(剧本 → 视觉设定 → 每集分镜 / 节奏 / 出图 / 质检)"
          />
          <Typography variant="caption" color="text.secondary">
            出图/出片会按 gen-api 的工作流扣钻或会员额度;没有启用出图工作流时自动跳过,不会扣费。也可以先只建项目,在工作台里逐步推进。
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" disabled={!form.intent?.trim() || m.isPending} onClick={() => m.mutate()}>
          {autostart ? '创建并开始生成' : '创建'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

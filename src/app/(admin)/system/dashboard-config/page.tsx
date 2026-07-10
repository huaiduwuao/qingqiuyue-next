'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Skeleton from '@mui/material/Skeleton';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  cmsActivity, cmsGift, cmsHotTopic, cmsReviewer,
  cmsBounty, cmsCategory, cmsRanker, cmsVip,
} from '@/apis/dashboard';

// tab 定义
const TABS = [
  { key: 'activity', label: '活动' },
  { key: 'gift', label: '礼物' },
  { key: 'hot-topic', label: '热点' },
  { key: 'reviewer', label: '审核员' },
  { key: 'bounty', label: '悬赏' },
  { key: 'category', label: '悬赏分类' },
  { key: 'ranker', label: '达人榜' },
  { key: 'vip', label: 'VIP 配置' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

interface SimpleListEditorProps {
  rows: any[];
  fields: { key: string; label: string; width?: number; type?: 'text' | 'number' }[];
  onSave: (item: any) => Promise<any>;
  onDelete: (id: string) => Promise<any>;
  idKey?: string;
  newRowTemplate?: () => any;
}

function SimpleListEditor({ rows, fields, onSave, onDelete, idKey = 'id', newRowTemplate }: SimpleListEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuf, setEditBuf] = useState<any>({});
  const [creating, setCreating] = useState(false);
  const [createBuf, setCreateBuf] = useState<any>(newRowTemplate ? newRowTemplate() : {});
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: (item: any) => onSave(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms'] });
      setEditingId(null);
      setEditBuf({});
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => onDelete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cms'] }),
  });

  const startEdit = (row: any) => {
    setEditingId(row[idKey]);
    setEditBuf({ ...row });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditBuf({});
  };

  const startCreate = () => {
    setCreating(true);
    setCreateBuf(newRowTemplate ? newRowTemplate() : {});
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
        <Button
          size="small"
          variant="contained"
          startIcon={<AddIcon />}
          onClick={startCreate}
          sx={{ bgcolor: 'primary.main' }}
        >
          新建
        </Button>
      </Box>
      <Box sx={{ overflowX: 'auto', bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', minWidth: 800, bgcolor: 'action.hover', px: 1.5, py: 1, fontSize: 11, fontWeight: 700, color: 'text.secondary', letterSpacing: 1, textTransform: 'uppercase' }}>
          {fields.map((f) => (
            <Box key={f.key} sx={{ flex: 1, minWidth: f.width ?? 100 }}>{f.label}</Box>
          ))}
          <Box sx={{ width: 100, textAlign: 'right' }}>操作</Box>
        </Box>
        {/* 新建行 */}
        {creating && (
          <Box sx={{ display: 'flex', minWidth: 800, px: 1.5, py: 1, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'rgba(254, 44, 85, 0.06)' }}>
            {fields.map((f) => (
              <Box key={f.key} sx={{ flex: 1, minWidth: f.width ?? 100, pr: 0.5 }}>
                <TextField
                  size="small"
                  type={f.type === 'number' ? 'number' : 'text'}
                  value={createBuf[f.key] ?? ''}
                  onChange={(e) => setCreateBuf({ ...createBuf, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                  sx={{ width: '100%' }}
                />
              </Box>
            ))}
            <Box sx={{ width: 100, display: 'flex', justifyContent: 'flex-end', gap: 0.5, alignItems: 'center' }}>
              <IconButton size="small" color="primary" onClick={() => saveMutation.mutate(createBuf)} disabled={saveMutation.isPending}>
                <SaveIcon fontSize="small" />
              </IconButton>
              <Button size="small" onClick={() => setCreating(false)}>取消</Button>
            </Box>
          </Box>
        )}
        {rows.map((row) => {
          const isEditing = editingId === row[idKey];
          return (
            <Box key={row[idKey]} sx={{ display: 'flex', minWidth: 800, px: 1.5, py: 1, borderTop: '1px solid', borderColor: 'divider', alignItems: 'center', '&:hover': { bgcolor: 'action.hover' } }}>
              {fields.map((f) => (
                <Box key={f.key} sx={{ flex: 1, minWidth: f.width ?? 100, pr: 0.5, fontSize: 12, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {isEditing ? (
                    <TextField
                      size="small"
                      type={f.type === 'number' ? 'number' : 'text'}
                      value={editBuf[f.key] ?? ''}
                      onChange={(e) => setEditBuf({ ...editBuf, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                      sx={{ width: '100%' }}
                    />
                  ) : (
                    String(row[f.key] ?? '')
                  )}
                </Box>
              ))}
              <Box sx={{ width: 100, display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                {isEditing ? (
                  <>
                    <IconButton size="small" color="primary" onClick={() => saveMutation.mutate(editBuf)} disabled={saveMutation.isPending}>
                      <SaveIcon fontSize="small" />
                    </IconButton>
                    <Button size="small" onClick={cancelEdit}>取消</Button>
                  </>
                ) : (
                  <>
                    <IconButton size="small" onClick={() => startEdit(row)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => { if (confirm(`确认删除「${row[idKey]}」?`)) deleteMutation.mutate(row[idKey]); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export default function DashboardConfigPage() {
  const [tab, setTab] = useState<TabKey>('activity');
  const queryClient = useQueryClient();

  // 8 个 query,按 tab 启用
  const activityQ = useQuery({ queryKey: ['cms', 'activity'], queryFn: () => cmsActivity.list(), enabled: tab === 'activity' });
  const giftQ = useQuery({ queryKey: ['cms', 'gift'], queryFn: () => cmsGift.list(), enabled: tab === 'gift' });
  const hotQ = useQuery({ queryKey: ['cms', 'hot-topic'], queryFn: () => cmsHotTopic.list(), enabled: tab === 'hot-topic' });
  const reviewerQ = useQuery({ queryKey: ['cms', 'reviewer'], queryFn: () => cmsReviewer.list(), enabled: tab === 'reviewer' });
  const bountyQ = useQuery({ queryKey: ['cms', 'bounty'], queryFn: () => cmsBounty.list(), enabled: tab === 'bounty' });
  const categoryQ = useQuery({ queryKey: ['cms', 'category'], queryFn: () => cmsCategory.list(), enabled: tab === 'category' });
  const rankerQ = useQuery({ queryKey: ['cms', 'ranker'], queryFn: () => cmsRanker.list(), enabled: tab === 'ranker' });
  const vipQ = useQuery({ queryKey: ['cms', 'vip'], queryFn: () => cmsVip.get(), enabled: tab === 'vip' });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['cms'] });

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
        <Typography sx={{ fontSize: 22, fontWeight: 700, color: 'text.primary' }}>Dashboard 配置中心</Typography>
        <Box sx={{ flex: 1 }} />
        <Button size="small" startIcon={<RefreshIcon />} onClick={refresh} sx={{ color: 'text.secondary' }}>刷新</Button>
      </Box>

      {/* tab 切换 */}
      <Box sx={{ display: 'flex', gap: 0.5, mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
        {TABS.map((t) => (
          <Box
            key={t.key}
            onClick={() => setTab(t.key)}
            sx={{
              px: 2, py: 1, cursor: 'pointer', fontSize: 13, fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? 'primary.main' : 'text.secondary',
              borderBottom: '2px solid',
              borderColor: tab === t.key ? 'primary.main' : 'transparent',
              '&:hover': { color: 'primary.main' },
            }}
          >
            {t.label}
          </Box>
        ))}
      </Box>

      {/* tab 内容 */}
      {tab === 'activity' && (
        <SimpleListEditor
          rows={activityQ.data?.list ?? []}
          fields={[
            { key: 'id', label: 'ID', width: 140 },
            { key: 'title', label: '标题', width: 160 },
            { key: 'category', label: '分类', width: 80 },
            { key: 'status', label: '状态', width: 80 },
            { key: 'organizer', label: '主办方', width: 100 },
            { key: 'totalReward', label: '奖金', width: 140 },
            { key: 'heat', label: '热度', width: 60, type: 'number' },
          ]}
          onSave={cmsActivity.save}
          onDelete={cmsActivity.remove}
          newRowTemplate={() => ({ id: `act-${Date.now()}`, title: '新活动', category: 'official', status: 'signup', participation: 'none', organizer: '运营', heat: 0 })}
        />
      )}
      {tab === 'gift' && (
        <SimpleListEditor
          rows={giftQ.data?.list ?? []}
          fields={[
            { key: 'id', label: 'ID', width: 100 },
            { key: 'name', label: '名称', width: 100 },
            { key: 'icon', label: '图标', width: 60 },
            { key: 'price', label: '价格(分)', width: 90, type: 'number' },
            { key: 'effect', label: '特效', width: 80 },
            { key: 'combo', label: '连击', width: 60 },
          ]}
          onSave={cmsGift.save}
          onDelete={cmsGift.remove}
          newRowTemplate={() => ({ id: `g-${Date.now()}`, name: '新礼物', icon: '🎁', price: 100, effect: 'small', combo: false })}
        />
      )}
      {tab === 'hot-topic' && (
        <SimpleListEditor
          rows={hotQ.data?.list ?? []}
          fields={[
            { key: 'id', label: 'ID', width: 100 },
            { key: 'title', label: '标题', width: 180 },
            { key: 'tag', label: '标签', width: 70 },
            { key: 'heat', label: '热度', width: 60, type: 'number' },
            { key: 'reward', label: '奖励', width: 100 },
            { key: 'sort', label: '排序', width: 60, type: 'number' },
          ]}
          onSave={cmsHotTopic.save}
          onDelete={cmsHotTopic.remove}
          newRowTemplate={() => ({ id: `ht-${Date.now()}`, title: '新热点', tag: '热点', heat: 0, reward: '', sort: 99 })}
        />
      )}
      {tab === 'reviewer' && (
        <SimpleListEditor
          rows={reviewerQ.data?.list ?? []}
          fields={[
            { key: 'id', label: 'ID', width: 100 },
            { key: 'name', label: '姓名', width: 100 },
            { key: 'team', label: '班组', width: 70 },
            { key: 'level', label: '等级', width: 60, type: 'number' },
            { key: 'title', label: '职位', width: 140 },
            { key: 'reviewCount', label: '审核数', width: 80, type: 'number' },
            { key: 'online', label: '在线', width: 60 },
          ]}
          onSave={cmsReviewer.save}
          onDelete={cmsReviewer.remove}
          newRowTemplate={() => ({ id: `r-${Date.now()}`, name: '新审核员', team: 'A 班', level: 1, title: '审核员', reviewCount: 0, online: true, maxLoad: 5, currentLoad: 0, avatarColor: 'primary.main' })}
        />
      )}
      {tab === 'bounty' && (
        <SimpleListEditor
          rows={bountyQ.data?.list ?? []}
          fields={[
            { key: 'id', label: 'ID', width: 70 },
            { key: 'title', label: '标题', width: 220 },
            { key: 'category', label: '分类', width: 70 },
            { key: 'reward', label: '奖金(分)', width: 90, type: 'number' },
            { key: 'daysLeft', label: '剩余天', width: 70, type: 'number' },
            { key: 'sponsor', label: '发起方', width: 100 },
          ]}
          onSave={cmsBounty.save}
          onDelete={cmsBounty.remove}
          newRowTemplate={() => ({ id: `b-${Date.now()}`, title: '新悬赏', category: 'video', reward: 100000, daysLeft: 7, sponsor: '平台' })}
        />
      )}
      {tab === 'category' && (
        <SimpleListEditor
          rows={categoryQ.data?.list ?? []}
          fields={[
            { key: 'code', label: 'code', width: 100 },
            { key: 'label', label: '名称', width: 120 },
            { key: 'icon', label: '图标', width: 120 },
            { key: 'color', label: '颜色', width: 100 },
            { key: 'sort', label: '排序', width: 70, type: 'number' },
          ]}
          onSave={cmsCategory.save}
          onDelete={cmsCategory.remove}
          idKey="code"
          newRowTemplate={() => ({ code: `cat-${Date.now()}`, label: '新分类', icon: 'VideoLibrary', color: 'primary.main', sort: 99 })}
        />
      )}
      {tab === 'ranker' && (
        <SimpleListEditor
          rows={rankerQ.data?.list ?? []}
          fields={[
            { key: 'id', label: 'ID', width: 80 },
            { key: 'rank', label: '排名', width: 60, type: 'number' },
            { key: 'name', label: '姓名', width: 140 },
            { key: 'bounty', label: '已接单', width: 80, type: 'number' },
            { key: 'income', label: '收益(分)', width: 100, type: 'number' },
          ]}
          onSave={cmsRanker.save}
          onDelete={cmsRanker.remove}
          newRowTemplate={() => ({ id: `rr-${Date.now()}`, rank: 99, name: '新达人', bounty: 0, income: 0, avatarColor: 'primary.main', color: 'primary.main' })}
        />
      )}
      {tab === 'vip' && vipQ.data && <VipEditor data={vipQ.data} />}
    </Box>
  );
}

function VipEditor({ data }: { data: { tiers: any[]; tasks: any[]; benefits: any[] } }) {
  const [tiers, setTiers] = useState<any[]>(data.tiers);
  const [tasks, setTasks] = useState<any[]>(data.tasks);
  const [benefits, setBenefits] = useState<any[]>(data.benefits);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({ open: false, msg: '', severity: 'success' });
  const queryClient = useQueryClient();
  const saveMutation = useMutation({
    mutationFn: () => cmsVip.save({ tiers, tasks, benefits }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms', 'vip'] });
      setSnack({ open: true, msg: 'VIP 配置已保存', severity: 'success' });
    },
    onError: (e: any) => setSnack({ open: true, msg: e?.message || '保存失败', severity: 'error' }),
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          保存全部
        </Button>
      </Box>

      <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1 }}>套餐 Tiers</Typography>
      <Box sx={{ mb: 3, bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 2 }}>
        {tiers.map((t, idx) => (
          <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
            <TextField size="small" label="ID" value={t.id ?? ''} onChange={(e) => { const n = [...tiers]; n[idx] = { ...n[idx], id: e.target.value }; setTiers(n); }} />
            <TextField size="small" label="名称" value={t.name ?? ''} onChange={(e) => { const n = [...tiers]; n[idx] = { ...n[idx], name: e.target.value }; setTiers(n); }} />
            <TextField size="small" label="价格(分)" type="number" value={t.price ?? 0} onChange={(e) => { const n = [...tiers]; n[idx] = { ...n[idx], price: Number(e.target.value) }; setTiers(n); }} sx={{ width: 120 }} />
            <TextField size="small" label="原价(分)" type="number" value={t.origPrice ?? 0} onChange={(e) => { const n = [...tiers]; n[idx] = { ...n[idx], origPrice: Number(e.target.value) }; setTiers(n); }} sx={{ width: 120 }} />
            <TextField size="small" label="Badge" value={t.badge ?? ''} onChange={(e) => { const n = [...tiers]; n[idx] = { ...n[idx], badge: e.target.value }; setTiers(n); }} sx={{ width: 100 }} />
            <IconButton color="error" size="small" onClick={() => setTiers(tiers.filter((_, i) => i !== idx))}><DeleteIcon fontSize="small" /></IconButton>
          </Box>
        ))}
        <Button size="small" startIcon={<AddIcon />} onClick={() => setTiers([...tiers, { id: `tier-${Date.now()}`, name: '新套餐', price: 0, origPrice: 0, badge: '' }])}>新增套餐</Button>
      </Box>

      <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1 }}>任务 Tasks</Typography>
      <Box sx={{ mb: 3, bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 2 }}>
        {tasks.map((t, idx) => (
          <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
            <TextField size="small" label="标题" value={t.title ?? ''} onChange={(e) => { const n = [...tasks]; n[idx] = { ...n[idx], title: e.target.value }; setTasks(n); }} sx={{ flex: 1 }} />
            <TextField size="small" label="奖励" value={t.reward ?? ''} onChange={(e) => { const n = [...tasks]; n[idx] = { ...n[idx], reward: e.target.value }; setTasks(n); }} sx={{ width: 200 }} />
            <IconButton color="error" size="small" onClick={() => setTasks(tasks.filter((_, i) => i !== idx))}><DeleteIcon fontSize="small" /></IconButton>
          </Box>
        ))}
        <Button size="small" startIcon={<AddIcon />} onClick={() => setTasks([...tasks, { id: `task-${Date.now()}`, title: '新任务', reward: '', done: false }])}>新增任务</Button>
      </Box>

      <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1 }}>权益 Benefits</Typography>
      <Box sx={{ mb: 3, bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 2 }}>
        {benefits.map((b, idx) => (
          <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
            <TextField size="small" label="标题" value={b.title ?? ''} onChange={(e) => { const n = [...benefits]; n[idx] = { ...n[idx], title: e.target.value }; setBenefits(n); }} sx={{ flex: 1 }} />
            <IconButton color="error" size="small" onClick={() => setBenefits(benefits.filter((_, i) => i !== idx))}><DeleteIcon fontSize="small" /></IconButton>
          </Box>
        ))}
        <Button size="small" startIcon={<AddIcon />} onClick={() => setBenefits([...benefits, { id: `b-${Date.now()}`, title: '新权益' }])}>新增权益</Button>
      </Box>

      <Snackbar open={snack.open} autoHideDuration={2200} onClose={() => setSnack({ ...snack, open: false })}>
        <Alert severity={snack.severity} variant="filled">{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
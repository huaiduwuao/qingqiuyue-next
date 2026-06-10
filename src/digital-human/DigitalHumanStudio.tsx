'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import IconButton from '@mui/material/IconButton';
import Collapse from '@mui/material/Collapse';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';

type Stage = { key: string; label: string };
type Material = { id: string; name: string; type: string; sizeMB: number; status: string; durationSec: number; createdAt: number; usedBy: string };
type Asset = { id: string; name: string; mode: string; status: string; active: boolean; published: boolean; thumbnail: string; sizeMB: number; joints: number; hasFlame: boolean };
type Job = { id: string; name: string; method: string; status: string; stage: string; progress: number; logs: string[]; createdAt?: number };

const api = (p: string, init?: RequestInit) =>
  fetch('/api/avatar' + p, { headers: { 'Content-Type': 'application/json' }, ...init }).then((r) => r.json()).then((j) => j?.data ?? j);
const fmtTime = (t?: number) => (t ? new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-');

const cellSx = { fontSize: 12.5, color: 'text.primary', borderColor: 'rgba(255,255,255,0.06)' };
const headSx = { fontSize: 11.5, color: 'text.secondary', fontWeight: 700, borderColor: 'rgba(255,255,255,0.08)' };

export default function DigitalHumanStudio() {
  const [tab, setTab] = React.useState(0);
  const [stages, setStages] = React.useState<Stage[]>([]);
  const [materials, setMaterials] = React.useState<Material[]>([]);
  const [assets, setAssets] = React.useState<Asset[]>([]);
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [resources, setResources] = React.useState<any[]>([]);
  const [schedule, setSchedule] = React.useState<any[]>([]);
  const [models, setModels] = React.useState<any[]>([]);
  const [name, setName] = React.useState('我的数字人');
  const [source, setSource] = React.useState('');
  const [method, setMethod] = React.useState('ExAvatar');
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    const [a, j, m, r, s, md] = await Promise.all([
      api('/assets'), api('/jobs'), api('/materials'),
      api('/resources'), api('/schedule'), api('/models'),
    ]);
    setStages(a?.stages || []);
    setAssets(a?.list || []);
    setJobs(j?.list || []);
    setMaterials(m?.list || []);
    setResources(r?.list || []);
    setSchedule(s?.list || []);
    setModels(md?.list || []);
  }, []);
  const toggleModel = async (id: string) => { await api(`/models/${id}/toggle`, { method: 'POST' }); refresh(); };
  const reloadModel = async (id: string) => { await api(`/models/${id}/reload`, { method: 'POST' }); refresh(); };
  React.useEffect(() => {
    refresh();
    const t = setInterval(refresh, 1000);
    return () => clearInterval(t);
  }, [refresh]);

  const train = async () => {
    await api('/train', { method: 'POST', body: JSON.stringify({ name, source, method }) });
    setTab(1);
    refresh();
  };
  const uploadMaterial = async () => {
    const nm = prompt('素材文件名(模拟上传)', `采集_${Date.now() % 1000}.mp4`);
    if (!nm) return;
    await api('/materials', { method: 'POST', body: JSON.stringify({ name: nm, type: 'video' }) });
    refresh();
  };
  const delMaterial = async (id: string) => { await api(`/materials/${id}`, { method: 'DELETE' }); refresh(); };
  const trainWithMaterial = (m: Material) => { setSource(m.name); setName(m.name.replace(/\.\w+$/, '')); setTab(1); };
  const activate = async (id: string) => { await api(`/assets/${id}/activate`, { method: 'POST' }); refresh(); };
  const publish = async (id: string, v: boolean) => { await api(`/assets/${id}/publish`, { method: 'POST', body: JSON.stringify({ published: v }) }); refresh(); };
  const delAsset = async (id: string) => { await api(`/assets/${id}`, { method: 'DELETE' }); refresh(); };
  const cancel = async (id: string) => { await api(`/jobs/${id}/cancel`, { method: 'POST' }); refresh(); };

  const activeJob = jobs.find((j) => j.status === 'running');
  const stageIdx = (k: string) => stages.findIndex((s) => s.key === k);

  return (
    <Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, minHeight: 40, '& .MuiTab-root': { minHeight: 40, fontSize: 13 } }}>
        <Tab label={`素材上传 (${materials.length})`} />
        <Tab label={`训练记录 (${jobs.length})`} />
        <Tab label={`发布管理 (${assets.length})`} />
        <Tab label={`训练资源 (${resources.length})`} />
        <Tab label={`调度 (${schedule.length})`} />
        <Tab label={`模型服务 (${models.length})`} />
      </Tabs>

      {/* 当前训练的全流程条 */}
      {activeJob && (
        <Box sx={{ p: 1.5, mb: 2, borderRadius: 2, border: '1px solid', borderColor: 'primary.main', bgcolor: 'rgba(254,44,85,0.06)', display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <AutorenewRoundedIcon sx={{ fontSize: 16, color: 'primary.main', animation: 'spin 1.2s linear infinite', '@keyframes spin': { to: { transform: 'rotate(360deg)' } } }} />
          <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{activeJob.name}</Typography>
          {stages.map((s, i) => (
            <Chip key={s.key} size="small" label={s.label.split('(')[0]} variant={i === stageIdx(activeJob.stage) ? 'filled' : 'outlined'} color={i <= stageIdx(activeJob.stage) ? 'primary' : 'default'} sx={{ height: 20, fontSize: 10 }} />
          ))}
          <Box sx={{ flex: 1, minWidth: 120 }}><LinearProgress variant="determinate" value={activeJob.progress} sx={{ borderRadius: 1 }} /></Box>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{activeJob.progress}%</Typography>
        </Box>
      )}

      {/* ── 素材上传列表 ── */}
      {tab === 0 && (
        <Box>
          <Box sx={{ display: 'flex', mb: 1.5 }}>
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" size="small" startIcon={<UploadFileRoundedIcon />} onClick={uploadMaterial}>上传素材</Button>
          </Box>
          <Table size="small">
            <TableHead><TableRow>
              {['素材名', '类型', '时长', '大小', '状态', '已用于', '上传时间', ''].map((h) => <TableCell key={h} sx={headSx}>{h}</TableCell>)}
            </TableRow></TableHead>
            <TableBody>
              {materials.map((m) => (
                <TableRow key={m.id} hover>
                  <TableCell sx={cellSx}>{m.name}</TableCell>
                  <TableCell sx={cellSx}><Chip size="small" label={m.type === 'video' ? '采集视频' : m.type === 'clip' ? '动作片段' : m.type} sx={{ height: 18, fontSize: 10 }} /></TableCell>
                  <TableCell sx={cellSx}>{m.durationSec}s</TableCell>
                  <TableCell sx={cellSx}>{m.sizeMB}MB</TableCell>
                  <TableCell sx={cellSx}><Chip size="small" label={m.status === 'processed' ? '已处理' : '待训练'} color={m.status === 'processed' ? 'success' : 'default'} sx={{ height: 18, fontSize: 10 }} /></TableCell>
                  <TableCell sx={cellSx}>{m.usedBy || '—'}</TableCell>
                  <TableCell sx={{ ...cellSx, color: 'text.disabled' }}>{fmtTime(m.createdAt)}</TableCell>
                  <TableCell sx={cellSx} align="right">
                    <Button size="small" sx={{ fontSize: 11 }} onClick={() => trainWithMaterial(m)}>训练</Button>
                    <IconButton size="small" onClick={() => delMaterial(m.id)}><DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      {/* ── 训练记录列表 ── */}
      {tab === 1 && (
        <Box>
          <Box sx={{ p: 1.5, mb: 2, borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <TextField size="small" label="名称" value={name} onChange={(e) => setName(e.target.value)} sx={{ width: 160 }} />
            <TextField size="small" label="素材" value={source} onChange={(e) => setSource(e.target.value)} placeholder="capture.mp4" sx={{ flex: 1, minWidth: 160 }} />
            <TextField size="small" select label="方法" value={method} onChange={(e) => setMethod(e.target.value)} sx={{ width: 140 }}>
              <MenuItem value="ExAvatar">ExAvatar</MenuItem>
              <MenuItem value="GauHuman">GauHuman</MenuItem>
            </TextField>
            <Button variant="contained" startIcon={<AutorenewRoundedIcon />} onClick={train}>一键训练</Button>
          </Box>
          <Table size="small">
            <TableHead><TableRow>
              {['任务', '方法', '阶段', '进度', '状态', '创建', ''].map((h) => <TableCell key={h} sx={headSx}>{h}</TableCell>)}
            </TableRow></TableHead>
            <TableBody>
              {jobs.map((j) => (
                <React.Fragment key={j.id}>
                  <TableRow hover>
                    <TableCell sx={cellSx}>{j.name}</TableCell>
                    <TableCell sx={cellSx}>{j.method}</TableCell>
                    <TableCell sx={cellSx}>{stages.find((s) => s.key === j.stage)?.label.split('(')[0] || j.stage}</TableCell>
                    <TableCell sx={{ ...cellSx, width: 120 }}><LinearProgress variant="determinate" value={j.progress} sx={{ borderRadius: 1 }} /></TableCell>
                    <TableCell sx={cellSx}><Chip size="small" label={{ running: '训练中', done: '完成', canceled: '已取消', failed: '失败' }[j.status] || j.status} color={j.status === 'done' ? 'success' : j.status === 'running' ? 'primary' : 'default'} sx={{ height: 18, fontSize: 10 }} /></TableCell>
                    <TableCell sx={{ ...cellSx, color: 'text.disabled' }}>{fmtTime(j.createdAt)}</TableCell>
                    <TableCell sx={cellSx} align="right">
                      {j.status === 'running' && <Button size="small" sx={{ fontSize: 11 }} onClick={() => cancel(j.id)}>取消</Button>}
                      <IconButton size="small" onClick={() => setExpanded(expanded === j.id ? null : j.id)}><ExpandMoreRoundedIcon sx={{ fontSize: 18, transform: expanded === j.id ? 'rotate(180deg)' : 'none' }} /></IconButton>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={7} sx={{ p: 0, border: 0 }}>
                      <Collapse in={expanded === j.id}>
                        <Box sx={{ m: 1, p: 1, bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 1, fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'text.secondary', maxHeight: 160, overflowY: 'auto' }}>
                          {j.logs.map((l, i) => <div key={i}>{l}</div>)}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
              {jobs.length === 0 && <TableRow><TableCell colSpan={7} sx={{ ...cellSx, textAlign: 'center', color: 'text.disabled', py: 3 }}>暂无训练记录</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Box>
      )}

      {/* ── 发布列表 ── */}
      {tab === 2 && (
        <Table size="small">
          <TableHead><TableRow>
            {['', '名称', '类型', '规格', '状态', '发布', ''].map((h) => <TableCell key={h} sx={headSx}>{h}</TableCell>)}
          </TableRow></TableHead>
          <TableBody>
            {assets.map((a) => (
              <TableRow key={a.id} hover>
                <TableCell sx={cellSx}><Box sx={{ width: 36, height: 54, borderRadius: 1, background: `url(${a.thumbnail}) center/cover` }} /></TableCell>
                <TableCell sx={cellSx}>
                  {a.name}{a.active && <Chip size="small" label="当前" color="primary" sx={{ ml: 0.75, height: 16, fontSize: 9 }} />}
                </TableCell>
                <TableCell sx={cellSx}>{a.mode === '3dgs' ? '3D 高斯' : '2D 真人'}</TableCell>
                <TableCell sx={{ ...cellSx, color: 'text.disabled' }}>{a.sizeMB}MB{a.joints ? ` · ${a.joints}关节` : ''}{a.hasFlame ? ' · 表情' : ''}</TableCell>
                <TableCell sx={cellSx}><Chip size="small" label={a.published ? '已发布' : '未发布'} color={a.published ? 'success' : 'default'} sx={{ height: 18, fontSize: 10 }} /></TableCell>
                <TableCell sx={cellSx}>
                  <Button size="small" sx={{ fontSize: 11 }} onClick={() => publish(a.id, !a.published)}>{a.published ? '下线' : '发布'}</Button>
                </TableCell>
                <TableCell sx={cellSx} align="right">
                  <Button size="small" variant={a.active ? 'outlined' : 'contained'} disabled={a.active} onClick={() => activate(a.id)} sx={{ fontSize: 11 }}>{a.active ? '使用中' : '设为当前'}</Button>
                  <IconButton size="small" onClick={() => delAsset(a.id)}><DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* ── 训练资源(GPU)── */}
      {tab === 3 && (
        <Table size="small">
          <TableHead><TableRow>
            {['节点', 'GPU', '显存', '利用率', '温度', '状态', '当前任务'].map((h) => <TableCell key={h} sx={headSx}>{h}</TableCell>)}
          </TableRow></TableHead>
          <TableBody>
            {resources.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell sx={cellSx}>{r.name}</TableCell>
                <TableCell sx={cellSx}>{r.gpu}</TableCell>
                <TableCell sx={{ ...cellSx, minWidth: 150 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ flex: 1 }}><LinearProgress variant="determinate" value={(r.vramUsedGB / r.vramTotalGB) * 100} color={r.vramUsedGB / r.vramTotalGB > 0.85 ? 'error' : 'primary'} sx={{ borderRadius: 1 }} /></Box>
                    <span>{r.vramUsedGB}/{r.vramTotalGB}G</span>
                  </Box>
                </TableCell>
                <TableCell sx={cellSx}>{r.utilPct}%</TableCell>
                <TableCell sx={cellSx}>{r.temp ? `${r.temp}°C` : '—'}</TableCell>
                <TableCell sx={cellSx}><Chip size="small" label={{ training: '训练中', idle: '空闲', offline: '离线' }[r.status as string] || r.status} color={r.status === 'training' ? 'primary' : r.status === 'idle' ? 'success' : 'default'} sx={{ height: 18, fontSize: 10 }} /></TableCell>
                <TableCell sx={{ ...cellSx, color: 'text.disabled' }}>{r.currentJob || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* ── 调度队列 ── */}
      {tab === 4 && (
        <Table size="small">
          <TableHead><TableRow>
            {['任务', '状态', '资源', '优先级', '预计', ''].map((h) => <TableCell key={h} sx={headSx}>{h}</TableCell>)}
          </TableRow></TableHead>
          <TableBody>
            {schedule.map((s, i) => (
              <TableRow key={i} hover>
                <TableCell sx={cellSx}>{s.name}</TableCell>
                <TableCell sx={cellSx}><Chip size="small" label={s.status === 'running' ? '执行中' : '排队'} color={s.status === 'running' ? 'primary' : 'default'} sx={{ height: 18, fontSize: 10 }} /></TableCell>
                <TableCell sx={cellSx}>{s.resource}</TableCell>
                <TableCell sx={cellSx}><Chip size="small" label={s.priority} color={s.priority === '高' ? 'warning' : 'default'} sx={{ height: 18, fontSize: 10 }} /></TableCell>
                <TableCell sx={{ ...cellSx, color: 'text.disabled' }}>{s.eta}</TableCell>
                <TableCell sx={cellSx} align="right">{s.status === 'running' && <Button size="small" sx={{ fontSize: 11 }} onClick={() => cancel(s.jobId)}>取消</Button>}</TableCell>
              </TableRow>
            ))}
            {schedule.length === 0 && <TableRow><TableCell colSpan={6} sx={{ ...cellSx, textAlign: 'center', color: 'text.disabled', py: 3 }}>调度队列为空</TableCell></TableRow>}
          </TableBody>
        </Table>
      )}

      {/* ── 模型服务(ASR/LLM/TTS)── */}
      {tab === 5 && (
        <Table size="small">
          <TableHead><TableRow>
            {['模型', '类型', '提供方', '端点', '显存', '调用', '状态', '操作'].map((h) => <TableCell key={h} sx={headSx}>{h}</TableCell>)}
          </TableRow></TableHead>
          <TableBody>
            {models.map((m) => (
              <TableRow key={m.id} hover>
                <TableCell sx={cellSx}>{m.name}<Box component="span" sx={{ color: 'text.disabled', fontSize: 11, ml: 0.5 }}>{m.model}</Box></TableCell>
                <TableCell sx={cellSx}><Chip size="small" label={({ asr: 'ASR 识别', llm: 'LLM 大模型', tts: 'TTS 合成', a2f: '口型驱动' } as any)[m.type] || m.type} sx={{ height: 18, fontSize: 10, bgcolor: ({ asr: 'rgba(91,141,239,0.2)', llm: 'rgba(139,92,246,0.2)', tts: 'rgba(93,219,150,0.2)', a2f: 'rgba(255,180,0,0.2)' } as any)[m.type], color: '#fff' }} /></TableCell>
                <TableCell sx={cellSx}>{m.provider}</TableCell>
                <TableCell sx={{ ...cellSx, color: 'text.disabled', fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>{m.endpoint}</TableCell>
                <TableCell sx={cellSx}>{m.vramGB ? `${m.vramGB}G` : '—'}</TableCell>
                <TableCell sx={cellSx}>{m.calls}</TableCell>
                <TableCell sx={cellSx}><Chip size="small" label={m.status === 'online' ? '在线' : '离线'} color={m.status === 'online' ? 'success' : 'default'} sx={{ height: 18, fontSize: 10 }} /></TableCell>
                <TableCell sx={cellSx} align="right">
                  <Button size="small" sx={{ fontSize: 11 }} onClick={() => toggleModel(m.id)}>{m.status === 'online' ? '停用' : '启用'}</Button>
                  <Button size="small" sx={{ fontSize: 11 }} onClick={() => reloadModel(m.id)}>重载</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}

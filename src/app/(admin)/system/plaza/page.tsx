'use client';

/**
 * /system/plaza —— 数字人广场的场景、地标与人物
 *
 * 场景 = 一组地标(造型 + 面板内容 + 位置)+ 配色 + 中央舞台预设;感悟场景的地标挂一个人生感悟主题。
 * 人物 = 诗人(只说他自己写过的、这个主题的句子,台词不能手写)或引路人(运营写台词)。
 * 保存后用户下次进广场就看到。后端:core-api /api/core/admin/plaza/*(system:plaza:view / manage)。
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Paper from '@mui/material/Paper';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { useAuthority } from '@/contexts/AuthContext';
import { PERMISSIONS } from '@/lib/permissions';
import { formatApiError } from '@/lib/api/client';
import {
  adminDeletePlazaCharacter, adminDeletePlazaScene, adminListPlazaScenes, adminSavePlazaCharacter, adminSavePlazaScene,
  type PlazaCharacter, type PlazaLandmark, type PlazaScene,
} from '@/apis/plaza';
import { overview as insightOverview, themePoets, type InsightGroup } from '@/apis/insight';

const PROPS: Record<string, string> = {
  pavilion: '亭子', stele: '石碑', lantern: '灯笼', willow: '柳树', moongate: '月洞门',
  dance: '舞池', jukebox: '点唱机', wish: '许愿池', cinema: '放映亭', books: '书亭', stars: '观星台',
};
const FEEDS: Record<string, string> = {
  insight: '人生感悟主题', cinema: '影视推荐', jukebox: '热歌', books: '今日一悟 + 小说', dance: '正在直播', stars: '全网热榜', wish: '许愿墙 + 悬赏', none: '无面板',
};
const TIMES: Record<string, string> = { '': '按类型默认', auto: '跟随现在', dawn: '清晨', day: '白天', dusk: '黄昏', night: '夜晚' };
const WEATHERS: Record<string, string> = { '': '按类型默认', none: '无', petals: '落花', leaves: '落叶', rain: '细雨', snow: '小雪', fireflies: '萤火' };
const STAGES: Record<string, string> = { concert: '演唱会主舞台', idol: '偶像练习室', garden: '月光花园', neon: '赛博霓虹', studio: '摄影棚白底', lawn: '白天草坪' };
const WORLD_R = 17;
const STAGE_CLEAR = 3.2;

export default function PlazaAdminPage() {
  return (
    <PermissionGuard
      need={PERMISSIONS.SYSTEM_PLAZA.VIEW}
      fallback={<Alert severity="warning" sx={{ m: 2 }}>你没有「广场场景与人物」权限。请联系管理员在 /system/role 里授予 system:plaza:view。</Alert>}
    >
      <PlazaAdminInner />
    </PermissionGuard>
  );
}

function PlazaAdminInner() {
  const { can } = useAuthority();
  const canManage = can(PERMISSIONS.SYSTEM_PLAZA.MANAGE);
  const [tab, setTab] = React.useState<'scenes' | 'characters'>('scenes');
  const [scenes, setScenes] = React.useState<PlazaScene[]>([]);
  const [chars, setChars] = React.useState<PlazaCharacter[]>([]);
  const [groups, setGroups] = React.useState<InsightGroup[]>([]);
  const [msg, setMsg] = React.useState<{ text: string; severity: 'success' | 'error' } | null>(null);
  const [editScene, setEditScene] = React.useState<Partial<PlazaScene> | null>(null);
  const [editChar, setEditChar] = React.useState<Partial<PlazaCharacter> | null>(null);
  const [sceneFilter, setSceneFilter] = React.useState('');

  const load = React.useCallback(async () => {
    try {
      const r = await adminListPlazaScenes();
      setScenes(r.scenes);
      setChars(r.characters);
    } catch (e) {
      setMsg({ text: formatApiError(e), severity: 'error' });
    }
  }, []);
  React.useEffect(() => {
    void load();
    insightOverview().then((r) => setGroups(r?.groups ?? [])).catch(() => {});
  }, [load]);

  const themes = React.useMemo(() => groups.flatMap((g) => g.themes.map((t) => ({ ...t, groupName: g.name }))), [groups]);
  const themeName = (k?: string) => themes.find((t) => t.key === k)?.name ?? k ?? '';

  const del = async (what: string, fn: () => Promise<unknown>) => {
    if (!window.confirm(`确定删除${what}?`)) return;
    try { await fn(); setMsg({ text: '已删除', severity: 'success' }); void load(); } catch (e) { setMsg({ text: formatApiError(e), severity: 'error' }); }
  };

  const shownChars = chars.filter((c) => !sceneFilter || c.sceneKey === sceneFilter);

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 240 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>广场场景与人物</Typography>
          <Typography variant="body2" color="text.secondary">
            数字人广场里能去的场景、每个场景的地标,以及站在里面的人物。诗人只说语料里他自己写过的句子;引路人的台词由这里填写。
          </Typography>
        </Box>
        {canManage && (
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => (tab === 'scenes'
            ? setEditScene({ kind: 'insight', stage: 'garden', status: 'draft', palette: {}, landmarks: [], sort: scenes.length })
            : setEditChar({ sceneKey: sceneFilter || scenes[0]?.key, kind: 'poet', status: 'published', lines: [], x: 0, z: 5 }))}>
            {tab === 'scenes' ? '新建场景' : '新建人物'}
          </Button>
        )}
      </Box>
      {msg && <Alert severity={msg.severity} onClose={() => setMsg(null)} sx={{ mb: 1.5 }}>{msg.text}</Alert>}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="scenes" label={`场景(${scenes.length})`} />
        <Tab value="characters" label={`人物(${chars.length})`} />
      </Tabs>

      {tab === 'scenes' && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', xl: '1fr 1fr 1fr' }, gap: 2 }}>
          {scenes.map((s) => (
            <Paper key={s.id} variant="outlined" sx={{ p: 2, borderRadius: 3, display: 'flex', gap: 2 }}>
              <LayoutPreview size={120} landmarks={s.landmarks} characters={chars.filter((c) => c.sceneKey === s.key)} accent={s.palette?.accent} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontWeight: 700 }}>{s.name}</Typography>
                  <Chip size="small" label={s.kind === 'insight' ? `感悟 · ${groups.find((g) => g.key === s.group)?.name ?? s.group}` : '广场'} />
                  {s.status === 'draft' && <Chip size="small" color="warning" label="草稿" />}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{s.key} · 舞台 {STAGES[s.stage] ?? s.stage}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.intro}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {s.landmarks.length} 个地标 · {chars.filter((c) => c.sceneKey === s.key).length} 位人物
                </Typography>
                {canManage && (
                  <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                    <Button size="small" startIcon={<EditRoundedIcon />} onClick={() => setEditScene(JSON.parse(JSON.stringify(s)))}>编辑</Button>
                    <Button size="small" onClick={() => { setSceneFilter(s.key); setTab('characters'); }}>人物</Button>
                    {s.key !== 'plaza' && <Button size="small" color="error" onClick={() => del(`场景「${s.name}」和它的人物`, () => adminDeletePlazaScene(s.id))}>删除</Button>}
                  </Box>
                )}
              </Box>
            </Paper>
          ))}
        </Box>
      )}

      {tab === 'characters' && (
        <>
          <TextField select size="small" label="场景" value={sceneFilter} onChange={(e) => setSceneFilter(e.target.value)} sx={{ mb: 2, minWidth: 220 }}>
            <MenuItem value="">全部场景</MenuItem>
            {scenes.map((s) => <MenuItem key={s.key} value={s.key}>{s.name}</MenuItem>)}
          </TextField>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', xl: '1fr 1fr 1fr' }, gap: 1.5 }}>
            {shownChars.map((c) => (
              <Paper key={c.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: c.color || (c.kind === 'poet' ? '#b9a6ff' : '#25F4EE'), display: 'grid', placeItems: 'center', color: '#111', fontWeight: 700, flexShrink: 0 }}>
                  {(c.name || c.poet || '诗').slice(0, 1)}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography sx={{ fontWeight: 700 }}>{c.name || c.poet || '(按主题自动选诗人)'}</Typography>
                    <Chip size="small" label={c.kind === 'poet' ? '诗人' : '引路人'} />
                    {c.status === 'draft' && <Chip size="small" color="warning" label="草稿" />}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {scenes.find((s) => s.key === c.sceneKey)?.name ?? c.sceneKey}
                    {c.kind === 'poet' ? ` · 说「${themeName(c.themeKey)}」` : c.groupKey ? ` · 念「${groups.find((g) => g.key === c.groupKey)?.name}」题记` : ''}
                    {` · (${c.x}, ${c.z})`}
                  </Typography>
                  {c.kind === 'guide' && c.lines.length > 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }} noWrap>「{c.lines[0]}」{c.lines.length > 1 ? ` 等 ${c.lines.length} 句` : ''}</Typography>
                  )}
                </Box>
                {canManage && (
                  <Box sx={{ display: 'flex' }}>
                    <IconButton size="small" aria-label="编辑" onClick={() => setEditChar(JSON.parse(JSON.stringify(c)))}><EditRoundedIcon fontSize="small" /></IconButton>
                    <IconButton size="small" aria-label="删除" onClick={() => del(`人物「${c.name || c.poet || '自动诗人'}」`, () => adminDeletePlazaCharacter(c.id))}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
                  </Box>
                )}
              </Paper>
            ))}
            {shownChars.length === 0 && <Typography color="text.secondary">这个场景还没有人物</Typography>}
          </Box>
        </>
      )}

      {editScene && (
        <SceneEditor
          value={editScene}
          groups={groups}
          characters={chars.filter((c) => c.sceneKey === editScene.key)}
          onClose={() => setEditScene(null)}
          onSaved={() => { setEditScene(null); setMsg({ text: '场景已保存', severity: 'success' }); void load(); }}
        />
      )}
      {editChar && (
        <CharacterEditor
          value={editChar}
          scenes={scenes}
          groups={groups}
          onClose={() => setEditChar(null)}
          onSaved={() => { setEditChar(null); setMsg({ text: '人物已保存', severity: 'success' }); void load(); }}
        />
      )}
    </Box>
  );
}

// ==================== 俯视预览 ====================

function LayoutPreview({ size, landmarks, characters, accent }: { size: number; landmarks: PlazaLandmark[]; characters: Partial<PlazaCharacter>[]; accent?: string }) {
  const s = size / 2 / (WORLD_R + 1);
  const P = (x: number, z: number) => [size / 2 + x * s, size / 2 + z * s];
  const col = accent || '#25F4EE';
  return (
    <Box component="svg" viewBox={`0 0 ${size} ${size}`} sx={{ width: size, height: size, flexShrink: 0, borderRadius: '50%', bgcolor: '#0c0d1a' }}>
      <circle cx={size / 2} cy={size / 2} r={WORLD_R * s} fill="none" stroke={col} strokeOpacity={0.4} />
      <circle cx={size / 2} cy={size / 2} r={STAGE_CLEAR * s} fill={col} fillOpacity={0.12} />
      {landmarks.map((l) => {
        const [x, y] = P(Number(l.x) || 0, Number(l.z) || 0);
        return (
          <g key={l.id}>
            <circle cx={x} cy={y} r={(Number(l.radius) || 2.4) * s} fill={l.color || col} fillOpacity={0.25} stroke={l.color || col} strokeOpacity={0.8} />
            <text x={x} y={y + 3} fontSize={size / 12} textAnchor="middle" fill="#fff">{l.label?.slice(0, 2)}</text>
          </g>
        );
      })}
      {characters.map((c, i) => {
        const [x, y] = P(Number(c.x) || 0, Number(c.z) || 0);
        return <rect key={c.id ?? i} x={x - 2.5} y={y - 2.5} width={5} height={5} transform={`rotate(45 ${x} ${y})`} fill="#f3e2b0" />;
      })}
    </Box>
  );
}

// ==================== 场景编辑 ====================

function SceneEditor({ value, groups, characters, onClose, onSaved }: { value: Partial<PlazaScene>; groups: InsightGroup[]; characters: PlazaCharacter[]; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = React.useState<Partial<PlazaScene>>(value);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const lms = v.landmarks ?? [];
  const setLm = (i: number, patch: Partial<PlazaLandmark>) => setV((o) => ({ ...o, landmarks: (o.landmarks ?? []).map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const group = groups.find((g) => g.key === v.group);

  // 按弧线自动排布:舞台后方(三块屏幕)留空,和起步数据一样
  const autoLayout = () => {
    const n = lms.length;
    setV((o) => ({
      ...o,
      landmarks: (o.landmarks ?? []).map((l, i) => {
        const a = ((-140 + (n > 1 ? (i * 280) / (n - 1) : 0)) * Math.PI) / 180;
        return { ...l, x: Math.round(Math.sin(a) * 95) / 10, z: Math.round(Math.cos(a) * 95) / 10, radius: 2.2 };
      }),
    }));
  };
  // 感悟场景:一键把分组下的主题都摆成地标
  const fillThemes = () => {
    if (!group) return;
    const props = ['pavilion', 'stele', 'lantern', 'willow', 'moongate'];
    setV((o) => ({
      ...o,
      landmarks: group.themes.map((t, i) => ({
        id: t.key, label: t.name, emoji: '🌙', hint: `读古人写「${t.name}」的句子`, actionLabel: `聊聊${t.name}`,
        x: 0, z: 8, radius: 2.2, solidRadius: 0.9, color: o.palette?.accent || '', prop: props[i % props.length], feed: 'insight', themeKey: t.key,
        prompt: `我们在「${t.name}」这里,给我讲一首写${t.name}的古诗,说说它为什么动人`,
      })),
    }));
    setTimeout(autoLayout, 0);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = { ...v, landmarks: lms.map((l) => ({ ...l, x: Number(l.x), z: Number(l.z), radius: Number(l.radius), solidRadius: Number(l.solidRadius) || 0 })) };
      await adminSavePlazaScene(body);
      onSaved();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>{v.id ? `编辑场景「${v.name}」` : '新建场景'}</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ flex: 1, minWidth: 300, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <TextField size="small" label="标识(英文)" value={v.key ?? ''} onChange={(e) => setV({ ...v, key: e.target.value })} disabled={v.key === 'plaza' && !!v.id} helperText="小写字母开头,如 court-wound" />
            <TextField size="small" label="名称" value={v.name ?? ''} onChange={(e) => setV({ ...v, name: e.target.value })} />
            <TextField size="small" label="介绍" value={v.intro ?? ''} onChange={(e) => setV({ ...v, intro: e.target.value })} multiline minRows={2} sx={{ gridColumn: '1 / -1' }} />
            <TextField size="small" select label="类型" value={v.kind ?? 'plaza'} onChange={(e) => setV({ ...v, kind: e.target.value as PlazaScene['kind'] })}>
              <MenuItem value="plaza">广场</MenuItem>
              <MenuItem value="insight">人生感悟庭院</MenuItem>
            </TextField>
            {v.kind === 'insight' ? (
              <TextField size="small" select label="感悟分组" value={v.group ?? ''} onChange={(e) => setV({ ...v, group: e.target.value })}>
                {groups.map((g) => <MenuItem key={g.key} value={g.key}>{g.name}</MenuItem>)}
              </TextField>
            ) : <Box />}
            <TextField size="small" select label="中央舞台" value={v.stage ?? 'concert'} onChange={(e) => setV({ ...v, stage: e.target.value })}>
              {Object.entries(STAGES).map(([k, n]) => <MenuItem key={k} value={k}>{n}</MenuItem>)}
            </TextField>
            <TextField size="small" select label="状态" value={v.status ?? 'draft'} onChange={(e) => setV({ ...v, status: e.target.value as PlazaScene['status'] })}>
              <MenuItem value="published">已发布</MenuItem>
              <MenuItem value="draft">草稿(用户看不到)</MenuItem>
            </TextField>
            {(['ground', 'path', 'accent'] as const).map((k) => (
              <TextField key={k} size="small" label={{ ground: '地面色', path: '小路色', accent: '强调色' }[k]} placeholder="#RRGGBB" value={v.palette?.[k] ?? ''}
                onChange={(e) => setV({ ...v, palette: { ...(v.palette ?? {}), [k]: e.target.value } })} />
            ))}
            <TextField size="small" select label="时辰" value={v.palette?.time ?? ''} onChange={(e) => setV({ ...v, palette: { ...(v.palette ?? {}), time: e.target.value } })}>
              {Object.entries(TIMES).map(([k, n]) => <MenuItem key={k || 'default'} value={k}>{n}</MenuItem>)}
            </TextField>
            <TextField size="small" select label="天气" value={v.palette?.weather ?? ''} onChange={(e) => setV({ ...v, palette: { ...(v.palette ?? {}), weather: e.target.value } })}>
              {Object.entries(WEATHERS).map(([k, n]) => <MenuItem key={k || 'default'} value={k}>{n}</MenuItem>)}
            </TextField>
            <TextField size="small" select label="草地" value={v.palette?.grass === undefined ? '' : v.palette.grass ? 'on' : 'off'}
              onChange={(e) => { const g = e.target.value; setV({ ...v, palette: { ...(v.palette ?? {}), grass: g === '' ? undefined : g === 'on' } }); }}>
              <MenuItem value="">按类型默认</MenuItem>
              <MenuItem value="on">长草</MenuItem>
              <MenuItem value="off">不长</MenuItem>
            </TextField>
            <TextField size="small" type="number" label="排序" value={v.sort ?? 0} onChange={(e) => setV({ ...v, sort: Number(e.target.value) })} />
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <LayoutPreview size={220} landmarks={lms} characters={characters} accent={v.palette?.accent} />
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>俯视:上方 = 舞台后方(三块屏幕),◆ = 人物</Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 3, mb: 1 }}>
          <Typography sx={{ fontWeight: 700, flex: 1 }}>地标({lms.length}/12)</Typography>
          {v.kind === 'insight' && group && <Button size="small" onClick={fillThemes}>用「{group.name}」的主题填满</Button>}
          <Button size="small" onClick={autoLayout} disabled={lms.length === 0}>按弧线自动排布</Button>
          <Button size="small" startIcon={<AddRoundedIcon />} disabled={lms.length >= 12}
            onClick={() => setV({ ...v, landmarks: [...lms, { id: `spot${lms.length + 1}`, label: '新地标', emoji: '✨', hint: '', actionLabel: '聊聊', x: 0, z: 8, radius: 2.2, solidRadius: 0.8, color: '', prop: 'pavilion', feed: v.kind === 'insight' ? 'insight' : 'none' }] })}>
            加地标
          </Button>
        </Box>
        {lms.map((l, i) => (
          <Paper key={i} variant="outlined" sx={{ p: 1.25, mb: 1, borderRadius: 2, display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(8, 1fr) auto' }, gap: 1, alignItems: 'center' }}>
            <TextField size="small" label="标识" value={l.id} onChange={(e) => setLm(i, { id: e.target.value })} />
            <TextField size="small" label="名称" value={l.label} onChange={(e) => setLm(i, { label: e.target.value })} />
            <TextField size="small" label="图标" value={l.emoji} onChange={(e) => setLm(i, { emoji: e.target.value })} />
            <TextField size="small" select label="造型" value={l.prop} onChange={(e) => setLm(i, { prop: e.target.value })}>
              {Object.entries(PROPS).map(([k, n]) => <MenuItem key={k} value={k}>{n}</MenuItem>)}
            </TextField>
            <TextField size="small" select label="面板" value={l.feed} onChange={(e) => setLm(i, { feed: e.target.value })}>
              {Object.entries(FEEDS).map(([k, n]) => <MenuItem key={k} value={k}>{n}</MenuItem>)}
            </TextField>
            {l.feed === 'insight' ? (
              <TextField size="small" select label="感悟主题" value={l.themeKey ?? ''} onChange={(e) => setLm(i, { themeKey: e.target.value })}>
                {groups.map((g) => [
                  <MenuItem key={`g-${g.key}`} disabled value={`__${g.key}`}>— {g.name} —</MenuItem>,
                  ...g.themes.map((t) => <MenuItem key={t.key} value={t.key}>{t.name}</MenuItem>),
                ])}
              </TextField>
            ) : <TextField size="small" label="颜色" placeholder="#RRGGBB" value={l.color} onChange={(e) => setLm(i, { color: e.target.value })} />}
            <TextField size="small" type="number" label="x" value={l.x} onChange={(e) => setLm(i, { x: e.target.value as unknown as number })} />
            <TextField size="small" type="number" label="z" value={l.z} onChange={(e) => setLm(i, { z: e.target.value as unknown as number })} />
            <Tooltip title="删掉这个地标">
              <IconButton size="small" onClick={() => setV({ ...v, landmarks: lms.filter((_, j) => j !== i) })}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
            </Tooltip>
            <TextField size="small" label="提示语" value={l.hint} onChange={(e) => setLm(i, { hint: e.target.value })} sx={{ gridColumn: { md: 'span 3' } }} />
            <TextField size="small" label="按钮字" value={l.actionLabel} onChange={(e) => setLm(i, { actionLabel: e.target.value })} />
            <TextField size="small" label="「让她聊聊」发给数字人的话" value={l.prompt ?? ''} onChange={(e) => setLm(i, { prompt: e.target.value })} sx={{ gridColumn: { md: 'span 5' } }} />
          </Paper>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" onClick={save} disabled={saving}>{saving ? '保存中…' : '保存'}</Button>
      </DialogActions>
    </Dialog>
  );
}

// ==================== 人物编辑 ====================

function CharacterEditor({ value, scenes, groups, onClose, onSaved }: { value: Partial<PlazaCharacter>; scenes: PlazaScene[]; groups: InsightGroup[]; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = React.useState<Partial<PlazaCharacter>>(value);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [suggest, setSuggest] = React.useState<{ author: string; poems: number }[] | null>(null);
  const scene = scenes.find((s) => s.key === v.sceneKey);

  const loadSuggest = async () => {
    if (!v.themeKey) return;
    try { setSuggest((await themePoets(v.themeKey))?.list ?? []); } catch (e) { setError(formatApiError(e)); }
  };
  // 放到某个地标旁边:地标靠中心一侧 2.3 米
  const nearLandmark = (id: string) => {
    const l = scene?.landmarks.find((x) => x.id === id);
    if (!l) return;
    const d = Math.hypot(l.x, l.z) || 1;
    setV({ ...v, x: Math.round((l.x - (l.x / d) * 2.3) * 10) / 10, z: Math.round((l.z - (l.z / d) * 2.3) * 10) / 10, themeKey: v.kind === 'poet' ? l.themeKey || v.themeKey : v.themeKey });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await adminSavePlazaCharacter({ ...v, x: Number(v.x), z: Number(v.z), sort: Number(v.sort) || 0 });
      onSaved();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{v.id ? '编辑人物' : '新建人物'}</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
          <TextField size="small" select label="场景" value={v.sceneKey ?? ''} onChange={(e) => setV({ ...v, sceneKey: e.target.value })}>
            {scenes.map((s) => <MenuItem key={s.key} value={s.key}>{s.name}</MenuItem>)}
          </TextField>
          <TextField size="small" select label="类型" value={v.kind ?? 'poet'} onChange={(e) => setV({ ...v, kind: e.target.value as PlazaCharacter['kind'] })}>
            <MenuItem value="poet">诗人(只说自己写过的句子)</MenuItem>
            <MenuItem value="guide">引路人(台词由你写)</MenuItem>
          </TextField>
          {v.kind === 'poet' ? (
            <>
              <TextField size="small" select label="说哪个感悟主题" value={v.themeKey ?? ''} onChange={(e) => { setV({ ...v, themeKey: e.target.value }); setSuggest(null); }}>
                {groups.map((g) => [
                  <MenuItem key={`g-${g.key}`} disabled value={`__${g.key}`}>— {g.name} —</MenuItem>,
                  ...g.themes.map((t) => <MenuItem key={t.key} value={t.key}>{t.name}</MenuItem>),
                ])}
              </TextField>
              <TextField size="small" label="诗人(语料写法,繁体)" value={v.poet ?? ''} onChange={(e) => setV({ ...v, poet: e.target.value })} helperText="留空 = 自动用写这个主题最多的名家" />
              <Box sx={{ gridColumn: '1 / -1' }}>
                <Button size="small" onClick={loadSuggest} disabled={!v.themeKey}>看看谁写这个主题最多</Button>
                {suggest && (
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1 }}>
                    {suggest.length === 0 && <Typography variant="caption" color="text.secondary">没查到</Typography>}
                    {suggest.map((s) => <Chip key={s.author} label={`${s.author} · ${s.poems} 首`} onClick={() => setV({ ...v, poet: s.author })} color={v.poet === s.author ? 'primary' : 'default'} />)}
                  </Box>
                )}
              </Box>
              <TextField size="small" label="显示名(可空,默认诗人本名)" value={v.name ?? ''} onChange={(e) => setV({ ...v, name: e.target.value })} />
            </>
          ) : (
            <>
              <TextField size="small" label="名字" value={v.name ?? ''} onChange={(e) => setV({ ...v, name: e.target.value })} />
              <TextField size="small" select label="开口先念哪个分组的题记" value={v.groupKey ?? ''} onChange={(e) => setV({ ...v, groupKey: e.target.value })}>
                <MenuItem value="">不念</MenuItem>
                {groups.map((g) => <MenuItem key={g.key} value={g.key}>{g.name}</MenuItem>)}
              </TextField>
              <TextField size="small" label="台词(一行一句,最多 8 句)" value={(v.lines ?? []).join('\n')} onChange={(e) => setV({ ...v, lines: e.target.value.split('\n') })} multiline minRows={3} sx={{ gridColumn: '1 / -1' }}
                helperText="引路人不要冒充历史人物说话;引用古诗请写明出处。" />
            </>
          )}
          <TextField size="small" label="头衔" value={v.title ?? ''} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="诗人 / 引路人" />
          <TextField size="small" label="颜色" placeholder="#RRGGBB" value={v.color ?? ''} onChange={(e) => setV({ ...v, color: e.target.value })} />
          <TextField size="small" type="number" label="x" value={v.x ?? 0} onChange={(e) => setV({ ...v, x: e.target.value as unknown as number })} />
          <TextField size="small" type="number" label="z" value={v.z ?? 0} onChange={(e) => setV({ ...v, z: e.target.value as unknown as number })} />
          {scene && scene.landmarks.length > 0 && (
            <TextField size="small" select label="站到地标旁" value="" onChange={(e) => nearLandmark(e.target.value)} sx={{ gridColumn: '1 / -1' }}>
              {scene.landmarks.map((l) => <MenuItem key={l.id} value={l.id}>{l.emoji} {l.label}</MenuItem>)}
            </TextField>
          )}
          <TextField size="small" select label="状态" value={v.status ?? 'published'} onChange={(e) => setV({ ...v, status: e.target.value as PlazaCharacter['status'] })}>
            <MenuItem value="published">已发布</MenuItem>
            <MenuItem value="draft">草稿</MenuItem>
          </TextField>
          <TextField size="small" type="number" label="排序" value={v.sort ?? 0} onChange={(e) => setV({ ...v, sort: Number(e.target.value) })} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" onClick={save} disabled={saving}>{saving ? '保存中…' : '保存'}</Button>
      </DialogActions>
    </Dialog>
  );
}

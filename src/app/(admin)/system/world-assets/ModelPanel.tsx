'use client';

/**
 * 后台「造物」(docs/WORLD-MODEL.md §6):世界模型里平台的数据,和玩家公开的东西的下架
 *
 *   - 平台原型:灯、座位、门、按钮……(JSON 编辑;match 决定哪些素材默认是它)。改过的不再被 kinds_seed.json 覆盖;
 *   - 物质:积木的材质(id = 积木里存的那个字节,定了别改;look 外观、props 物理属性),藏起来 = 面板里选不到、搭了的还在;
 *   - 玩家公开的原型 / 蓝图:不先审,出问题在这里下架(改成私有,本人还能用,别人看不到);
 *   - 声音库:平台自带的(Kenney CC0 + 合成的环境声)和后台传的;试听、改名 / 分类 / 循环、藏起来、上传。
 * 后端:/api/core/admin/world/kinds、/materials、/prefabs(看 system:plaza:view,改 system:plaza:manage)。
 */

import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { formatApiError } from '@/lib/api/client';
import {
  adminDeleteKind, adminHideMaterial, adminListKinds, adminListMaterials, adminListPrefabs, adminListSounds, adminSaveKind, adminSaveMaterial, adminSetPrefabVisibility,
  adminUpdateSound, adminUploadSound, worldFileUrl,
  type AdminWorldKind, type AdminWorldPrefab, type WorldMaterial, type WorldSoundRow,
} from '@/apis/world';

type TabKey = 'platform' | 'public' | 'materials' | 'prefabs' | 'sounds';

const mono = { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12.5 } as const;

/** 一个 JSON 编辑框的对话框 */
function JsonDialog({ title, initial, onSave, onClose, hint }: { title: string; initial: unknown; onSave: (v: Record<string, unknown>) => Promise<void>; onClose: () => void; hint?: string }) {
  const [text, setText] = React.useState(() => JSON.stringify(initial, null, 2));
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const save = async () => {
    let v: Record<string, unknown>;
    try { v = JSON.parse(text) as Record<string, unknown>; } catch (e) { setErr(`JSON 写错了:${(e as Error).message}`); return; }
    setBusy(true);
    setErr('');
    try { await onSave(v); onClose(); } catch (e) { setErr(formatApiError(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {hint && <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>{hint}</Typography>}
        <TextField multiline fullWidth minRows={14} maxRows={30} value={text} onChange={(e) => setText(e.target.value)} sx={{ '& textarea': mono }} />
        {err && <Alert severity="error" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>{err}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" disabled={busy} onClick={() => void save()}>{busy ? <CircularProgress size={16} /> : '保存'}</Button>
      </DialogActions>
    </Dialog>
  );
}

function kindDef(k: AdminWorldKind): Record<string, unknown> {
  const { ownerId: _o, owner: _w, visibility: _v, edited: _e, updatedAt: _u, ...def } = k;
  return def;
}

export function WorldModelPanel({ canManage }: { canManage: boolean }) {
  const [tab, setTab] = React.useState<TabKey>('platform');
  const [q, setQ] = React.useState('');
  const [kinds, setKinds] = React.useState<AdminWorldKind[] | null>(null);
  const [mats, setMats] = React.useState<WorldMaterial[] | null>(null);
  const [prefabs, setPrefabs] = React.useState<AdminWorldPrefab[] | null>(null);
  const [sounds, setSounds] = React.useState<WorldSoundRow[] | null>(null);
  const [soundCat, setSoundCat] = React.useState('');
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [msg, setMsg] = React.useState<{ text: string; severity: 'success' | 'error' } | null>(null);
  const [dialog, setDialog] = React.useState<{ title: string; initial: unknown; hint?: string; save: (v: Record<string, unknown>) => Promise<void> } | null>(null);

  const load = React.useCallback(() => {
    if (tab === 'platform' || tab === 'public') { setKinds(null); adminListKinds(tab, q).then(setKinds).catch((e) => { setKinds([]); setMsg({ text: formatApiError(e), severity: 'error' }); }); }
    if (tab === 'materials') { setMats(null); adminListMaterials().then(setMats).catch((e) => { setMats([]); setMsg({ text: formatApiError(e), severity: 'error' }); }); }
    if (tab === 'prefabs') { setPrefabs(null); adminListPrefabs(q).then(setPrefabs).catch((e) => { setPrefabs([]); setMsg({ text: formatApiError(e), severity: 'error' }); }); }
    if (tab === 'sounds') { setSounds(null); adminListSounds(q).then(setSounds).catch((e) => { setSounds([]); setMsg({ text: formatApiError(e), severity: 'error' }); }); }
  }, [tab, q]);
  React.useEffect(load, [load]);

  const act = async (fn: () => Promise<void>, ok: string) => {
    try { await fn(); setMsg({ text: ok, severity: 'success' }); load(); } catch (e) { setMsg({ text: formatApiError(e), severity: 'error' }); }
  };

  const loading = <Box sx={{ display: 'grid', placeItems: 'center', py: 3 }}><CircularProgress size={22} /></Box>;
  const row = (key: React.Key, main: React.ReactNode, sub: React.ReactNode, actions: React.ReactNode) => (
    <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>{main}</Box>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</Typography>
      </Box>
      {canManage && <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>{actions}</Box>}
    </Box>
  );

  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: 15, fontWeight: 800 }}>造物</Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>世界里的东西都是数据:原型(外观 + 属性 + 规则)、物质(积木材质)、蓝图。玩家公开的不先审,有问题在这里下架。</Typography>
      </Box>
      <Tabs value={tab} onChange={(_, v: TabKey) => setTab(v)} sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5 } }}>
        <Tab value="platform" label="平台原型" />
        <Tab value="public" label="玩家公开的原型" />
        <Tab value="materials" label="物质" />
        <Tab value="prefabs" label="玩家公开的蓝图" />
        <Tab value="sounds" label="声音库" />
      </Tabs>
      {msg && <Alert severity={msg.severity} onClose={() => setMsg(null)} sx={{ my: 1 }}>{msg.text}</Alert>}
      <Box sx={{ display: 'flex', gap: 1, my: 1 }}>
        {tab !== 'materials' && <TextField size="small" placeholder="搜 key / 名字" value={q} onChange={(e) => setQ(e.target.value)} sx={{ width: 240 }} />}
        {canManage && tab === 'platform' && (
          <Button size="small" variant="outlined" onClick={() => setDialog({ title: '新建平台原型', hint: 'key 不加前缀(不能像 u123. 开头);match 写了就让符合条件的素材默认是这个原型。', initial: { key: 'my-kind', name: '新原型', look: { shape: 'box', color: '#88ccff', size: [0.3, 0.3, 0.3] }, props: {}, state: {}, rules: [] }, save: (v) => adminSaveKind({ def: v }) })}>＋ 新平台原型</Button>
        )}
        {canManage && tab === 'materials' && (
          <Button size="small" variant="outlined" onClick={() => {
            const next = Math.max(-1, ...(mats ?? []).map((m) => m.id)) + 1;
            setDialog({ title: `新物质(id ${next})`, hint: 'pattern:plain / speckle / wood / brick / brushed / tile / cloth;props:solid、walkable、liquid {slow}、emits、transparent。', initial: { key: 'my-mat', name: '新物质', color: '#cccccc', look: { pattern: 'plain' }, props: { solid: true, walkable: true } }, save: (v) => adminSaveMaterial(next, v) });
          }}>＋ 新物质</Button>
        )}
      </Box>

      {(tab === 'platform' || tab === 'public') && (!kinds ? loading : kinds.length === 0 ? <Typography sx={{ fontSize: 13, color: 'text.secondary', py: 2 }}>没有</Typography> : kinds.map((k) => row(k.key,
        <>
          <Typography sx={{ fontWeight: 700 }}>{k.name || k.key}</Typography>
          <Typography sx={{ ...mono, color: 'text.secondary' }}>{k.key}{k.extends ? ` ← ${k.extends}` : ''}</Typography>
          {k.match && <Chip size="small" label="素材默认" />}
          {k.edited && <Chip size="small" color="warning" label="后台改过" />}
          {k.owner && <Chip size="small" label={`${k.owner.nickname}(${k.owner.id})`} />}
          {tab === 'public' && <Chip size="small" color={k.visibility === 'public' ? 'success' : 'default'} label={k.visibility === 'public' ? '公开中' : '已下架'} />}
        </>,
        `规则:${(k.rules ?? []).map((r) => r.on).join(' / ') || '无'} · 更新 ${new Date(k.updatedAt).toLocaleString()}`,
        tab === 'platform' ? (
          <>
            <Button size="small" onClick={() => setDialog({ title: `改平台原型 ${k.key}`, hint: '保存后不再被代码里的种子覆盖。', initial: kindDef(k), save: (v) => adminSaveKind({ key: k.key, def: v }) })}>改</Button>
            <Button size="small" color="error" onClick={() => { if (window.confirm(`删掉平台原型 ${k.key}?已经放出去的会变成不动的摆设(若还在种子里,重启后会再建出来)`)) void act(() => adminDeleteKind(k.key), '删掉了'); }}>删</Button>
          </>
        ) : (
          <>
            <Button size="small" onClick={() => setDialog({ title: `看 ${k.key}(只读,玩家的原型后台只能下架)`, initial: kindDef(k), save: async () => undefined })}>看</Button>
            {k.visibility === 'public'
              ? <Button size="small" color="error" onClick={() => void act(() => adminSaveKind({ key: k.key, visibility: 'private' }), '下架了')}>下架</Button>
              : <Button size="small" onClick={() => void act(() => adminSaveKind({ key: k.key, visibility: 'public' }), '恢复公开了')}>恢复</Button>}
          </>
        ),
      )))}

      {tab === 'materials' && (!mats ? loading : mats.map((m) => row(m.id,
        <>
          <Box sx={{ width: 16, height: 16, borderRadius: 0.5, bgcolor: m.color, opacity: m.look?.opacity ?? 1, border: '1px solid', borderColor: 'divider' }} />
          <Typography sx={{ fontWeight: 700 }}>{m.name}</Typography>
          <Typography sx={{ ...mono, color: 'text.secondary' }}>#{m.id} {m.key}</Typography>
          {m.hidden && <Chip size="small" label="已藏" />}
          {m.props?.solid === false && <Chip size="small" label="穿得过" />}
          {m.props?.liquid?.slow ? <Chip size="small" label={`减速 ${Math.round((m.props.liquid.slow) * 100)}%`} /> : null}
        </>,
        `纹理 ${m.look?.pattern ?? 'plain'}${m.look?.unlit ? ' · 自发光' : ''}${m.look?.opacity !== undefined && m.look.opacity < 1 ? ` · 透明 ${m.look.opacity}` : ''}`,
        <>
          <Button size="small" onClick={() => { const { id: _i, hidden: _h, ...def } = m; setDialog({ title: `改物质 #${m.id}`, hint: 'id 不变(积木里存的就是它)。', initial: def, save: (v) => adminSaveMaterial(m.id, v) }); }}>改</Button>
          {!m.hidden && <Button size="small" color="error" onClick={() => { if (window.confirm(`藏起物质「${m.name}」?已经搭了的不受影响,只是面板里选不到`)) void act(() => adminHideMaterial(m.id), '藏起来了'); }}>藏</Button>}
        </>,
      )))}

      {tab === 'prefabs' && (!prefabs ? loading : prefabs.length === 0 ? <Typography sx={{ fontSize: 13, color: 'text.secondary', py: 2 }}>没有</Typography> : prefabs.map((p) => row(p.key,
        <>
          <Typography sx={{ fontWeight: 700 }}>{p.name}</Typography>
          <Typography sx={{ ...mono, color: 'text.secondary' }}>{p.key}</Typography>
          {p.owner && <Chip size="small" label={`${p.owner.nickname}(${p.owner.id})`} />}
          <Chip size="small" color={p.visibility === 'public' ? 'success' : 'default'} label={p.visibility === 'public' ? '公开中' : '已下架'} />
        </>,
        `${p.intro || '—'} · ${p.items} 件${p.blocks ? ` · ${p.blocks} 块积木` : ''} · 更新 ${new Date(p.updatedAt).toLocaleString()}`,
        p.visibility === 'public'
          ? <Button size="small" color="error" onClick={() => void act(() => adminSetPrefabVisibility(p.key, 'private'), '下架了')}>下架</Button>
          : <Button size="small" onClick={() => void act(() => adminSetPrefabVisibility(p.key, 'public'), '恢复公开了')}>恢复</Button>,
      )))}

      {tab === 'sounds' && (
        <Box>
          <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            {['', 'ambient', 'sfx', 'ui', 'music'].map((c) => (
              <Chip key={c} size="small" label={c ? ({ ambient: '环境', sfx: '音效', ui: '界面', music: '音乐' } as Record<string, string>)[c] : '全部'} color={soundCat === c ? 'primary' : 'default'} onClick={() => setSoundCat(c)} />
            ))}
            {canManage && (
              <>
                <input ref={fileRef} type="file" accept="audio/ogg,audio/mpeg,audio/wav,audio/mp4,.ogg,.mp3,.wav,.m4a" hidden onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  const name = window.prompt('名字', f.name.replace(/\.[^.]+$/, '')) ?? '';
                  if (!name) return;
                  const category = window.prompt('分类(ambient 环境 / sfx 音效 / ui 界面 / music 音乐)', 'sfx') || 'sfx';
                  const loop = category === 'ambient';
                  void act(async () => { await adminUploadSound(f, { name, category, loop }); }, '传好了');
                }} />
                <Button size="small" variant="outlined" onClick={() => fileRef.current?.click()}>＋ 传一个声音(ogg / mp3 / wav,≤ 4MB)</Button>
              </>
            )}
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{sounds ? `${sounds.length} 个` : ''}</Typography>
          </Box>
          {!sounds ? loading : sounds.filter((s) => !soundCat || s.category === soundCat).slice(0, 300).map((s) => row(s.key,
            <>
              <Button size="small" sx={{ minWidth: 0, px: 0.75 }} onClick={() => { void new Audio(worldFileUrl(s.file)).play(); }}>▶</Button>
              <Typography sx={{ fontWeight: 700 }}>{s.name}</Typography>
              <Typography sx={{ ...mono, color: 'text.secondary' }}>{s.key}</Typography>
              <Chip size="small" label={s.category} />
              {s.loop && <Chip size="small" label="循环" />}
              {s.hidden && <Chip size="small" color="warning" label="已藏" />}
            </>,
            `${s.duration ? s.duration.toFixed(1) + ' 秒 · ' : ''}${s.source} · ${s.license}${s.tags ? ' · ' + s.tags : ''}`,
            <>
              <Button size="small" onClick={() => { const name = window.prompt('名字', s.name); if (name) void act(() => adminUpdateSound(s.key, { name }), '改好了'); }}>改名</Button>
              <Button size="small" onClick={() => void act(() => adminUpdateSound(s.key, { loop: !s.loop }), s.loop ? '不循环了' : '改成循环')}>{s.loop ? '不循环' : '循环'}</Button>
              <Button size="small" color={s.hidden ? 'primary' : 'error'} onClick={() => void act(() => adminUpdateSound(s.key, { hidden: !s.hidden }), s.hidden ? '放出来了' : '藏起来了')}>{s.hidden ? '放出来' : '藏'}</Button>
            </>,
          ))}
        </Box>
      )}

      {dialog && <JsonDialog title={dialog.title} hint={dialog.hint} initial={dialog.initial} onClose={() => setDialog(null)} onSave={async (v) => { await dialog.save(v); load(); }} />}
    </Paper>
  );
}

'use client';

/**
 * /system/world-assets —— 世界素材库(创世)
 *
 * 一张表(core-api world_asset)管三种东西:GLB 模型(可摆放)、VRM 形象(捏人底模)、高斯泼溅(房间外壳)。
 * 来源:Poly Haven CC0 目录(点了才现做)、用户上传(不审核,传上来就能用)、平台上传(这里)。
 * 这里能看统计和加工队列、按类型 / 状态 / 来源筛、3D 预览、改名字标签、下架、重新加工、删除(有人用要确认)。
 * 后端:/api/core/admin/world/*(看 system:plaza:view,改 system:plaza:manage)。
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
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
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import CircularProgress from '@mui/material/CircularProgress';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { useAuthority } from '@/contexts/AuthContext';
import { PERMISSIONS } from '@/lib/permissions';
import { formatApiError } from '@/lib/api/client';
import { mediaUrl } from '@/lib/media';
import {
  adminDeleteWorldAsset, adminListWorldAssets, adminRetryWorldAsset, adminRelodWorldAssets, adminUpdateWorldAsset, adminWorldStats,
  type AdminWorldAsset, type AdminWorldStats,
} from '@/apis/world';
import { WorldUpload } from '@/digital-human/scene-ui/WorldUpload';

const KINDS: Record<string, string> = { model: '模型', avatar: '形象', splat: '泼溅' };
const STATUS: Record<string, { label: string; color: 'success' | 'warning' | 'default' | 'error' | 'info' }> = {
  ready: { label: '可用', color: 'success' },
  processing: { label: '加工中', color: 'warning' },
  available: { label: '待现做', color: 'info' },
  failed: { label: '失败', color: 'error' },
  hidden: { label: '已下架', color: 'default' },
};
const SOURCES: Record<string, string> = { polyhaven: 'Poly Haven', upload: '上传' };
const WORLD_BASE = '/qq-media/world';
const fmtBytes = (b: number) => (!b ? '—' : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default function WorldAssetsPage() {
  return (
    <PermissionGuard
      need={PERMISSIONS.SYSTEM_PLAZA.VIEW}
      fallback={<Alert severity="warning" sx={{ m: 2 }}>你没有「世界素材库」权限(和广场共用 system:plaza:view)。请联系管理员在 /system/role 里授予。</Alert>}
    >
      <Inner />
    </PermissionGuard>
  );
}

function Inner() {
  const { can } = useAuthority();
  const canManage = can(PERMISSIONS.SYSTEM_PLAZA.MANAGE);
  const [stats, setStats] = React.useState<AdminWorldStats | null>(null);
  const [rows, setRows] = React.useState<AdminWorldAsset[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState<{ text: string; severity: 'success' | 'error' } | null>(null);
  const [f, setF] = React.useState({ kind: '', status: '', source: '', owner: '', q: '', sort: '' });
  const [qLive, setQLive] = React.useState('');
  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(30);
  const [edit, setEdit] = React.useState<AdminWorldAsset | null>(null);
  const [preview, setPreview] = React.useState<AdminWorldAsset | null>(null);
  const [uploadKind, setUploadKind] = React.useState<'model' | 'avatar' | 'splat'>('model');

  React.useEffect(() => { const t = window.setTimeout(() => setF((x) => ({ ...x, q: qLive.trim() })), 350); return () => window.clearTimeout(t); }, [qLive]);
  React.useEffect(() => { setPage(0); }, [f]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        adminListWorldAssets({ ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), page: page + 1, size }),
        adminWorldStats(),
      ]);
      setRows(r.list);
      setTotal(r.total);
      setStats(s);
    } catch (e) {
      setMsg({ text: formatApiError(e), severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [f, page, size]);
  React.useEffect(() => { void load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); setMsg({ text: ok, severity: 'success' }); void load(); } catch (e) { setMsg({ text: formatApiError(e), severity: 'error' }); }
  };

  const del = async (a: AdminWorldAsset) => {
    const warn = a.uses > 0 ? `\n\n还有 ${a.uses} 处在用(摆放 / 房间外壳 / 形象),会一并清掉。` : '';
    if (!window.confirm(`删除「${a.nameZh}」(${a.key})?文件也会从存储里删掉。${warn}`)) return;
    await act(() => adminDeleteWorldAsset(a.key, a.uses > 0), '删掉了');
  };

  const sumKind = (k: string) => (stats?.assets ?? []).filter((x) => (x.kind || 'model') === k).reduce((acc, x) => ({ n: acc.n + x.n, bytes: acc.bytes + x.bytes }), { n: 0, bytes: 0 });
  const jobs = (s: string) => stats?.jobs.find((j) => j.status === s)?.n ?? 0;

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, flex: 1 }}>世界素材库</Typography>
        {canManage && (
          <Tooltip title="给还没有三档(meshopt + KTX2)的已上架模型、没抽精简档的大泼溅排加工,一次 100 件">
            <Button onClick={() => void act(async () => { const r = await adminRelodWorldAssets(100); return r; }, '已排进加工队列')}>补齐分档</Button>
          </Tooltip>
        )}
        <Button startIcon={<RefreshRoundedIcon />} onClick={() => void load()}>刷新</Button>
      </Box>
      <Typography sx={{ color: 'text.secondary', fontSize: 13, mb: 2 }}>
        创世的模型、形象和高斯泼溅都在这里。用户上传不审核、传完即用;这里可以下架或删除。Poly Haven 目录里的模型第一次被用到时才下载加工。
      </Typography>
      {msg && <Alert severity={msg.severity} onClose={() => setMsg(null)} sx={{ mb: 2 }}>{msg.text}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(5, 1fr)' }, gap: 1.5, mb: 2 }}>
        {(['model', 'avatar', 'splat'] as const).map((k) => {
          const s = sumKind(k);
          return (
            <Paper key={k} variant="outlined" sx={{ p: 1.5 }}>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{KINDS[k]}</Typography>
              <Typography sx={{ fontSize: 22, fontWeight: 800 }}>{s.n}</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{fmtBytes(s.bytes)}</Typography>
            </Paper>
          );
        })}
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>房间 / 开放串门 / 捏过人</Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 800 }}>{stats?.rooms ?? '—'} / {stats?.publicRooms ?? '—'} / {stats?.avatars ?? '—'}</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>用户上传 {stats?.uploads ?? '—'} 件</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>加工队列</Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 800 }}>{jobs('queued')} 排队 · {jobs('running')} 在做</Typography>
          <Typography sx={{ fontSize: 12, color: jobs('failed') ? 'error.main' : 'text.secondary' }}>失败 {jobs('failed')} · 完成 {jobs('done')}</Typography>
        </Paper>
      </Box>
      {!!stats?.recentFailed?.length && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          最近加工失败:{stats.recentFailed.slice(0, 4).map((j) => `${j.assetKey}(${(j.error || '').slice(0, 60)})`).join(';')}
        </Alert>
      )}

      {canManage && (
        <Paper variant="outlined" sx={{ p: 1.5, mb: 2, display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', bgcolor: '#141826' }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>以平台名义上传</Typography>
          <TextField select size="small" value={uploadKind} onChange={(e) => setUploadKind(e.target.value as typeof uploadKind)} sx={{ minWidth: 110, '& .MuiInputBase-root': { color: '#fff' } }}>
            {Object.entries(KINDS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
          </TextField>
          <Box sx={{ flex: 1, minWidth: 260 }}>
            <WorldUpload key={uploadKind} kind={uploadKind} admin label={`上传${KINDS[uploadKind]}`} compact onUploaded={(a) => { setMsg({ text: `「${a.nameZh}」传好了(${STATUS[a.status]?.label ?? a.status})`, severity: 'success' }); void load(); }} />
          </Box>
        </Paper>
      )}

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
        <TextField size="small" placeholder="搜 key / 名字 / 标签" value={qLive} onChange={(e) => setQLive(e.target.value)} sx={{ minWidth: 220 }} />
        {([['kind', '类型', KINDS], ['status', '状态', Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [k, v.label]))], ['source', '来源', SOURCES], ['owner', '归属', { platform: '平台', user: '用户上传' }], ['sort', '排序', { bytes: '按大小', name: '按名字' }]] as const).map(([k, label, opts]) => (
          <TextField key={k} select size="small" label={label} value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} sx={{ minWidth: 110 }}>
            <MenuItem value="">{k === 'sort' ? '最近更新' : '全部'}</MenuItem>
            {Object.entries(opts).map(([v, t]) => <MenuItem key={v} value={v}>{t}</MenuItem>)}
          </TextField>
        ))}
      </Box>

      <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>名字</TableCell>
              <TableCell>类型</TableCell>
              <TableCell>来源</TableCell>
              <TableCell>状态</TableCell>
              <TableCell align="right">大小</TableCell>
              <TableCell align="right">面数 / 点数</TableCell>
              <TableCell align="right">在用</TableCell>
              <TableCell>公开</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((a) => {
              const st = STATUS[a.status] ?? { label: a.status, color: 'default' as const };
              return (
                <TableRow key={a.key} hover>
                  <TableCell sx={{ maxWidth: 260 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{a.nameZh}</Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary', wordBreak: 'break-all' }}>{a.key}{a.category ? ` · ${a.category}` : ''}</Typography>
                    {a.error && <Typography sx={{ fontSize: 11, color: 'error.main' }}>{a.error.slice(0, 120)}</Typography>}
                  </TableCell>
                  <TableCell>{KINDS[a.kind || 'model'] ?? a.kind}</TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 12 }}>{SOURCES[a.source] ?? a.source}</Typography>
                    {a.owner && <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{a.owner.nickname}</Typography>}
                  </TableCell>
                  <TableCell><Chip size="small" label={st.label} color={st.color} /></TableCell>
                  <TableCell align="right">
                    {fmtBytes(a.bytes)}
                    {!!a.lods?.length && (
                      <Tooltip title={a.lods.map((l, i) => `${['近', '中', '远'][i] ?? i}档 ${l.tris.toLocaleString()} 面 ${fmtBytes(l.bytes)}${l.ktx2 ? ` · ${l.ktx2} 张 KTX2` : ''}`).join('\n')}>
                        <Typography component="div" sx={{ fontSize: 11, color: 'success.main' }}>{a.lods.length} 档 · {a.lods.map((l) => fmtBytes(l.bytes)).join(' / ')}</Typography>
                      </Tooltip>
                    )}
                    {!!a.lite && <Typography component="div" sx={{ fontSize: 11, color: 'success.main' }}>有精简档</Typography>}
                  </TableCell>
                  <TableCell align="right">{a.kind === 'splat' ? (a.splats ? `${(a.splats / 10000).toFixed(1)} 万点` : '—') : a.polycount ? a.polycount.toLocaleString() : '—'}</TableCell>
                  <TableCell align="right">{a.uses || ''}</TableCell>
                  <TableCell>{a.ownerId === '0' ? '平台' : a.visibility === 'public' ? '公开' : '仅本人'}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="3D 预览"><span><IconButton size="small" disabled={!a.file} onClick={() => setPreview(a)}><VisibilityRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
                    {canManage && (
                      <>
                        <Tooltip title="编辑"><IconButton size="small" onClick={() => setEdit(a)}><EditRoundedIcon fontSize="small" /></IconButton></Tooltip>
                        {a.status === 'hidden'
                          ? <Tooltip title="恢复上架"><IconButton size="small" onClick={() => void act(() => adminUpdateWorldAsset(a.key, { status: a.file ? 'ready' : 'available' }), '恢复了')}><CheckCircleOutlineRoundedIcon fontSize="small" /></IconButton></Tooltip>
                          : <Tooltip title="下架(搜不到、抽屉里不出现;已经摆着的还在)"><IconButton size="small" onClick={() => void act(() => adminUpdateWorldAsset(a.key, { status: 'hidden' }), '下架了')}><BlockRoundedIcon fontSize="small" /></IconButton></Tooltip>}
                        {(((a.kind === 'model' || !a.kind) && (a.source === 'upload' || a.source === 'polyhaven')) || (a.kind === 'splat' && a.source === 'upload')) && (
                          <Tooltip title="重新加工"><IconButton size="small" onClick={() => void act(() => adminRetryWorldAsset(a.key), '排进加工队列了')}><ReplayRoundedIcon fontSize="small" /></IconButton></Tooltip>
                        )}
                        <Tooltip title="删除"><IconButton size="small" color="error" onClick={() => void del(a)}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></Tooltip>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {!loading && rows.length === 0 && (
              <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>没有符合条件的素材</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        {loading && <Box sx={{ display: 'grid', placeItems: 'center', py: 2 }}><CircularProgress size={22} /></Box>}
        <TablePagination component="div" count={total} page={page} rowsPerPage={size} rowsPerPageOptions={[30, 60, 100]}
          onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={(e) => { setSize(Number(e.target.value)); setPage(0); }} labelRowsPerPage="每页" />
      </Paper>

      {edit && <EditDialog asset={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); setMsg({ text: '改好了', severity: 'success' }); void load(); }} onError={(t) => setMsg({ text: t, severity: 'error' })} />}
      {preview && <PreviewDialog asset={preview} onClose={() => setPreview(null)} />}
    </Box>
  );
}

function EditDialog({ asset, onClose, onSaved, onError }: { asset: AdminWorldAsset; onClose: () => void; onSaved: () => void; onError: (t: string) => void }) {
  const [v, setV] = React.useState({ nameZh: asset.nameZh, tagsZh: asset.tagsZh ?? '', tagsEn: asset.tagsEn ?? '', category: asset.category ?? '', visibility: asset.visibility ?? 'public' });
  const [busy, setBusy] = React.useState(false);
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>编辑素材 · {asset.key}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
        <TextField label="中文名" value={v.nameZh} onChange={(e) => setV({ ...v, nameZh: e.target.value })} />
        <TextField label="中文标签(空格分隔;数字人按用户的话字面匹配它们)" value={v.tagsZh} onChange={(e) => setV({ ...v, tagsZh: e.target.value })} />
        <TextField label="英文标签(模型给的英文关键词匹配它们)" value={v.tagsEn} onChange={(e) => setV({ ...v, tagsEn: e.target.value })} />
        <TextField label="分类" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })} />
        {asset.ownerId !== '0' && (
          <TextField select label="公开" value={v.visibility} onChange={(e) => setV({ ...v, visibility: e.target.value as 'public' | 'private' })}>
            <MenuItem value="public">公开(别人能在素材库里用)</MenuItem>
            <MenuItem value="private">仅上传者本人</MenuItem>
          </TextField>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" disabled={busy} onClick={async () => {
          setBusy(true);
          try { await adminUpdateWorldAsset(asset.key, v); onSaved(); } catch (e) { onError(formatApiError(e)); } finally { setBusy(false); }
        }}>保存</Button>
      </DialogActions>
    </Dialog>
  );
}

/** 3D 预览:模型 / 形象用 GLTFLoader(VRM 也是 glTF),泼溅用 Spark;鼠标拖着转 */
function PreviewDialog({ asset, onClose }: { asset: AdminWorldAsset; onClose: () => void }) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const [state, setState] = React.useState<string>('载入中…');
  const url = mediaUrl(`${WORLD_BASE}/${asset.file}`);
  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const THREE = await import('three');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
      if (disposed) return;
      const w = host.clientWidth || 640, h = 420;
      const renderer = new THREE.WebGLRenderer({ antialias: asset.kind !== 'splat' });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
      renderer.setSize(w, h);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      host.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1b1e2a);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x444455, 1.6));
      const sun = new THREE.DirectionalLight(0xffffff, 1.8);
      sun.position.set(3, 5, 4);
      scene.add(sun);
      const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 2000);
      const controls = new OrbitControls(camera, renderer.domElement);
      const grid = new THREE.GridHelper(10, 20, 0x445066, 0x2b3142);
      scene.add(grid);
      let raf = 0;
      const frame = () => { controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(frame); };
      const frameObject = (box: InstanceType<typeof THREE.Box3>) => {
        const size = box.getSize(new THREE.Vector3()).length() || 2;
        const c = box.getCenter(new THREE.Vector3());
        controls.target.copy(c);
        camera.position.set(c.x + size * 0.8, c.y + size * 0.5, c.z + size * 0.9);
        camera.near = size / 200; camera.far = size * 50; camera.updateProjectionMatrix();
        grid.scale.setScalar(Math.max(0.2, size / 6));
        grid.position.y = box.min.y;
      };
      cleanup = () => { cancelAnimationFrame(raf); controls.dispose(); renderer.dispose(); host.innerHTML = ''; };
      try {
        if (asset.kind === 'splat') {
          const { SparkRenderer, SplatMesh } = await import('@sparkjsdev/spark');
          scene.add(new SparkRenderer({ renderer }) as unknown as InstanceType<typeof THREE.Object3D>);
          const mesh = new SplatMesh({ url, fileName: url.split('/').pop() }) as unknown as InstanceType<typeof THREE.Object3D> & { initialized: Promise<unknown>; getBoundingBox: (c?: boolean) => InstanceType<typeof THREE.Box3> };
          scene.add(mesh);
          frame();
          await mesh.initialized;
          if (disposed) return;
          frameObject(mesh.getBoundingBox(true));
        } else {
          const [{ GLTFLoader }, { DRACOLoader }, { MeshoptDecoder }] = await Promise.all([
            import('three/examples/jsm/loaders/GLTFLoader.js'),
            import('three/examples/jsm/loaders/DRACOLoader.js'),
            import('three/examples/jsm/libs/meshopt_decoder.module.js'),
          ]);
          const loader = new GLTFLoader();
          const draco = new DRACOLoader();
          draco.setDecoderPath('/draco/');
          loader.setDRACOLoader(draco);
          loader.setMeshoptDecoder(MeshoptDecoder);
          const gltf = await loader.loadAsync(url);
          draco.dispose();
          if (disposed) return;
          scene.add(gltf.scene);
          frameObject(new THREE.Box3().setFromObject(gltf.scene));
          frame();
        }
        setState('');
      } catch (e) {
        setState(`载入失败:${(e as Error)?.message || e}`);
      }
    })();
    return () => { disposed = true; cleanup(); };
  }, [asset.kind, url]);
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{asset.nameZh} <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>{asset.file}</Typography></DialogTitle>
      <DialogContent>
        <Box ref={hostRef} sx={{ width: '100%', height: 420, borderRadius: 1, overflow: 'hidden', bgcolor: '#1b1e2a' }} />
        {state && <Typography sx={{ mt: 1, fontSize: 13, color: state.startsWith('载入失败') ? 'error.main' : 'text.secondary' }}>{state}</Typography>}
      </DialogContent>
      <DialogActions>
        <Button href={url} target="_blank" rel="noopener noreferrer">下载原文件</Button>
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
}

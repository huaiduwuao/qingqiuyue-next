/**
 * scene-ui/WorldUpload.tsx — 创世:上传自己的素材(不审核,传完就能用)
 *
 *   模型 .glb(单文件,贴图打包在里面)→ 小于 12MB 的马上能摆,后台再减面压缩换成加工版
 *   形象 .vrm                           → 捏人面板里当底模
 *   泼溅 .spz / .splat / .ksplat / .ply  → 房间外壳;.ply 先在浏览器里转成 .spz(体积约十分之一)再传
 *
 * 选完文件弹一张小卡片填名字、分类、要不要公开给别人用,然后带进度上传。
 */

import React from 'react';
import { Box, Button, ButtonBase, Checkbox, FormControlLabel, LinearProgress, MenuItem, TextField, Typography } from '@mui/material';
import { uploadWorldAsset, type WorldAssetFull } from '@/apis/world';
import { errMessage } from '@/lib/errMessage';

export const UPLOAD_CATEGORIES: { value: string; label: string }[] = [
  { value: 'furniture', label: '家具' },
  { value: 'decorative', label: '装饰' },
  { value: 'lighting', label: '灯' },
  { value: 'plants', label: '植物' },
  { value: 'rocks', label: '石头' },
  { value: 'props', label: '器物' },
  { value: 'building', label: '建筑' },
  { value: 'vehicle', label: '交通工具' },
  { value: 'character', label: '人物 / 动物' },
  { value: 'other', label: '其他' },
];

const ACCEPT: Record<'model' | 'avatar' | 'splat', string> = {
  model: '.glb',
  avatar: '.vrm,.glb',
  splat: '.spz,.splat,.ksplat,.ply',
};

const HINT: Record<'model' | 'avatar' | 'splat', string> = {
  model: '单个 .glb 文件(贴图打包在里面),最大 80MB',
  avatar: 'VRM 0.x / 1.0 形象(VRoid 导出的就行),最大 60MB',
  splat: '3DGS 训练好的 .ply / .spz / .splat(手机扫描 App 可导出),最大 200MB;.ply 会先在浏览器里转成 .spz',
};

/** .ply → .spz(Spark 在浏览器里转,扔掉透明度很低的点,球谐只留 1 阶) */
async function plyToSpz(file: File): Promise<Blob> {
  const { transcodeSpz, SplatFileType } = await import('@sparkjsdev/spark');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const out = await transcodeSpz({ inputs: [{ fileBytes: bytes, fileType: SplatFileType.PLY, pathOrUrl: file.name }], maxSh: 1, opacityThreshold: 0.02 });
  return new Blob([out.fileBytes as BlobPart], { type: 'application/octet-stream' });
}

export interface WorldUploadProps {
  kind: 'model' | 'avatar' | 'splat';
  label?: string;
  onUploaded: (a: WorldAssetFull) => void;
  toast?: (icon: string, text: string) => void;
  /** 后台:以平台名义传(公开,不占个人额度) */
  admin?: boolean;
  compact?: boolean;
}

export function WorldUpload({ kind, label, onUploaded, toast, admin, compact }: WorldUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [name, setName] = React.useState('');
  const [category, setCategory] = React.useState('furniture');
  const [share, setShare] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState(0);
  const [err, setErr] = React.useState<string | null>(null);

  const pick = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setName(f.name.replace(/\.[^.]+$/, '').slice(0, 32));
    setErr(null);
    setProgress(0);
  };

  const submit = async () => {
    if (!file) return;
    setErr(null);
    try {
      let blob: Blob = file;
      let filename = file.name;
      if (kind === 'splat' && /\.ply$/i.test(file.name)) {
        setBusy('正在转换成 SPZ…');
        try {
          blob = await plyToSpz(file);
          filename = file.name.replace(/\.ply$/i, '.spz');
        } catch {
          // 转不了就传原文件(服务端也收 PLY)
          blob = file;
        }
      }
      setBusy('上传中…');
      const a = await uploadWorldAsset(
        { file: blob, filename, name: name.trim() || undefined, category: kind === 'model' ? category : kind === 'avatar' ? 'character' : 'other', visibility: admin || share ? 'public' : 'private' },
        (r) => setProgress(r),
        admin,
      );
      toast?.('📦', a.status === 'ready' ? `「${a.nameZh}」传好了` : `「${a.nameZh}」传好了,正在加工`);
      onUploaded(a);
      setFile(null);
    } catch (e) {
      setErr(errMessage(e) || '上传失败');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Box>
      <input ref={inputRef} type="file" accept={ACCEPT[kind]} hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      {!file ? (
        <ButtonBase
          onClick={() => inputRef.current?.click()}
          sx={{ width: '100%', py: compact ? 0.75 : 1.25, borderRadius: 2, border: '1px dashed rgba(255,255,255,0.3)', color: '#cfefff', fontSize: 13, fontWeight: 700, flexDirection: 'column', gap: 0.25 }}
        >
          <span>⬆ {label ?? '上传'}</span>
          {!compact && <Typography component="span" sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 400, px: 1 }}>{HINT[kind]}</Typography>}
        </ButtonBase>
      ) : (
        <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', wordBreak: 'break-all' }}>
            {file.name} · {(file.size / 1048576).toFixed(1)} MB
          </Typography>
          <TextField size="small" label="名字" value={name} onChange={(e) => setName(e.target.value.slice(0, 32))} disabled={!!busy}
            slotProps={{ inputLabel: { sx: { color: 'rgba(255,255,255,0.6)' } }, htmlInput: { sx: { color: '#fff' } } }} />
          {kind === 'model' && (
            <TextField select size="small" label="分类" value={category} onChange={(e) => setCategory(e.target.value)} disabled={!!busy}
              slotProps={{ inputLabel: { sx: { color: 'rgba(255,255,255,0.6)' } }, input: { sx: { color: '#fff' } } }}>
              {UPLOAD_CATEGORIES.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
            </TextField>
          )}
          {!admin && (
            <FormControlLabel
              control={<Checkbox size="small" checked={share} onChange={(e) => setShare(e.target.checked)} disabled={!!busy} sx={{ color: 'rgba(255,255,255,0.5)' }} />}
              label={<Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>公开到素材库,别人也能用</Typography>}
            />
          )}
          {busy && (
            <Box>
              <Typography sx={{ fontSize: 11, color: '#9be8ff', mb: 0.5 }}>{busy}{busy === '上传中…' ? ` ${Math.round(progress * 100)}%` : ''}</Typography>
              <LinearProgress variant={busy === '上传中…' ? 'determinate' : 'indeterminate'} value={progress * 100} />
            </Box>
          )}
          {err && <Typography sx={{ fontSize: 12, color: '#ff9b9b' }}>{err}</Typography>}
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button size="small" onClick={() => setFile(null)} disabled={!!busy} sx={{ color: 'rgba(255,255,255,0.6)' }}>取消</Button>
            <Button size="small" variant="contained" onClick={() => void submit()} disabled={!!busy}>上传</Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}

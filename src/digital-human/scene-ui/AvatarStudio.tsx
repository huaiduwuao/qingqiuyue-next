/**
 * scene-ui/AvatarStudio.tsx — 创世:捏人 / 捏脸
 *
 * 四页:底模(站内模型、写实人物、自己上传的 VRM)/ 身材(骨骼比例)/ 脸(眼睛大小 + 写实底模的五官形变)/ 颜色。
 * 拖滑杆实时套到舞台上的形象(VrmStage.applyAvatarParams),点「保存」才存到服务端(world_avatar),
 * 下次进来、换场景、串门时都是这个样子。换底模会重新加载模型,参数原样套上去。
 */

import React from 'react';
import { Box, Button, ButtonBase, CircularProgress, IconButton, Slider, Typography } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { browseAssets, type AvatarParams, type WorldAssetFull } from '@/apis/world';
import { BODY_SLIDERS, FACE_SLIDER_LABELS, type AvatarInfo, type ColorSlot } from '../vrm/avatarCustomize';

const glass = { bgcolor: 'rgba(10,12,24,0.82)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' } as const;

export interface AvatarBase { base: string; name: string; hint?: string; faceable?: boolean }

/** 平台提供的写实底模(scripts/blender/make_avatar.py 烘的,带五官形变的可以细捏脸) */
export const REAL_BASES: AvatarBase[] = [
  { base: 'avatars/face/real_f01.vrm', name: '写实 · 青丘月', hint: '襦裙,可细捏五官', faceable: true },
  { base: 'avatars/face/poet_young.vrm', name: '写实 · 少年书生', hint: '圆领袍,可细捏五官', faceable: true },
  { base: 'avatars/face/poet_mid.vrm', name: '写实 · 中年文士', hint: '幞头长衫,可细捏五官', faceable: true },
  { base: 'avatars/face/guide.vrm', name: '写实 · 引路人', hint: '可细捏五官', faceable: true },
];

const COLOR_LABELS: Record<ColorSlot, string> = { skin: '肤色', hair: '发色', eyes: '瞳色', outfit: '衣服' };
const SWATCHES: Record<ColorSlot, string[]> = {
  skin: ['#fff1e6', '#f6d8c4', '#e8bf9f', '#c99474', '#8d5a3c'],
  hair: ['#2b211c', '#6b4b36', '#b7864f', '#e6cf9e', '#c24a4a', '#6f7fd8', '#cfcfd6'],
  eyes: ['#3a2a20', '#6b4b2e', '#3f6fae', '#3f8f5f', '#9c4fc4', '#c43f5a'],
  outfit: ['#ffffff', '#d9434b', '#3b6fd8', '#2f9e6a', '#e0b13a', '#26262e', '#f2a6c8'],
};

type Tab = 'base' | 'body' | 'face' | 'color';

export interface AvatarStudioProps {
  /** 站内模型(vrm_models) */
  siteBases: AvatarBase[];
  base: string;
  params: AvatarParams;
  info: AvatarInfo | null;
  loading?: boolean;
  dirty: boolean;
  saving?: boolean;
  onBase: (b: AvatarBase) => void;
  onParams: (p: AvatarParams) => void;
  onSave: () => void;
  onReset: () => void;
  onClose: () => void;
  toast: (icon: string, text: string) => void;
  narrow?: boolean;
  /** 上传形象(WorldUpload)由页面传进来,省得这里再依赖一份 */
  uploader?: React.ReactNode;
  /** 刚上传的形象(页面收到后塞进列表) */
  extraBases?: AvatarBase[];
}

export function AvatarStudio(props: AvatarStudioProps) {
  const { siteBases, base, params, info, dirty, onParams, narrow } = props;
  const [tab, setTab] = React.useState<Tab>('body');
  const [mine, setMine] = React.useState<AvatarBase[] | null>(null);
  React.useEffect(() => {
    browseAssets({ kind: 'avatar', size: 60 }).then((r) => setMine(r.list.filter((a: WorldAssetFull) => a.file).map((a) => ({ base: a.file, name: a.nameZh, hint: a.source === 'upload' ? '上传的形象' : undefined }))))
      .catch(() => setMine([]));
  }, []);
  const bases = [...siteBases, ...REAL_BASES, ...(props.extraBases ?? []), ...(mine ?? [])].filter((b, i, arr) => arr.findIndex((x) => x.base === b.base) === i);

  const body = params.body ?? {};
  const face = params.face ?? {};
  const colors = params.colors ?? {};
  const setBody = (k: string, v: number) => onParams({ ...params, body: { ...body, [k]: v } });
  const setFace = (k: string, v: number) => onParams({ ...params, face: { ...face, [k]: v } });
  const setColor = (k: ColorSlot, v: string | undefined) => {
    const next = { ...colors };
    if (v) next[k] = v; else delete next[k];
    onParams({ ...params, colors: next });
  };

  const panelSx = narrow
    ? { position: 'absolute' as const, zIndex: 6, left: 8, right: 8, bottom: 'calc(min(46vh, 460px) + 64px)', maxHeight: '44vh' }
    : { position: 'absolute' as const, zIndex: 6, left: 16, top: 'calc(64px + var(--sat, 0px))', width: 340, maxHeight: 'calc(100vh - min(40vh, 400px) - 96px)' };

  const slider = (key: string, label: string, value: number, min: number, max: number, step: number, onChange: (v: number) => void, fmt: (v: number) => string) => (
    <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Typography sx={{ fontSize: 12, width: 76, flexShrink: 0, color: 'rgba(255,255,255,0.75)' }}>{label}</Typography>
      <Slider size="small" min={min} max={max} step={step} value={value} onChange={(_, v) => onChange(v as number)} onDoubleClick={() => onChange(min < 0 ? 0 : 1)} />
      <Typography sx={{ fontSize: 11, width: 38, textAlign: 'right', color: 'rgba(255,255,255,0.55)' }}>{fmt(value)}</Typography>
    </Box>
  );
  const pct = (v: number) => `${v >= 1 ? '+' : ''}${Math.round((v - 1) * 100)}%`;
  const sgn = (v: number) => (v === 0 ? '0' : `${v > 0 ? '+' : ''}${Math.round(v * 100)}`);

  return (
    <Box sx={{ ...panelSx, ...glass, borderRadius: 3, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, pt: 1.25, pb: 0.5, gap: 0.5 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 800, flex: 1 }}>🧑‍🎨 捏人</Typography>
        {props.loading && <CircularProgress size={16} />}
        <IconButton size="small" aria-label="关闭" onClick={props.onClose} sx={{ color: 'rgba(255,255,255,0.6)' }}><CloseRoundedIcon fontSize="small" /></IconButton>
      </Box>
      <Box sx={{ display: 'flex', gap: 0.75, px: 1.5, mb: 1 }}>
        {([['base', '底模'], ['body', '身材'], ['face', '脸'], ['color', '颜色']] as const).map(([k, t]) => (
          <ButtonBase key={k} onClick={() => setTab(k)} sx={{ px: 1.25, py: 0.4, borderRadius: 999, fontSize: 12, fontWeight: 700, bgcolor: tab === k ? 'rgba(37,244,238,0.18)' : 'rgba(255,255,255,0.06)', color: tab === k ? '#25F4EE' : 'rgba(255,255,255,0.75)' }}>{t}</ButtonBase>
        ))}
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, pb: 1 }}>
        {tab === 'base' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {bases.map((b) => {
              const active = b.base === base;
              return (
                <ButtonBase key={b.base} onClick={() => props.onBase(b)} sx={{ display: 'block', textAlign: 'left', p: 1, borderRadius: 2, bgcolor: active ? 'rgba(37,244,238,0.16)' : 'rgba(255,255,255,0.05)', border: `1px solid ${active ? '#25F4EE' : 'transparent'}` }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{b.name}{active ? ' · 当前' : ''}</Typography>
                  {b.hint && <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{b.hint}</Typography>}
                </ButtonBase>
              );
            })}
            {mine === null && <CircularProgress size={16} />}
            <Box sx={{ mt: 0.5 }}>{props.uploader}</Box>
          </Box>
        )}

        {tab === 'body' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            {BODY_SLIDERS.map((s) => slider(s.key, s.label, Number(body[s.key] ?? 1), s.min, s.max, 0.01, (v) => setBody(s.key, v), pct))}
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', mt: 0.5 }}>双击滑杆回到原样。比例改动只拉长 / 放宽骨头,手、脚、头的大小不变。</Typography>
          </Box>
        )}

        {tab === 'face' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            {info?.eyeBones !== false && slider('eyes', '眼睛大小', Number(face.eyes ?? 1), 0.8, 1.25, 0.01, (v) => setFace('eyes', v), pct)}
            {(info?.faceSliders ?? []).map((k) => slider(k, FACE_SLIDER_LABELS[k] ?? k, Number(face[k] ?? 0), -1, 1, 0.02, (v) => setFace(k, v), sgn))}
            {info && info.faceSliders.length === 0 && (
              <Box sx={{ mt: 1, p: 1, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.05)' }}>
                <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>
                  这个底模没有五官形变,只能调眼睛大小。换一个「写实」底模,脸宽、下巴、鼻子、嘴、眼型、眉毛都能细捏。
                </Typography>
                <Button size="small" onClick={() => setTab('base')} sx={{ mt: 0.5, color: '#9be8ff' }}>去换底模</Button>
              </Box>
            )}
          </Box>
        )}

        {tab === 'color' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {(Object.keys(COLOR_LABELS) as ColorSlot[]).filter((k) => !info || info.colorSlots[k] > 0).map((k) => (
              <Box key={k}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.75)', flex: 1 }}>{COLOR_LABELS[k]}</Typography>
                  <Box component="input" type="color" value={colors[k] ?? '#ffffff'} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setColor(k, e.target.value)}
                    sx={{ width: 28, height: 22, p: 0, border: 'none', bgcolor: 'transparent', cursor: 'pointer' }} />
                  {colors[k] && <Button size="small" onClick={() => setColor(k, undefined)} sx={{ minWidth: 0, color: 'rgba(255,255,255,0.55)', fontSize: 11 }}>原色</Button>}
                </Box>
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                  {SWATCHES[k].map((c) => (
                    <ButtonBase key={c} aria-label={c} onClick={() => setColor(k, c)} sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: c, border: colors[k] === c ? '2px solid #25F4EE' : '1px solid rgba(255,255,255,0.3)' }} />
                  ))}
                </Box>
              </Box>
            ))}
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>颜色叠在原来的贴图上,深色的头发染浅色效果有限。</Typography>
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 1, px: 1.5, py: 1, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <Button size="small" onClick={props.onReset} sx={{ color: 'rgba(255,255,255,0.6)' }}>全部还原</Button>
        <Box sx={{ flex: 1 }} />
        <Button size="small" variant="contained" disabled={!dirty || props.saving} onClick={props.onSave}>{props.saving ? '保存中…' : dirty ? '保存' : '已保存'}</Button>
      </Box>
    </Box>
  );
}

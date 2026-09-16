'use client';

/**
 * ClipAvatar —— 2D 数字人:按状态/动作切换视频片段(真人录制或生成的 talking-head)。
 *
 * 和 VRM / 3DGS 舞台并列的第三种形象,同一套对话、面板、工具日志;区别只是没有骨骼,
 * 动作靠片段表(clips.json)映射。一次性动作播完自动回到当前状态片段。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { normalizeClips, pickClip, type AvatarSpeakState, type ClipEntry } from './clip-avatar';

export interface ClipAvatarProps {
  /** 片段表地址,默认 public/avatar/clips.json */
  clipsUrl?: string;
  state: AvatarSpeakState;
  /** 最近一次动作名(<action:x/> 或 scene_act),有对应片段就播一次 */
  action?: string;
  sx?: React.CSSProperties;
}

export default function ClipAvatar({ clipsUrl = '/avatar/clips.json', state, action, sx }: ClipAvatarProps) {
  const [clips, setClips] = useState<Record<string, ClipEntry>>({});
  const [error, setError] = useState<string | null>(null);
  const [oneShotDone, setOneShotDone] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const ac = new AbortController();
    fetch(clipsUrl, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => setClips(normalizeClips(j)))
      .catch((e) => { if (e?.name !== 'AbortError') setError(e?.message || '片段表加载失败'); });
    return () => ac.abort();
  }, [clipsUrl]);

  // 同一个动作播完一次就不再重复,直到动作变了
  useEffect(() => { setOneShotDone(null); }, [action]);
  const pick = useMemo(
    () => pickClip(clips, state, oneShotDone && oneShotDone === action ? undefined : action),
    [clips, state, action, oneShotDone],
  );

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !pick) return;
    if (v.getAttribute('data-key') !== pick.key) {
      v.setAttribute('data-key', pick.key);
      v.src = pick.url;
      v.loop = pick.loop;
      v.play().catch(() => {});
    }
  }, [pick]);

  return (
    <Box sx={{ position: 'absolute', inset: 0, background: '#05060B', display: 'flex', alignItems: 'center', justifyContent: 'center', ...sx }}>
      {pick ? (
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          onEnded={() => { if (pick && !pick.loop) setOneShotDone(pick.key); }}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          aria-label={`2D 数字人 · ${pick.key}`}
        />
      ) : (
        <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
          {error ? `2D 片段表加载失败:${error}` : '没有可用的 2D 片段(public/avatar/clips.json)'}
        </Typography>
      )}
    </Box>
  );
}

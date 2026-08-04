'use client';

/**
 * VirtualBrowser —— 数字人「虚拟浏览器」统一显示器
 *
 * 取代两处各自为政的 iframe 弹窗 (Immersive 的 inline 块 + Floating 的 ExternalViewer):
 *   - 地址栏显示当前 URL + 手动输入跳转
 *   - 视频模式: 真实 <video> 播放 (原声) + 「原声/静音」切换 + 自动播放
 *   - 网页模式: iframe 嵌入, 受 X-Frame-Options 拒载时给 fallback 提示
 *   - 「新标签打开」 + 关闭
 *   - 暗色科幻风格, 与数字人舞台一致
 */

import React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import type { IframeOpenTarget } from './virtual-browser';
import { toProxyUrl } from './virtual-browser';

export interface VirtualBrowserProps {
  /** 要显示的目标 (由 parseIframeUI / resolveIframeUrl 产出) */
  target: IframeOpenTarget;
  /** 显示器标题 (LLM 给的 title) */
  title?: string;
  onClose: () => void;
  /** 摆放方式: stage=舞台右上角显示器(Immersive), modal=全屏居中模态(Floating 浮窗) */
  placement?: 'stage' | 'modal';
}

export function VirtualBrowser({ target, title, onClose, placement = 'stage' }: VirtualBrowserProps) {
  // 地址栏编辑态
  const [editing, setEditing] = React.useState(false);
  const [addr, setAddr] = React.useState(target.url);
  // 当前实际加载的 URL (换地址后 = 新 url)
  const [activeUrl, setActiveUrl] = React.useState(target.url);
  // 当前模式 (video/normal 可手动切换, 但保留解析器给的方向)
  const [mode, setMode] = React.useState<'video' | 'normal' | 'tab'>(target.mode);
  // 视频原声开关 (默认关 → 浏览器自动播放策略才允许; 用户点开 → 原声)
  const [soundOn, setSoundOn] = React.useState(false);
  // iframe 是否被 X-Frame-Options 拒载 (onload 时判断白屏不可靠, 用「显示 fallback 条」)
  const [reloadKey, setReloadKey] = React.useState(0);

  // target 变化 (LLM 新指令) → 重置状态
  React.useEffect(() => {
    setAddr(target.url);
    setActiveUrl(target.url);
    setMode(target.mode);
  }, [target]);

  const submitAddr = () => {
    const raw = addr.trim();
    if (!raw) return;
    const next = raw.match(/^https?:\/\//) ? raw : `https://${raw}`;
    setActiveUrl(next);
    setEditing(false);
  };

  const isVideo = mode === 'video';
  const isModal = placement === 'modal';

  return (
    <Box
      sx={{
        position: isModal ? 'fixed' : 'absolute',
        inset: isModal ? 0 : undefined,
        top: isModal ? undefined : 60,
        right: isModal ? undefined : 520,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        bgcolor: isModal ? 'rgba(0,0,0,0.75)' : 'transparent',
        backdropFilter: isModal ? 'blur(8px)' : 'none',
      }}
    >
    <Box
      sx={{
        position: 'relative',
        width: isModal ? 'min(92vw, 900px)' : 560,
        height: isModal ? 'min(80vh, 640px)' : 420,
        maxWidth: '100%',
        bgcolor: 'rgba(10,12,20,0.96)',
        borderRadius: 3,
        border: '2px solid rgba(37,244,238,0.3)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* 顶部: 地址栏 + 动作按钮 */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 0.5,
        px: 1, py: 0.5, borderBottom: '1px solid rgba(255,255,255,0.08)',
        bgcolor: 'rgba(20,24,40,0.6)',
      }}>
        {/* 锁/模式标 */}
        <Box sx={{
          width: 18, height: 18, flexShrink: 0, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: isVideo ? 'rgba(255,79,216,0.18)' : 'rgba(37,244,238,0.15)',
          color: isVideo ? '#ff4fd8' : '#25F4EE',
        }}>
          {isVideo ? <VolumeUpRoundedIcon sx={{ fontSize: 12 }} /> : <LockRoundedIcon sx={{ fontSize: 12 }} />}
        </Box>

        {/* 地址栏 */}
        {editing ? (
          <Box
            component="input"
            autoFocus
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            onBlur={submitAddr}
            onKeyDown={(e) => { if (e.key === 'Enter') submitAddr(); if (e.key === 'Escape') setEditing(false); }}
            sx={{
              flex: 1, px: 1, py: 0.4, borderRadius: 1,
              bgcolor: 'rgba(255,255,255,0.12)', color: '#fff', outline: 'none',
              border: '1px solid rgba(37,244,238,0.4)',
              fontFamily: 'monospace', fontSize: 12,
            }}
          />
        ) : (
          <Box
            onClick={() => { setEditing(true); setAddr(activeUrl); }}
            title={activeUrl}
            sx={{
              flex: 1, px: 1.5, py: 0.5, borderRadius: 1,
              bgcolor: 'rgba(255,255,255,0.06)', fontFamily: 'monospace',
              fontSize: 12, color: 'rgba(255,255,255,0.7)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              cursor: 'text',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
            }}
          >
            {activeUrl}
          </Box>
        )}

        {/* 刷新 */}
        <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.7)' }} onClick={() => setReloadKey((k) => k + 1)}>
          <RefreshRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>

        {/* 视频原声开关 (仅视频模式) */}
        {isVideo && (
          <IconButton
            size="small"
            onClick={() => setSoundOn((s) => !s)}
            sx={{ color: soundOn ? '#25F4EE' : 'rgba(255,255,255,0.7)' }}
            title={soundOn ? '关闭原声' : '打开原声'}
          >
            {soundOn ? <VolumeUpRoundedIcon sx={{ fontSize: 16 }} /> : <VolumeOffRoundedIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        )}

        {/* 新标签打开 */}
        <IconButton
          size="small"
          sx={{ color: 'rgba(255,255,255,0.7)' }}
          onClick={() => window.open(target.rawUrl || target.url, '_blank', 'noopener,noreferrer')}
          title="新标签打开"
        >
          <OpenInNewRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>

        {/* 关闭 */}
        <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.7)' }} title="关闭">
          <CloseRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {/* 标题条 */}
      {title && (
        <Box sx={{ px: 1.5, py: 0.3, bgcolor: 'rgba(37,244,238,0.06)', borderBottom: '1px solid rgba(37,244,238,0.12)' }}>
          <Typography sx={{ fontSize: 11, color: 'rgba(37,244,238,0.75)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {title}
          </Typography>
        </Box>
      )}

      {/* 内容区 */}
      <Box sx={{ flex: 1, position: 'relative', bgcolor: '#05060B' }}>
        {isVideo ? (
          <video
            key={`${activeUrl}-${reloadKey}`}
            src={activeUrl}
            autoPlay
            muted={!soundOn}
            playsInline
            controls
            style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
          />
        ) : (
          <iframe
            key={`${activeUrl}-${reloadKey}`}
            src={activeUrl}
            title={title || '虚拟浏览器'}
            style={{ width: '100%', height: '100%', border: 'none' }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            referrerPolicy="no-referrer"
          />
        )}

        {/* 嵌入被拒 fallback 条: 站点禁止 iframe 嵌入 或 未确认可嵌入 → 都给 fallback */}
        {!isVideo && target.support !== 'yes' && (
          <Box
            sx={{
              position: 'absolute', left: 0, right: 0, bottom: 0, p: 1,
              bgcolor: 'rgba(255,150,40,0.14)', borderTop: '1px solid rgba(255,150,40,0.3)',
              display: 'flex', alignItems: 'center', gap: 1, backdropFilter: 'blur(6px)',
            }}
          >
            <Typography sx={{ flex: 1, fontSize: 11, color: '#ffb35c' }}>
              该站点可能不支持在页面内嵌入, 可能白屏 — 建议「新标签打开」或「代理打开」
            </Typography>
            <Box
              component="button"
              onClick={() => {
                setActiveUrl(toProxyUrl(target.rawUrl || target.url));
                setMode('normal');
              }}
              sx={{
                cursor: 'pointer', border: '1px solid rgba(255,150,40,0.4)', borderRadius: 1,
                bgcolor: 'rgba(255,150,40,0.12)', color: '#ffb35c', fontSize: 11, px: 1, py: 0.4,
                '&:hover': { bgcolor: 'rgba(255,150,40,0.22)' },
              }}
            >
              代理打开
            </Box>
            <IconButton
              size="small"
              onClick={() => window.open(target.rawUrl || target.url, '_blank', 'noopener,noreferrer')}
              sx={{ color: '#ffb35c' }}
              title="新标签打开"
            >
              <OpenInNewRoundedIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Box>
        )}
      </Box>
    </Box>
    </Box>
  );
}

export default VirtualBrowser;

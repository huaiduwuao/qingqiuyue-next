'use client';

/**
 * VideoPlayer 画面上叠的各种浮层(从 VideoPlayer.tsx 拆出,JSX 原样搬):去原站按钮、小窗占位、
 * 清晰度选择、封面 / 出错 / 带宽提示面板、地区提示、换链中、播放失败、轻触开声音、中心播放键。
 */
import React, { memo } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import PictureInPictureAltIcon from '@mui/icons-material/PictureInPictureAlt';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineRounded';
import CloudOffIcon from '@mui/icons-material/CloudOffRounded';
import type { StreamInfo } from '@/lib/player/videoDock';
import { isNetworkNotice, REGION_HINT } from './videoPlayerUtils';

/** 实在播不了时给出原站链接(番剧 / 直播间等解析不出流、或需要源站会员的内容) */
export const OriginButton = memo(function OriginButton({ link, platform }: { link: string; platform: string | null | undefined }) {
  if (!link) return null;
  return (
    <Box
      component="a"
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      data-no-drag
      sx={{
        mt: 1,
        display: 'inline-block',
        px: 2,
        py: 0.5,
        borderRadius: 1,
        fontSize: 12,
        color: '#fff',
        textDecoration: 'none',
        border: '1px solid rgba(255,255,255,0.35)',
        bgcolor: 'rgba(255,255,255,0.08)',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.18)' },
      }}
    >
      {platform ? `去${platform}观看` : '去原站观看'}
    </Box>
  );
});

/** 视频在小窗 / 画中画里放时,原位置的占位 */
export const DockPlaceholder = memo(function DockPlaceholder({ pip, onPlayHere }: { pip: boolean; onPlayHere: () => void }) {
  return (
    <Box
      data-no-drag
      sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, color: 'rgba(255,255,255,0.7)', fontSize: 13, bgcolor: '#0b0b0f', zIndex: 4 }}
    >
      <PictureInPictureAltIcon sx={{ fontSize: 36, opacity: 0.6 }} />
      {pip ? '正在画中画中播放' : '正在小窗中播放'}
      <Box
        component="button"
        onClick={onPlayHere}
        sx={{ mt: 0.5, px: 2, py: 0.5, borderRadius: 1, fontSize: 12, color: '#fff', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.35)', bgcolor: 'rgba(255,255,255,0.08)', '&:hover': { bgcolor: 'rgba(255,255,255,0.18)' } }}
      >
        在这里播放
      </Box>
    </Box>
  );
});

/** 清晰度选择器 */
export const QualitySelector = memo(function QualitySelector({
  streams,
  currentStream,
  fill,
  onSwitch,
}: {
  streams: StreamInfo[];
  currentStream: number;
  fill: boolean;
  onSwitch: (index: number) => void;
}) {
  return (
    <Box
      className="quality-selector"
      sx={{
        position: 'absolute',
        // 推荐流的右上角是声音/全屏按钮,清晰度放它们下面
        top: fill ? 56 : 10,
        right: 10,
        zIndex: 10,
      }}
    >
      <Box
        component="select"
        value={currentStream}
        onChange={(e: any) => onSwitch(parseInt(e.target.value))}
        sx={{
          bgcolor: 'rgba(0,0,0,0.7)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: 1,
          px: 1,
          py: 0.5,
          fontSize: 12,
          cursor: 'pointer',
          outline: 'none',
          '& option': { bgcolor: '#333' },
        }}
      >
        {streams.map((s, i) => (
          <option key={i} value={i}>
            {s.quality} {s.needPay ? '🔒' : ''}
          </option>
        ))}
      </Box>
    </Box>
  );
});

/** 还没有可播的视频时:封面 + 加载中 / 带宽受限 / 出错 / 解析中 / 播放键 */
export const PosterPanel = memo(function PosterPanel({
  posterUrl,
  loading,
  bandwidthLimited,
  streamError,
  platformName,
  playing,
  streams,
  originLink,
  originPlatform,
  onSwitch,
  onTogglePlay,
}: {
  posterUrl: string | undefined;
  loading: boolean;
  bandwidthLimited: string | null;
  streamError: string | null;
  platformName: string;
  playing: boolean;
  streams: StreamInfo[];
  originLink: string;
  originPlatform: string | null | undefined;
  onSwitch: (index: number) => void;
  onTogglePlay: () => void;
}) {
  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        backgroundImage: posterUrl ? `url(${posterUrl})` : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      {loading ? (
        <CircularProgress sx={{ color: '#fff' }} />
      ) : bandwidthLimited ? (
        // 不是故障:内容没坏,本站只是不替源站付视频带宽。中性图标、说清原因、给去原站的路。
        // 卡片自带深色磨砂底:它压在封面上,亮色封面上的白字否则看不清。
        <Box data-no-drag sx={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)', px: 3, py: 2, borderRadius: 2, bgcolor: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(6px)', maxWidth: 'min(92%, 420px)' }}>
          <CloudOffIcon sx={{ fontSize: 32, color: 'rgba(255,255,255,0.55)', mb: 0.5 }} />
          <Box sx={{ fontSize: 14, fontWeight: 600, color: '#fff', mb: 0.5 }}>{originPlatform ? `请前往${originPlatform}观看` : '暂不支持站内播放'}</Box>
          <Box sx={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', mb: 1 }}>{bandwidthLimited}</Box>
          <OriginButton link={originLink} platform={originPlatform} />
        </Box>
      ) : streamError ? (
        <Box sx={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)', px: 3, py: 2, borderRadius: 2, bgcolor: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(6px)', maxWidth: 'min(92%, 420px)' }}>
          <ErrorOutlineIcon sx={{ fontSize: 32, color: 'warning.main', mb: 0.5 }} />
          <Box sx={{ fontSize: 14, fontWeight: 600, color: '#fff', mb: 0.5 }}>该内容暂时无法播放</Box>
          <Box sx={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', mb: 1 }}>{isNetworkNotice(streamError) ? streamError : `${streamError} · 已记录,尽快修复`}</Box>
          <OriginButton link={originLink} platform={originPlatform} />
          {streams.length > 0 && (
            <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
              {streams.map((s, i) => (
                <Box
                  key={i}
                  component="button"
                  onClick={() => onSwitch(i)}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: 1,
                    color: '#fff',
                    px: 2,
                    py: 0.5,
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  {s.quality}
                </Box>
              ))}
            </Box>
          )}
        </Box>
      ) : platformName ? (
        <Box sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
          正在解析 {platformName} 视频流...
        </Box>
      ) : (
        !playing && (
          <IconButton
            data-no-drag
            onClick={onTogglePlay}
            sx={{
              bgcolor: 'rgba(254, 44, 85, 0.9)',
              color: '#fff',
              '&:hover': { bgcolor: 'primary.main' },
              width: 80,
              height: 80,
            }}
          >
            <PlayArrowIcon sx={{ fontSize: 48 }} />
          </IconButton>
        )
      )}
    </Box>
  );
});

/** 片源地区限制:开播前 / 暂停时显示,播起来就收起 */
export const RegionHint = memo(function RegionHint({ region, fill }: { region: string; fill: boolean }) {
  return (
    <Box
      sx={{
        position: 'absolute',
        top: fill ? 'calc(env(safe-area-inset-top, 0px) + 64px)' : 10,
        right: 10,
        zIndex: 3,
        maxWidth: 'calc(100% - 20px)',
        px: 1.25,
        py: 0.5,
        borderRadius: 999,
        fontSize: 12,
        lineHeight: 1.5,
        color: '#fff',
        bgcolor: region === 'overseas' ? 'rgba(217,119,6,0.85)' : 'rgba(0,0,0,0.6)',
        pointerEvents: 'none',
      }}
    >
      {REGION_HINT[region]}
    </Box>
  );
});

/** 直链失效,正在重新解析 */
export const RefreshingBadge = memo(function RefreshingBadge() {
  return (
    <Box
      data-no-drag
      sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 2,
        py: 1,
        borderRadius: 2,
        bgcolor: 'rgba(0, 0, 0, 0.6)',
        color: '#fff',
        fontSize: 13,
        zIndex: 5,
      }}
    >
      <CircularProgress size={16} sx={{ color: '#fff' }} />
      正在刷新播放地址…
    </Box>
  );
});

/**
 * hasVideo 为 true 时播放失败(重新解析也救不回来)——
 * 之前 streamError 的文字提示只在 !hasVideo 分支里渲染,这种情况下
 * <video> 元素明明已经挂载、彻底放不出来,却没有任何反馈,用户看到的
 * 就是一块卡死的黑屏,分不清是加载慢还是这条内容根本坏了。
 */
export const StreamErrorCard = memo(function StreamErrorCard({ streamError, originLink, originPlatform }: { streamError: string; originLink: string; originPlatform: string | null | undefined }) {
  return (
    <Box
      data-no-drag
      sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
        px: 3,
        py: 2,
        borderRadius: 2,
        bgcolor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        textAlign: 'center',
        maxWidth: 280,
        zIndex: 5,
      }}
    >
      <ErrorOutlineIcon sx={{ fontSize: 32, color: 'warning.main' }} />
      <Box sx={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>该内容暂时无法播放</Box>
      <Box sx={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{isNetworkNotice(streamError) ? streamError : `${streamError} · 已记录,尽快修复`}</Box>
      <OriginButton link={originLink} platform={originPlatform} />
    </Box>
  );
});

/** 有声自动播放被拦、已静音开播:轻触这里(用户手势)把声音打开 */
export const UnmuteHint = memo(function UnmuteHint({ onUnmute }: { onUnmute: () => void }) {
  return (
    <Box
      data-no-drag
      role="button"
      onClick={onUnmute}
      sx={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 3,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1.25,
        py: 0.5,
        borderRadius: 999,
        fontSize: 12,
        color: '#fff',
        bgcolor: 'rgba(0,0,0,0.55)',
        cursor: 'pointer',
      }}
    >
      <VolumeOffIcon sx={{ fontSize: 16 }} />
      轻触开启声音
    </Box>
  );
});

/** 中心播放按钮 */
export const CenterPlayButton = memo(function CenterPlayButton({ compact, fill, onTogglePlay }: { compact: boolean; fill: boolean; onTogglePlay: () => void }) {
  return (
    <Box
      data-no-drag
      onClick={onTogglePlay}
      sx={{
        position: 'absolute',
        // 手机上播放器只有 ~200px 高,底部控制条占掉 ~60px:按钮往上让半个控制条,不被压住
        top: compact && !fill ? 'calc(50% - 28px)' : '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
      }}
    >
      <Box
        sx={{
          width: compact ? 56 : 72,
          height: compact ? 56 : 72,
          borderRadius: '50%',
          bgcolor: 'rgba(254, 44, 85, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}
      >
        <PlayArrowIcon sx={{ fontSize: compact ? 36 : 44, color: '#fff' }} />
      </Box>
    </Box>
  );
});

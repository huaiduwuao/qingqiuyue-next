'use client';

import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import Box from '@mui/material/Box';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import OpenInNewIcon from '@mui/icons-material/OpenInNewRounded';
import AIGCBadge from '@/components/AIGCBadge';
import { mediaUrl } from '@/lib/media';
import { withAutoplay, type EmbedPlayer } from '@/lib/embedPlayer';
import type { VideoPlayerHandle } from './VideoPlayer';

interface Props {
  embed: EmbedPlayer;
  /** 源站页面,署名条上的「去原站观看」 */
  originUrl: string;
  poster?: string;
  autoPlay?: boolean;
  isAIGenerated?: boolean;
  /** 沉浸式推荐流:撑满父容器(见下方 fill 分支的说明) */
  fill?: boolean;
}

/**
 * 源站官方外链播放器(iframe)。VideoPlayer 发现源站页面有官方外链播放器时用它代替本站播放器:
 * 视频带宽源站出,用户不用跳走。
 *
 * 跟本站播放器的差别,都是 iframe 跨域决定的、绕不过去:拿不到播放进度(没有续播 / 观看时长)、
 * 没有小窗 / 画中画接管、清晰度由源站按登录态决定。所以这里不假装有这些控件。
 *
 * iframe 等用户点了封面才加载(autoPlay 时直接加载):详情页一打开就拉一整个第三方播放器
 * 既慢又会先发一堆请求,而多数访问只是看一眼简介。
 */
const EmbedVideoPlayer = forwardRef<VideoPlayerHandle, Props>(function EmbedVideoPlayer(
  { embed, originUrl, poster, autoPlay = false, isAIGenerated = false, fill = false },
  ref,
) {
  const [started, setStarted] = useState(autoPlay);
  // iframe 跨域,控制不了里面的播放:句柄给空实现,调用方(推荐流的点按暂停)不用分支。
  useImperativeHandle(ref, () => ({ togglePlay: () => {}, seek: () => {}, isPlaying: () => false }), []);
  // 换了一条内容:回到封面态(autoPlay 的除外)
  useEffect(() => {
    setStarted(autoPlay);
  }, [embed.url, autoPlay]);

  const posterUrl = mediaUrl(poster);

  const frame = started ? (
    <Box
      component="iframe"
      key={embed.url}
      src={withAutoplay(embed.url)}
      title={`${embed.providerLabel}播放器`}
      allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
      allowFullScreen
      // 不把本站地址透给源站;实测外链播放器不校验 Referer。
      referrerPolicy="no-referrer"
      // 第三方页面:给它跑脚本和自己的同源存储,允许「进入哔哩哔哩」开新窗口;
      // 不给 allow-top-navigation —— 它不能把本站页面导航走。
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
      sx={{ width: '100%', height: '100%', border: 0, display: 'block', bgcolor: '#000' }}
    />
  ) : (
    <Box
      component="button"
      type="button"
      aria-label="播放"
      onClick={() => setStarted(true)}
      sx={{
        width: '100%',
        height: '100%',
        p: 0,
        border: 0,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
        backgroundImage: posterUrl ? `url(${posterUrl})` : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          bgcolor: 'rgba(0,0,0,0.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform .15s',
          'button:hover > &': { transform: 'scale(1.08)' },
        }}
      >
        <PlayArrowIcon sx={{ fontSize: 40, color: '#fff' }} />
      </Box>
    </Box>
  );

  const credit = (
    <Box
      data-no-drag
      sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 12, lineHeight: 1.6 }}
    >
      <span>播放器由 {embed.providerLabel} 提供</span>
      {originUrl && (
        <>
          <span aria-hidden>·</span>
          <Box
            component="a"
            href={originUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ color: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 0.25, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
          >
            去原站观看
            <OpenInNewIcon sx={{ fontSize: 13 }} />
          </Box>
        </>
      )}
    </Box>
  );

  if (fill) {
    // 推荐流靠容器上的滚轮 / 触摸事件翻页,而落在 iframe 里的事件不会冒泡出来 ——
    // 所以 iframe 不铺满整屏,只占中间一条 16:9(横屏视频本来也是这么摆的),
    // 上下留给用户划走。
    return (
      <Box sx={{ position: 'absolute', inset: 0, bgcolor: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ position: 'relative', width: '100%', maxHeight: '70%', aspectRatio: '16/9' }}>
          {frame}
          {isAIGenerated && <AIGCBadge variant="overlay" top={10} left={10} label="AI 生成视频" />}
        </Box>
        <Box sx={{ mt: 1, color: 'rgba(255,255,255,0.6)' }}>{credit}</Box>
      </Box>
    );
  }

  return (
    // 署名条做成播放器自带的深色底栏:详情页有的把播放器放在黑色通栏里、有的放在浅色卡片里,
    // 跟着主题色走的文字总有一边看不清。
    <Box sx={{ width: '100%', borderRadius: 2, overflow: 'hidden', bgcolor: '#0b0b0f' }}>
      <Box sx={{ position: 'relative', width: '100%', aspectRatio: '16/9', bgcolor: '#000' }}>
        {frame}
        {isAIGenerated && <AIGCBadge variant="overlay" top={10} left={10} label="AI 生成视频" />}
      </Box>
      <Box sx={{ px: 1.5, py: 0.75, color: 'rgba(255,255,255,0.6)' }}>{credit}</Box>
    </Box>
  );
});

export default EmbedVideoPlayer;

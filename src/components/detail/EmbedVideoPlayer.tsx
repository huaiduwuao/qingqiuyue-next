'use client';

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
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
  /** 打开源站播放器自带的弹幕(B 站 danmaku=1)。改了会重载 iframe。 */
  danmaku?: boolean;
  /** fill 模式底部让出的高度(数字按 px,也可以是 CSS 长度),默认 160 */
  reserveBottom?: number | string;
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
  { embed, originUrl, poster, autoPlay = false, isAIGenerated = false, fill = false, danmaku = false, reserveBottom = 160 },
  ref,
) {
  const [started, setStarted] = useState(autoPlay);
  // fill 模式下 iframe 上盖一层透明罩:落在 iframe 里的滚轮/触摸不会冒泡到推荐流,
  // 不盖的话宽屏上播放器几乎占满整屏,根本划不动。点一下(推荐流把单击转成
  // togglePlay)撤掉罩子,接下来的点击直达播放器;移出播放器或几秒后罩子回来。
  const [interactive, setInteractive] = useState(false);
  const relockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unlock = useCallback(() => {
    setInteractive(true);
    if (relockTimer.current) clearTimeout(relockTimer.current);
    relockTimer.current = setTimeout(() => setInteractive(false), 8000);
  }, []);
  const relock = useCallback(() => {
    if (relockTimer.current) clearTimeout(relockTimer.current);
    setInteractive(false);
  }, []);
  useEffect(() => () => { if (relockTimer.current) clearTimeout(relockTimer.current); }, []);
  // iframe 跨域,控制不了里面的播放:togglePlay 只负责放行下一次点击。
  useImperativeHandle(ref, () => ({ togglePlay: unlock, seek: () => {}, isPlaying: () => false }), [unlock]);
  // 换了一条内容:回到封面态(autoPlay 的除外)
  useEffect(() => {
    setStarted(autoPlay);
    relock();
  }, [embed.url, autoPlay, relock]);

  const posterUrl = mediaUrl(poster);

  const frame = started ? (
    <Box
      component="iframe"
      key={embed.url + (danmaku ? "#dm" : "")}
      src={withAutoplay(danmaku ? embed.url.replace("danmaku=0", "danmaku=1") : embed.url)}
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
    // iframe 只占中间一条 16:9,上面再盖透明罩(见 interactive)。
    return (
      // 底部留 160px:推荐流的作者/标题浮层压在卡片底部(bottom: 92),不让开的话会盖住
      // 外链播放器自己的进度条和音量/全屏按钮。
      <Box sx={{ position: 'absolute', inset: 0, pt: 2, pb: typeof reserveBottom === 'number' ? `${reserveBottom}px` : reserveBottom, bgcolor: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Box
          onPointerLeave={relock}
          sx={{ position: 'relative', width: '100%', flex: '0 1 auto', minHeight: 0, maxHeight: '100%', aspectRatio: '16/9' }}
        >
          {frame}
          {/* 罩子不盖底部 48px:外链播放器的进度条/音量/全屏始终能直接点 */}
          {started && !interactive && (
            <Box aria-hidden sx={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 48, cursor: 'inherit' }} />
          )}
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

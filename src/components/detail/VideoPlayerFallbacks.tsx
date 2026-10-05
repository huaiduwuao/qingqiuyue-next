'use client';

/**
 * VideoPlayer 外壳在建不了 / 建不成播放器时显示的界面(从 VideoPlayer.tsx 拆出,JSX 原样搬)。
 */
import React, { memo } from 'react';
import Box from '@mui/material/Box';
import { mediaUrl } from '@/lib/media';
import { openExternalUrl } from '@/lib/clientAuth';
import { webCannotFetchMedia } from '@/lib/localStream/engine';
import { matchProvider } from '@/lib/localStream/rules';
import { hijackBrowserName, appOpenUrl } from '@/lib/hijackBrowser';

/**
 * 会接管 <video> 的安卓国产浏览器(lib/hijackBrowser)里不建播放器,给「在 App 中观看」。
 * 外框跟播放器一样(详情 16:9 / 推荐流铺满),推荐流的上下滑照常 —— 只有两个按钮吃点击。
 */
export const AppOnlyPlayer = memo(function AppOnlyPlayer({ poster, fill, appPath }: { poster?: string; fill?: boolean; appPath?: string }) {
  const path = appPath || (typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/');
  const btn = { px: 2, py: 0.75, borderRadius: 999, fontSize: 14, border: '1px solid rgba(255,255,255,0.4)', color: '#fff', bgcolor: 'rgba(255,255,255,0.08)', textDecoration: 'none' } as const;
  return (
    <Box
      sx={{
        position: fill ? 'absolute' : 'relative',
        inset: fill ? 0 : undefined,
        width: '100%',
        aspectRatio: fill ? undefined : '16/9',
        bgcolor: '#000',
        background: poster ? `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.75)), url("${mediaUrl(poster)}") center/${fill ? 'contain' : 'cover'} no-repeat #000` : '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        color: 'rgba(255,255,255,0.9)',
        textAlign: 'center',
        px: 3,
      }}
    >
      <Box sx={{ fontSize: 15 }}>请在清秋月 App 里观看</Box>
      <Box sx={{ fontSize: 12, opacity: 0.7, maxWidth: 320 }}>
        {hijackBrowserName()}会用它自己的播放器接管网页视频,常常报「视频不存在」,也会挡住上下滑动。用 App 播放更稳,也能选清晰度、小窗。
      </Box>
      <Box sx={{ display: 'flex', gap: 1.5, mt: 0.5 }}>
        <Box component="a" href={appOpenUrl(path)} data-no-drag sx={{ ...btn, bgcolor: 'primary.main', borderColor: 'transparent' }}>
          打开 App
        </Box>
        <Box component="a" href="/download" data-no-drag sx={btn}>
          下载 App
        </Box>
      </Box>
    </Box>
  );
});

/**
 * 规则解析失败时的界面(本地和服务端都没解出来,或流放不出来)。没有外链 iframe 可退
 * (2026-09-26 起全站不再嵌 iframe:吞手势、没进度、没小窗):就地给「重试」和「用 XX 打开」,
 * 客户端里把失败现场报给服务器(lib/clientDiag)。
 */
export const LocalPlayError = memo(function LocalPlayError({ pageUrl, message, fill, onRetry }: { pageUrl: string; message: string; fill?: boolean; onRetry: () => void }) {
  const label = matchProvider(pageUrl)?.rule.label ?? '原站';
  const btn = { px: 2, py: 0.75, borderRadius: 999, fontSize: 14, border: '1px solid rgba(255,255,255,0.4)', color: '#fff', bgcolor: 'rgba(255,255,255,0.08)', cursor: 'pointer' } as const;
  return (
    <Box
      sx={{
        position: fill ? 'absolute' : 'relative',
        inset: fill ? 0 : undefined,
        width: '100%',
        aspectRatio: fill ? undefined : '16/9',
        bgcolor: fill ? 'transparent' : '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        color: 'rgba(255,255,255,0.85)',
        textAlign: 'center',
        px: 3,
      }}
    >
      <Box sx={{ fontSize: 15 }}>这条视频暂时没能加载出来</Box>
      <Box sx={{ fontSize: 12, opacity: 0.6, maxWidth: 320 }}>
        {webCannotFetchMedia(pageUrl) ? `网页版拿不到这个片源（${label}要求在它自己的页面或 App 里取片），可以在清秋月 App 里看，或去${label}看` : message}
      </Box>
      <Box sx={{ display: 'flex', gap: 1.5, mt: 0.5 }}>
        <Box component="button" type="button" data-no-drag onClick={onRetry} sx={btn}>
          重试
        </Box>
        <Box
          component="button"
          type="button"
          data-no-drag
          onClick={() => {
            void openExternalUrl(pageUrl).then((ok) => {
              if (!ok) window.open(pageUrl, '_blank', 'noopener');
            });
          }}
          sx={btn}
        >
          用{label}打开
        </Box>
      </Box>
    </Box>
  );
});

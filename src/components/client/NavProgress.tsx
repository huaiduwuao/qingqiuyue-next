'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useIsMutating } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { getNavBusy, subscribeNavBusy } from '@/lib/navTransition';

/** 快的操作不闪:过了这么久还没好才出进度条 */
const BAR_DELAY = 150;
/** 提交类操作(点赞、发评论…)大多是乐观更新,再慢一点才提示 */
const MUTATION_DELAY = 400;
/** 换页再慢:盖一层透明遮罩 + 转圈,挡住连点(点了没反应 → 再点一次 → 跳两次) */
const MASK_DELAY = 600;
/**
 * 转圈 + 遮罩一直挡着操作,直到新页面出来;过了这么久再加一句「网络较慢」。
 * 以前 4 秒一到连转圈一起收掉,只剩顶上 3px 的细条,页面还没出来,看着就像卡死了。
 * 真没走完的跳转由 markNavStart 的 20 秒兜底结束,不会永远锁住界面。
 */
const SLOW_HINT = 4000;

let lastInput = -Infinity;

/**
 * 点下去反应慢时的反馈(全站,网页和客户端都有):
 * - 换页(lib/navTransition 的「正在跳转」:router.push / 站内链接 / 返回)
 * - react-query 的提交(useIsMutating)
 * 超过 150ms / 400ms 在顶部出一条进度条;换页超过 600ms 再盖遮罩和转圈。
 */
export default function NavProgress() {
  const navBusy = useSyncExternalStore(subscribeNavBusy, getNavBusy, () => false);
  const mutating = useIsMutating() > 0;
  useEffect(() => {
    const mark = () => {
      lastInput = performance.now();
    };
    window.addEventListener('pointerdown', mark, true);
    window.addEventListener('keydown', mark, true);
    return () => {
      window.removeEventListener('pointerdown', mark, true);
      window.removeEventListener('keydown', mark, true);
    };
  }, []);
  const [bar, setBar] = useState(false);
  /** off:不显示;block:半透明遮罩 + 转圈,挡操作;slow:同样挡着,再加「网络较慢」提示 */
  const [mask, setMask] = useState<'off' | 'block' | 'slow'>('off');
  /** 每次重新开始都换 key,进度条从 0 重新长 */
  const [run, setRun] = useState(0);

  useEffect(() => {
    // 只算用户刚点过之后发起的提交:页面自己在后台发的(埋点、心跳)不该冒进度条
    const userMutation = mutating && performance.now() - lastInput < 1000;
    if (!navBusy && !userMutation) return;
    const timers = [
      setTimeout(() => {
        setRun((n) => n + 1);
        setBar(true);
      }, navBusy ? BAR_DELAY : MUTATION_DELAY),
    ];
    if (navBusy) {
      timers.push(setTimeout(() => setMask('block'), MASK_DELAY));
      timers.push(setTimeout(() => setMask('slow'), SLOW_HINT));
    }
    // 结束(或换了一种忙)时收起;显示只在上面的定时器里打开
    return () => {
      timers.forEach(clearTimeout);
      setBar(false);
      setMask('off');
    };
  }, [navBusy, mutating]);

  return (
    <>
      <Box
        aria-hidden
        sx={{
          position: 'fixed',
          top: 'var(--sat, 0px)',
          left: 0,
          right: 0,
          height: 3,
          zIndex: 2000,
          pointerEvents: 'none',
          opacity: bar ? 1 : 0,
          transition: bar ? 'opacity 0.1s' : 'opacity 0.3s 0.1s',
        }}
      >
        {run > 0 && (
          <Box
            key={run}
            sx={{
              height: '100%',
              bgcolor: 'var(--brand-color, #FE2C55)',
              boxShadow: '0 0 8px var(--brand-color, #FE2C55)',
              transformOrigin: 'left',
              // 先冲到一半,之后越来越慢地逼近 90%(不知道真实进度,别让它停住看着像卡死)
              animation: 'qq-nav-bar 8s cubic-bezier(0.1, 0.7, 0.2, 1) forwards',
              '@keyframes qq-nav-bar': { from: { transform: 'scaleX(0.05)' }, to: { transform: 'scaleX(0.9)' } },
              '@media (prefers-reduced-motion: reduce)': { animation: 'none', transform: 'scaleX(0.6)' },
            }}
          />
        )}
      </Box>
      {mask !== 'off' && (
        <Box
          role="progressbar"
          aria-label="正在打开"
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 1999,
            cursor: 'progress',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(0,0,0,0.08)',
            animation: 'qq-fade-in 0.2s ease-out both',
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(20,20,24,0.72)',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            }}
          >
            <CircularProgress size={24} thickness={4.5} sx={{ color: '#fff' }} />
          </Box>
          {mask === 'slow' && (
            <Box
              sx={{
                px: 1.25,
                py: 0.5,
                borderRadius: 999,
                fontSize: 12,
                color: '#fff',
                bgcolor: 'rgba(20,20,24,0.72)',
                backdropFilter: 'blur(8px)',
                animation: 'qq-fade-in 0.2s ease-out both',
              }}
            >
              网络较慢,正在打开…
            </Box>
          )}
        </Box>
      )}
    </>
  );
}

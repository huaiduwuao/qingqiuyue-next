'use client';

/**
 * SceneDisplay — 3D 场景里一块显示器的画面。
 *
 * 由 CSS3D 摆进场景(见 vrm/useVrmScenePanel),这里只管屏幕里面:
 *   - 没开页面:待机画面 + 几个快捷入口 + 地址/搜索栏
 *   - 站内页面:同源 iframe,自己记前进/后退栈(见 displays.ts 为什么不能用 history.back)
 *   - 外站网页 / 直链视频:iframe 或 <video>,不确定能不能内嵌时给兜底条
 *
 * 页面在屏幕里开,数字人页面本身不跳转 —— 对话、语音、场景都不会断。
 */

import React from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import ZoomInMapRoundedIcon from '@mui/icons-material/ZoomInMapRounded';
import ZoomOutMapRoundedIcon from '@mui/icons-material/ZoomOutMapRounded';
import ScreenShareRoundedIcon from '@mui/icons-material/ScreenShareRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { DISPLAY_SPECS, type DisplaySlot } from '../vrm/sceneDisplays';
import { safeFrameSrc } from '../virtual-browser';
import { openExternal } from '@/lib/safeUrl';
import {
  emptyNav, isEmbedMessage, navCanBack, navCanForward, navObserve,
  type DisplayPage, type NavStack,
} from './displays';

const ACCENT = '#25F4EE';

const SHORTCUTS: Record<DisplaySlot, { label: string; url: string }[]> = {
  wall: [
    { label: '放映厅', url: '/home/recommend?tab=theater' },
    { label: '短剧', url: '/home/recommend?tab=drama' },
    { label: '直播', url: '/home/recommend?tab=live' },
    { label: '排行榜', url: '/home/recommend?tab=rank' },
  ],
  desk: [
    { label: '精选', url: '/home/recommend?tab=home' },
    { label: '搜索', url: '/search' },
    { label: '意境', url: '/home/recommend?tab=topic' },
    { label: '壁纸', url: '/wallpaper' },
  ],
  kiosk: [
    { label: '动态', url: '/home/recommend?tab=feed' },
    { label: '推荐', url: '/home/recommend?tab=recommend' },
    { label: '我的歌单', url: '/playlist' },
  ],
};

export interface SceneDisplayProps {
  slot: DisplaySlot;
  page: DisplayPage | null;
  /** 镜头是否正凑近这块屏 */
  focused: boolean;
  /** 叠在画面上的平面模式(非 VRM 形象 / 手机):没有镜头可凑近,也不用放大控件 */
  overlay?: boolean;
  /** 在这块屏上打开一个地址(站内路径、外站 URL,或一句搜索词) */
  onOpen: (input: string) => void;
  onClose: () => void;
  onFocus: (on: boolean) => void;
  /** 把当前页面挪到下一块屏 */
  onMove?: (currentUrl: string) => void;
  /** 屏幕里的页面变了(地址、标题),上报给场景状态 */
  onLocation?: (info: { url: string; title: string }) => void;
}

export default function SceneDisplay({ slot, page, focused, overlay, onOpen, onClose, onFocus, onMove, onLocation }: SceneDisplayProps) {
  const spec = DISPLAY_SPECS[slot];
  // 屏幕在场景里会被缩得很小,控件按屏幕像素宽度放大
  const k = overlay ? 1 : spec.widthPx >= 1200 ? 1.7 : spec.widthPx >= 1000 ? 1.45 : 1.15;
  const frameRef = React.useRef<HTMLIFrameElement | null>(null);
  const [nav, setNav] = React.useState<NavStack>(emptyNav);
  const navRef = React.useRef(nav);
  navRef.current = nav;
  const [title, setTitle] = React.useState('');
  const titleRef = React.useRef(title);
  titleRef.current = title;
  const [loading, setLoading] = React.useState(false);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [input, setInput] = React.useState('');
  const onLocationRef = React.useRef(onLocation);
  onLocationRef.current = onLocation;
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  const isSite = page?.kind === 'site';
  const current = (isSite && nav.entries[nav.index]) || page?.url || '';

  // 换了一页:栈、标题全部重来
  React.useEffect(() => {
    setNav(page?.kind === 'site' ? { entries: [page.url], index: 0 } : emptyNav());
    setTitle(page?.title || '');
    setLoading(!!page);
    setInput('');
  }, [page?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  // 自己发起的前进/后退还没落地时,iframe 里读到的还是旧地址,别把它当成一次新的访问
  const pendingRef = React.useRef<{ href: string; until: number } | null>(null);

  const go = React.useCallback((delta: -1 | 1) => {
    const n = navRef.current;
    const target = n.entries[n.index + delta];
    const cw = frameRef.current?.contentWindow;
    if (target === undefined || !cw) return false;
    setNav({ ...n, index: n.index + delta });
    pendingRef.current = { href: target, until: Date.now() + 5000 };
    setLoading(true);
    try {
      cw.location.replace(target);
    } catch {
      return false;
    }
    return true;
  }, []);

  // 站内页面同源:轮询 iframe 的地址和标题。页面里点链接走的是 pushState,没有 load 事件可听。
  React.useEffect(() => {
    if (!isSite) return;
    const id = window.setInterval(() => {
      try {
        const cw = frameRef.current?.contentWindow;
        if (!cw || cw.location.href === 'about:blank') return;
        const href = cw.location.pathname + cw.location.search + cw.location.hash;
        const t = cw.document.title || '';
        const pending = pendingRef.current;
        if (pending) {
          if (href !== pending.href && Date.now() < pending.until) return;
          pendingRef.current = null;
        }
        const before = navRef.current;
        const after = navObserve(before, href);
        if (after !== before) setNav(after);
        if (after !== before || (t && t !== titleRef.current)) {
          onLocationRef.current?.({ url: href, title: t || titleRef.current });
        }
        if (t) setTitle(t);
      } catch {
        /* 跳到了外站(跨源),读不到地址,保持上一次的状态 */
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [isSite, page?.seq]);

  // 页面里的「返回」(router.back / history.back)由内嵌页转发过来,走这块屏自己的栈;
  // 已经是第一页了就关掉屏幕 —— 对用户来说「返回」就是回到和数字人的对话。
  React.useEffect(() => {
    if (!isSite) return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frameRef.current?.contentWindow) return;
      if (!isEmbedMessage(e.data) || e.data.action !== 'back') return;
      if (!go(-1)) onCloseRef.current();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [isSite, go]);

  const submit = () => {
    const v = input.trim();
    if (v) onOpen(v);
  };

  const btn = (label: string, icon: React.ReactNode, onClick: () => void, opts: { disabled?: boolean; active?: boolean } = {}) => (
    <Box
      component="button"
      type="button"
      aria-label={label}
      title={label}
      disabled={opts.disabled}
      onClick={onClick}
      sx={{
        all: 'unset', boxSizing: 'border-box', flexShrink: 0, width: 34 * k, height: 34 * k, borderRadius: 1.5 * k,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        color: opts.active ? ACCENT : 'rgba(255,255,255,0.82)',
        bgcolor: opts.active ? 'rgba(37,244,238,0.16)' : 'transparent',
        '& svg': { fontSize: 20 * k },
        '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
        '&:focus-visible': { outline: `2px solid ${ACCENT}` },
        '&:disabled': { opacity: 0.3, cursor: 'default', bgcolor: 'transparent' },
      }}
    >
      {icon}
    </Box>
  );

  const addressBar = (
    <Box
      component="input"
      aria-label={`${spec.label}地址栏`}
      value={input}
      placeholder={page ? [title, current].filter(Boolean).join('  ·  ') : '输入网址、站内路径,或直接搜'}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
      onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') submit(); }}
      sx={{
        flex: 1, minWidth: 0, height: 32 * k, px: 1.5 * k, borderRadius: 999, border: '1px solid rgba(255,255,255,0.14)',
        bgcolor: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: 13 * k, outline: 'none',
        '&::placeholder': { color: 'rgba(255,255,255,0.6)', opacity: 1 },
        '&:focus': { borderColor: ACCENT },
      }}
    />
  );

  const focusBtn = !overlay && btn(focused ? '退回全景' : '凑近看', focused ? <ZoomOutMapRoundedIcon /> : <ZoomInMapRoundedIcon />, () => onFocus(!focused), { active: focused });

  if (!page) {
    return (
      <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', color: '#fff', background: 'radial-gradient(120% 90% at 50% 0%, #10203a 0%, #05060B 70%)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 * k, p: 1 * k }}>
          <Box sx={{ fontSize: 13 * k, fontWeight: 700, color: ACCENT, px: 0.5 * k, flexShrink: 0 }}>{spec.label}</Box>
          {addressBar}
          {focusBtn}
        </Box>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2.5 * k, px: 3 * k, textAlign: 'center' }}>
          <Box sx={{ fontSize: 22 * k, fontWeight: 700, letterSpacing: 1 }}>边聊边看</Box>
          <Box sx={{ fontSize: 13 * k, color: 'rgba(255,255,255,0.62)', lineHeight: 1.7, maxWidth: 420 * k }}>
            点开小月推荐的作品会在这里打开,对话不会断。也可以直接说「在{spec.label}上打开…」。
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 * k, justifyContent: 'center' }}>
            {SHORTCUTS[slot].map((s) => (
              <Box
                key={s.url}
                component="button"
                type="button"
                onClick={() => onOpen(s.url)}
                sx={{
                  all: 'unset', cursor: 'pointer', px: 2 * k, py: 0.9 * k, borderRadius: 999, fontSize: 14 * k, fontWeight: 600,
                  color: '#fff', bgcolor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)',
                  '&:hover': { bgcolor: 'rgba(37,244,238,0.16)', borderColor: ACCENT },
                  '&:focus-visible': { outline: `2px solid ${ACCENT}` },
                }}
              >
                {s.label}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    );
  }

  // 外站只放行跨源 http(s):本站地址配 allow-same-origin 等于没沙箱(见 safeFrameSrc)
  const src = isSite ? page.url : safeFrameSrc(page.url);
  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#0a0c14' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 * k, px: 0.75 * k, py: 0.6 * k, bgcolor: 'rgba(20,24,40,0.96)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {btn('后退', <ArrowBackRoundedIcon />, () => { go(-1); }, { disabled: !navCanBack(nav) })}
        {btn('前进', <ArrowForwardRoundedIcon />, () => { go(1); }, { disabled: !navCanForward(nav) })}
        {btn('刷新', <RefreshRoundedIcon />, () => { setLoading(true); setReloadKey((n) => n + 1); })}
        {addressBar}
        {loading && <CircularProgress size={16 * k} sx={{ color: ACCENT, flexShrink: 0 }} />}
        {focusBtn}
        {onMove && btn('换一块屏', <ScreenShareRoundedIcon />, () => onMove(current))}
        {btn('新标签打开', <OpenInNewRoundedIcon />, () => { openExternal(isSite ? current : page.rawUrl); })}
        {btn('回到待机', <HomeRoundedIcon />, onClose)}
        {overlay && btn('关闭', <CloseRoundedIcon />, onClose)}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, position: 'relative', bgcolor: page.kind === 'site' ? '#fff' : '#000' }}>
        {page.kind === 'video' ? (
          <video
            key={`${page.seq}-${reloadKey}`}
            src={page.url}
            autoPlay
            playsInline
            controls
            onLoadedData={() => setLoading(false)}
            onError={() => setLoading(false)}
            style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000', display: 'block' }}
          />
        ) : (
          <iframe
            ref={frameRef}
            key={`${page.seq}-${reloadKey}`}
            // 刷新站内页面时停在当前地址,而不是回到最初打开的那一页
            src={isSite && reloadKey > 0 ? current : src}
            title={title || page.title || spec.label}
            onLoad={() => setLoading(false)}
            allow="autoplay; fullscreen; picture-in-picture; clipboard-write"
            allowFullScreen
            // 站内页面同源、可信,不加沙箱(要读地址、共享登录态);外站照旧关进沙箱
            {...(isSite ? {} : { sandbox: 'allow-scripts allow-same-origin allow-popups allow-presentation', referrerPolicy: 'no-referrer' as const })}
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          />
        )}
        {page.kind === 'web' && !page.embeddable && (
          <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, p: 1 * k, display: 'flex', alignItems: 'center', gap: 1 * k, bgcolor: 'rgba(40,24,6,0.92)', borderTop: '1px solid rgba(255,150,40,0.4)', fontSize: 12 * k, color: '#ffb35c' }}>
            <Box sx={{ flex: 1 }}>这个站点可能不允许内嵌,白屏的话试试新标签打开</Box>
            <Box component="button" type="button" onClick={() => { openExternal(page.rawUrl); }} sx={{ all: 'unset', cursor: 'pointer', px: 1.25 * k, py: 0.4 * k, borderRadius: 1, border: '1px solid rgba(255,150,40,0.5)', '&:hover': { bgcolor: 'rgba(255,150,40,0.2)' } }}>
              新标签打开
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export interface UseResponsiveResult {
  // 精确断点
  isXs: boolean;
  isSm: boolean;
  isMd: boolean;
  isLg: boolean;
  isXl: boolean;
  // 设备类型
  isMobile: boolean;    // < md (900px):手机 + 小平板竖屏,显示底部导航
  isTablet: boolean;    // md ~ lg (900-1199px):显示侧栏,不显示右栏
  isDesktop: boolean;   // >= lg (1200px)
  // 屏幕方向
  isLandscape: boolean;
  isPortrait: boolean;
  // 类型
  deviceType: DeviceType;
  breakpoint: Breakpoint;
  /** 是否已挂载(挂载前所有值都是桌面端默认值,用于避免首屏抖动) */
  mounted: boolean;
}

/**
 * 统一的响应式判断 Hook。
 *
 * 断点与 MUI theme.breakpoints 完全对齐(xs 0 / sm 600 / md 900 / lg 1200 / xl 1536):
 * 之前这里自定义了 768/1024 两条线,而各 layout 的 sx 却用 `{ xs:'none', md:'flex' }`
 * (900px)控制侧栏,结果 768~899px 既没侧栏也可能没底部导航,900~1023px 横屏则
 * 侧栏、底部导航同时消失 —— 这就是平板/大屏手机上"导航不见了"的来源。
 * 现在只有一条规则:< md 用底部导航,>= md 用侧栏。
 */
export function useResponsive(): UseResponsiveResult {
  const theme = useTheme();

  // 精确断点判断
  const isXs = useMediaQuery(theme.breakpoints.only('xs'));
  const isSm = useMediaQuery(theme.breakpoints.only('sm'));
  const isMd = useMediaQuery(theme.breakpoints.only('md'));
  const isLg = useMediaQuery(theme.breakpoints.only('lg'));
  const isXl = useMediaQuery(theme.breakpoints.up('xl'));

  const isMobileQuery = useMediaQuery(theme.breakpoints.down('md'));
  const isTabletQuery = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const isDesktopQuery = useMediaQuery(theme.breakpoints.up('lg'));

  // 屏幕方向判断
  const isLandscapeQuery = useMediaQuery('(orientation: landscape)');
  const isPortraitQuery = useMediaQuery('(orientation: portrait)');

  // 挂载前(含 SSR 首屏)一律用固定的桌面端默认值,挂载后才切到 matchMedia 真实值。
  // 注意:上面每个 useMediaQuery 调用本身在挂载前后都无条件执行,数量和顺序完全
  // 不变——变的只是下面这一步对返回值的取舍,不会引发 hooks 数量不一致的报错。
  // 之前这里直接用 useMediaQuery 的返回值,在这个 React 19 + MUI v9 组合下,同一个
  // useMediaQuery 调用在 SSR 首屏和客户端 hydrate 之间的内部 hook 数量本身就可能不
  // 一致(疑似 useSyncExternalStore 的服务端快照路径与客户端不同),表现为
  // "Rendered more hooks than during the previous render",且与调用方(如
  // MobileBottomNav)自己是否规范调用 hooks 无关——挂载门控从根上避免依赖这段
  // 首屏行为是否一致。
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isMobile = mounted ? isMobileQuery : false;
  const isTablet = mounted ? isTabletQuery : false;
  const isDesktop = mounted ? isDesktopQuery : true;
  const isLandscape = mounted ? isLandscapeQuery : true;
  const isPortrait = mounted ? isPortraitQuery : false;

  // 确定当前断点
  let breakpoint: Breakpoint = 'xs';
  if (isXs) breakpoint = 'xs';
  else if (isSm) breakpoint = 'sm';
  else if (isMd) breakpoint = 'md';
  else if (isLg) breakpoint = 'lg';
  else if (isXl) breakpoint = 'xl';

  // 确定设备类型
  let deviceType: DeviceType = 'mobile';
  if (isMobile) deviceType = 'mobile';
  else if (isTablet) deviceType = 'tablet';
  else deviceType = 'desktop';

  return {
    isXs,
    isSm,
    isMd,
    isLg,
    isXl,
    isMobile,
    isTablet,
    isDesktop,
    isLandscape,
    isPortrait,
    deviceType,
    breakpoint,
    mounted,
  };
}

/**
 * 简化版响应式判断 - 只判断是否显示底部导航(< md)。
 * 与 useResponsive().isMobile 同一条线,别再各自定义阈值。
 */
export function useShowBottomNav(): boolean {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? isMobile : false;
}

/**
 * 判断是否为 iPad (平板横屏特殊处理)
 */
export function useIsIpadLandscape(): boolean {
  // iPad 横屏: 宽度 >= 768px 且高度 < 768px
  const isTabletWidth = useMediaQuery('(min-width: 768px)');
  const isShortHeight = useMediaQuery('(max-height: 767px)');
  return isTabletWidth && isShortHeight;
}

/**
 * 是否触屏设备(无 hover 能力)。用于关闭依赖鼠标的动效(Magnet / Spotlight)。
 */
export function useIsTouch(): boolean {
  const coarse = useMediaQuery('(hover: none) and (pointer: coarse)');
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? coarse : false;
}

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
  isMobile: boolean;    // xs + sm (< 768px)
  isTablet: boolean;    // md (768-1023px)
  isDesktop: boolean;   // lg+ (>= 1024px)
  // 屏幕方向
  isLandscape: boolean;
  isPortrait: boolean;
  // 类型
  deviceType: DeviceType;
  breakpoint: Breakpoint;
}

/**
 * 统一的响应式判断 Hook
 * 使用 MUI 断点系统，支持移动端、平板、桌面端全尺寸适配
 */
export function useResponsive(): UseResponsiveResult {
  const theme = useTheme();

  // 精确断点判断
  const isXs = useMediaQuery(theme.breakpoints.only('xs'));
  const isSm = useMediaQuery(theme.breakpoints.only('sm'));
  const isMd = useMediaQuery(theme.breakpoints.only('md'));
  const isLg = useMediaQuery(theme.breakpoints.only('lg'));
  const isXl = useMediaQuery(theme.breakpoints.up('xl'));

  // 设备类型判断 (< 768px 为移动端，768-1023px 为平板)
  const isMobileQuery = useMediaQuery('(max-width: 767px)');
  const isTabletQuery = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
  const isDesktopQuery = useMediaQuery('(min-width: 1024px)');

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
  };
}

/**
 * 简化版响应式判断 - 只判断是否显示底部导航
 * 用于不需要频繁切换的场景
 */
export function useShowBottomNav(): boolean {
  const theme = useTheme();
  // 移动端 (xs/sm) 显示底部导航
  // 平板横屏不显示 (特殊处理需要结合 useResponsive)
  const isMobile = useMediaQuery('(max-width: 767px)');
  return isMobile;
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

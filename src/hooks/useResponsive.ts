'use client';

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
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  // 屏幕方向判断
  const isLandscape = useMediaQuery('(orientation: landscape)');
  const isPortrait = useMediaQuery('(orientation: portrait)');

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

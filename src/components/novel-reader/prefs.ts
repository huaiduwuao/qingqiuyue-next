'use client';

import { useCallback, useEffect, useState } from 'react';
import { getNovelProgress, saveNovelProgress } from '@/apis/content-novel-chapter';
import { visitorId } from '@/lib/track';

/**
 * 小说阅读器的主题与偏好,版式对齐起点中文网的新版阅读页:
 * 外层底色 + 居中纸张 + 细噪点纹理,正文 18px / 行高 1.8 / 段首缩进两字。
 */
export interface ReaderTheme {
  id: string;
  label: string;
  /** 纸张(正文栏)底色 */
  paper: string;
  /** 纸张两侧的页面底色,比纸张略深 */
  page: string;
  text: string;
  /** 次要文字:章节信息、按钮说明 */
  sub: string;
  /** 分隔线、描边 */
  line: string;
  /** 浅色块:章末导航条、按钮悬停 */
  fill: string;
  dark: boolean;
  /** 强调色(进度条、选中态);不填用 READER_ACCENT */
  accent?: string;
}

export const READER_THEMES: ReaderTheme[] = [
  { id: 'default', label: '默认', paper: '#F5F1E8', page: '#EBE6DA', text: 'rgba(0,0,0,.9)', sub: 'rgba(0,0,0,.5)', line: 'rgba(0,0,0,.08)', fill: 'rgba(0,0,0,.04)', dark: false },
  { id: 'gray', label: '素灰', paper: '#E0E0E0', page: '#D3D3D3', text: 'rgba(0,0,0,.9)', sub: 'rgba(0,0,0,.5)', line: 'rgba(0,0,0,.08)', fill: 'rgba(0,0,0,.05)', dark: false },
  { id: 'yellow', label: '米黄', paper: '#F4ECD1', page: '#E9DFBF', text: 'rgba(0,0,0,.9)', sub: 'rgba(0,0,0,.5)', line: 'rgba(0,0,0,.08)', fill: 'rgba(0,0,0,.04)', dark: false },
  { id: 'green', label: '护眼', paper: '#DAF2DA', page: '#CBE5CB', text: 'rgba(0,0,0,.9)', sub: 'rgba(0,0,0,.5)', line: 'rgba(0,0,0,.08)', fill: 'rgba(0,0,0,.04)', dark: false },
  { id: 'blue', label: '天青', paper: '#DCEAEE', page: '#CDDDE2', text: 'rgba(0,0,0,.9)', sub: 'rgba(0,0,0,.5)', line: 'rgba(0,0,0,.08)', fill: 'rgba(0,0,0,.04)', dark: false },
  // 夜间:暖色深底 + 暖灰字,对比度压到 6:1 左右(纯黑底配亮白字在暗处刺眼);强调色也调暗
  { id: 'night', label: '夜间', paper: '#1C1B19', page: '#151412', text: '#9E998F', sub: '#6B675F', line: 'rgba(255,245,230,.07)', fill: 'rgba(255,245,230,.05)', dark: true, accent: '#B0564E' },
];

export const READER_ACCENT = '#E5353E';

export function accentOf(theme: ReaderTheme): string {
  return theme.accent ?? READER_ACCENT;
}

export const READER_FONTS = [
  { id: 'hei', label: '黑体', css: 'SourceHanSansSC-Regular, "Source Han Sans SC", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif' },
  { id: 'song', label: '宋体', css: '"Source Han Serif SC", "Noto Serif SC", "Songti SC", STSong, SimSun, serif' },
  { id: 'kai', label: '楷体', css: '"Kaiti SC", STKaiti, KaiTi, "楷体", serif' },
] as const;

/** 页面宽度,0 = 自动(按屏宽取 800 / 1000) */
export const READER_WIDTHS = [0, 640, 800, 900, 1000, 1280] as const;

export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 36;

export interface ReaderPrefs {
  theme: string;
  /** 切到夜间前的日间主题,夜间按钮切回用 */
  dayTheme: string;
  font: string;
  fontSize: number;
  width: number;
  /** scroll = 整章连续滚,到章末自动接下一章;
   *  overlay = 章内分页 + CSS transform 覆盖翻页;
   *  swipe = 章内分页 + 仿真卷页(沿折线翻起,纸背透字) */
  mode: 'scroll' | 'overlay' | 'swipe';
}

export const DEFAULT_PREFS: ReaderPrefs = {
  theme: 'default',
  dayTheme: 'default',
  font: 'hei',
  fontSize: 18,
  width: 0,
  mode: 'overlay',
};

const PREFS_KEY = 'qq-novel-reader-prefs';

export function themeOf(id: string): ReaderTheme {
  return READER_THEMES.find((t) => t.id === id) ?? READER_THEMES[0];
}

export function fontOf(id: string): string {
  return (READER_FONTS.find((f) => f.id === id) ?? READER_FONTS[0]).css;
}

/** 纸张噪点纹理,叠在底色上 */
export function noiseLayer(dark: boolean): string {
  // 深色底上的白噪点很显眼,夜间压淡
  const alpha = dark ? 0.025 : 0.07;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 ${dark ? 1 : 0} 0 0 0 0 ${dark ? 1 : 0} 0 0 0 0 ${dark ? 1 : 0} 0 0 0 ${alpha} 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`;
  return `url("data:image/svg+xml;utf8,${svg}")`;
}

/** 偏好存 localStorage;首帧用默认值,挂载后再读,避免 hydration 不一致。 */
export function useReaderPrefs() {
  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
      if (saved && typeof saved === 'object') {
        const merged = { ...DEFAULT_PREFS, ...saved };
        // 老版本存的 mode:'page'(一章一页)已下线,落到默认分页模式
        if (!['scroll', 'overlay', 'swipe'].includes(merged.mode)) merged.mode = DEFAULT_PREFS.mode;
        setPrefs(merged);
      }
    } catch {
      /* 读不到就用默认 */
    }
  }, []);

  const update = useCallback((patch: Partial<ReaderPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      if (patch.theme && patch.theme !== 'night') next.dayTheme = patch.theme;
      next.fontSize = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, next.fontSize));
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* 隐私模式写不进去也照常用 */
      }
      return next;
    });
  }, []);

  const toggleNight = useCallback(() => {
    setPrefs((prev) => {
      const next = { ...prev, theme: prev.theme === 'night' ? prev.dayTheme || 'default' : 'night' };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { prefs, update, toggleNight };
}

const PROGRESS_KEY = 'qq-novel-progress:';

/**
 * 每本书最后读到的位置。老格式(纯 chapterId 字符串)兼容。
 * page 是章内页号,换了屏幕尺寸 / 字号就不准;para + offset 是该页第一个字所在的段落和段内偏移,
 * 恢复时优先按它找回同一段文字。updatedAt(毫秒)用来在本地和服务端两份里挑新的。
 */
export interface ProgressPayload {
  chapterId: string;
  page: number;
  para?: number;
  offset?: number;
  updatedAt?: number;
}

function normalizeProgress(raw: unknown): ProgressPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.chapterId !== 'string' || !p.chapterId) return null;
  const num = (v: unknown) => Math.max(0, Number(v) || 0);
  return { chapterId: p.chapterId, page: num(p.page), para: num(p.para), offset: num(p.offset), updatedAt: num(p.updatedAt) };
}

export function loadProgress(bookId: string): ProgressPayload | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY + bookId);
    if (!raw) return null;
    try {
      return normalizeProgress(JSON.parse(raw)) ?? { chapterId: raw, page: 0 };
    } catch {
      return { chapterId: raw, page: 0 };
    }
  } catch {
    return null;
  }
}

/** 本地和服务端两份进度里取较新的一份 */
export function newerProgress(a: ProgressPayload | null, b: ProgressPayload | null): ProgressPayload | null {
  if (!a) return b;
  if (!b) return a;
  return (b.updatedAt ?? 0) > (a.updatedAt ?? 0) ? b : a;
}

const SYNC_DELAY_MS = 1500;
let pendingSync: { bookId: string; payload: ProgressPayload } | null = null;
let syncTimer: ReturnType<typeof setTimeout> | undefined;

function flushSync() {
  clearTimeout(syncTimer);
  syncTimer = undefined;
  const job = pendingSync;
  pendingSync = null;
  if (!job) return;
  void saveNovelProgress({ bookId: job.bookId, deviceId: visitorId(), ...job.payload }).catch(() => {
    /* 网络不通就只留本地那份,下次翻页再同步 */
  });
}

if (typeof window !== 'undefined') {
  // 切后台 / 关页面时把还没发出去的进度立刻发掉(手机上切走 App 常常就不回来了)
  const onHide = () => {
    if (document.visibilityState === 'hidden') flushSync();
  };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', flushSync);
}

/** 本地立即写;服务端按设备 id(登录后也挂到账号上)合并后延迟写,连续翻页只发最后一次 */
export function saveProgress(bookId: string, payload: ProgressPayload) {
  const stamped = { ...payload, updatedAt: Date.now() };
  try {
    localStorage.setItem(PROGRESS_KEY + bookId, JSON.stringify(stamped));
  } catch {
    /* ignore */
  }
  // 换了一本书,上一本的先发掉
  if (pendingSync && pendingSync.bookId !== bookId) flushSync();
  pendingSync = { bookId, payload: stamped };
  clearTimeout(syncTimer);
  syncTimer = setTimeout(flushSync, SYNC_DELAY_MS);
}

/** 服务端这台设备(登录时含本人其它设备)的进度;拿不到返回 null */
export async function fetchRemoteProgress(bookId: string): Promise<ProgressPayload | null> {
  const deviceId = visitorId();
  try {
    return normalizeProgress(await getNovelProgress({ bookId, deviceId }));
  } catch {
    return null;
  }
}

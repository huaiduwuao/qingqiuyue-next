'use client';

import { useCallback, useEffect, useState } from 'react';

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
}

export const READER_THEMES: ReaderTheme[] = [
  { id: 'default', label: '默认', paper: '#F5F1E8', page: '#EBE6DA', text: 'rgba(0,0,0,.9)', sub: 'rgba(0,0,0,.5)', line: 'rgba(0,0,0,.08)', fill: 'rgba(0,0,0,.04)', dark: false },
  { id: 'gray', label: '素灰', paper: '#E0E0E0', page: '#D3D3D3', text: 'rgba(0,0,0,.9)', sub: 'rgba(0,0,0,.5)', line: 'rgba(0,0,0,.08)', fill: 'rgba(0,0,0,.05)', dark: false },
  { id: 'yellow', label: '米黄', paper: '#F4ECD1', page: '#E9DFBF', text: 'rgba(0,0,0,.9)', sub: 'rgba(0,0,0,.5)', line: 'rgba(0,0,0,.08)', fill: 'rgba(0,0,0,.04)', dark: false },
  { id: 'green', label: '护眼', paper: '#DAF2DA', page: '#CBE5CB', text: 'rgba(0,0,0,.9)', sub: 'rgba(0,0,0,.5)', line: 'rgba(0,0,0,.08)', fill: 'rgba(0,0,0,.04)', dark: false },
  { id: 'blue', label: '天青', paper: '#DCEAEE', page: '#CDDDE2', text: 'rgba(0,0,0,.9)', sub: 'rgba(0,0,0,.5)', line: 'rgba(0,0,0,.08)', fill: 'rgba(0,0,0,.04)', dark: false },
  { id: 'night', label: '夜间', paper: '#191919', page: '#0E0E0E', text: 'rgba(255,255,255,.72)', sub: 'rgba(255,255,255,.4)', line: 'rgba(255,255,255,.08)', fill: 'rgba(255,255,255,.06)', dark: true },
];

export const READER_ACCENT = '#E5353E';

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
  const alpha = dark ? 0.05 : 0.07;
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

/** 每本书最后读到的位置。老格式(纯 chapterId 字符串)兼容。 */
export interface ProgressPayload {
  chapterId: string;
  page: number;
}

export function loadProgress(bookId: string): ProgressPayload | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY + bookId);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.chapterId === 'string') {
        return { chapterId: parsed.chapterId, page: Number(parsed.page) || 0 };
      }
      return { chapterId: raw, page: 0 };
    } catch {
      return { chapterId: raw, page: 0 };
    }
  } catch {
    return null;
  }
}

export function saveProgress(bookId: string, payload: ProgressPayload) {
  try {
    localStorage.setItem(PROGRESS_KEY + bookId, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

/** 正文按换行拆段;去掉源站自带的段首空格(全角/半角),缩进统一交给 text-indent。 */
export function splitParagraphs(body: string): string[] {
  return body
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map((line) => line.replace(/^[\s　 ]+|[\s　 ]+$/g, ''))
    .filter(Boolean);
}

export function wordCount(body: string): number {
  return body.replace(/[\s　 ]/g, '').length;
}

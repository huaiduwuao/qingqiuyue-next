'use client';

import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { lightTheme, darkTheme } from '@/styles/theme';

type ThemeMode = 'light' | 'dark';
/** 用户偏好:显式选了亮/暗,或跟随系统(默认) */
type ThemePreference = ThemeMode | 'system';

const MODE_KEY = 'theme-mode';
const DARK_QUERY = '(prefers-color-scheme: dark)';

export const PRESET_COLORS = [
  { key: 'douyin', label: '抖音红', value: '#FE2C55' },
  { key: 'violet', label: '紫罗兰', value: '#8B5CF6' },
  { key: 'blue', label: '天空蓝', value: '#3B82F6' },
  { key: 'green', label: '翡翠绿', value: '#10B981' },
  { key: 'amber', label: '琥珀橙', value: '#F59E0B' },
  { key: 'pink', label: '樱花粉', value: '#EC4899' },
] as const;

interface ThemeContextType {
  /** 实际生效的明暗(跟随系统时已按 prefers-color-scheme 解析) */
  mode: ThemeMode;
  preference: ThemePreference;
  toggleTheme: () => void;
  setTheme: (mode: ThemePreference) => void;
  primaryColor: string;
  setPrimaryColor: (color: string) => void;
  presetColors: typeof PRESET_COLORS;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useThemeMode() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeProvider');
  }
  return context;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // 初始 mode 固定 'light' —— 避免 SSR/CSR theme 不一致导致 hydration mismatch
  // (server 无 window,client 读 localStorage/matchMedia,两边值会不一样 → MUI 生成的 styles 不同 → emotion hash 撞不上)
  // 客户端 mount 后再切到用户实际偏好(下面的 useEffect)
  //
  // 存的是「偏好」而不是解析后的明暗:以前 mount 时把解析结果写回 localStorage,
  // 第一次访问之后「跟随系统」就被固化成当时的亮/暗,系统再切换也不跟了。
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [systemDark, setSystemDark] = useState(false);
  const [primaryColor, setPrimaryColorState] = useState<string>(PRESET_COLORS[0].value);
  const mode: ThemeMode = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  // 客户端 mount 后同步 localStorage / prefers-color-scheme
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') setPreference(saved);
      const savedColor = localStorage.getItem('theme-primary');
      if (savedColor) setPrimaryColorState(savedColor);
    } catch {
      /* 隐私模式读不到就用默认 */
    }
    const mq = window.matchMedia?.(DARK_QUERY);
    if (!mq) return;
    const sync = () => setSystemDark(mq.matches);
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  /** 只有用户主动选择时才写 localStorage */
  const choose = (next: ThemePreference) => {
    setPreference(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    document.documentElement.style.setProperty('--brand-color', primaryColor);
  }, [primaryColor]);

  const toggleTheme = () => {
    choose(mode === 'light' ? 'dark' : 'light');
  };

  const setTheme = (next: ThemePreference) => {
    choose(next);
  };

  const setPrimaryColor = (color: string) => {
    setPrimaryColorState(color);
    try {
      localStorage.setItem('theme-primary', color);
    } catch {
      /* ignore */
    }
  };

  const theme = useMemo(() => {
    const base = mode === 'dark' ? darkTheme : lightTheme;
    return createTheme(base, {
      palette: {
        primary: { main: primaryColor },
      },
    });
  }, [mode, primaryColor]);

  return (
    <ThemeContext.Provider value={{ mode, preference, toggleTheme, setTheme, primaryColor, setPrimaryColor, presetColors: PRESET_COLORS }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}

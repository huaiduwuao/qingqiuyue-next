'use client';

import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { lightTheme, darkTheme } from '@/styles/theme';

type ThemeMode = 'light' | 'dark';

export const PRESET_COLORS = [
  { key: 'douyin', label: '抖音红', value: '#FE2C55' },
  { key: 'violet', label: '紫罗兰', value: '#8B5CF6' },
  { key: 'blue', label: '天空蓝', value: '#3B82F6' },
  { key: 'green', label: '翡翠绿', value: '#10B981' },
  { key: 'amber', label: '琥珀橙', value: '#F59E0B' },
  { key: 'pink', label: '樱花粉', value: '#EC4899' },
] as const;

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
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
  const [mode, setMode] = useState<ThemeMode>('light');
  const [primaryColor, setPrimaryColorState] = useState<string>(PRESET_COLORS[0].value);

  // 客户端 mount 后同步 localStorage / prefers-color-scheme
  useEffect(() => {
    const saved = localStorage.getItem('theme-mode') as ThemeMode | null;
    if (saved === 'light' || saved === 'dark') {
      setMode(saved);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setMode('dark');
    }
    const savedColor = localStorage.getItem('theme-primary');
    if (savedColor) setPrimaryColorState(savedColor);
  }, []);

  useEffect(() => {
    localStorage.setItem('theme-mode', mode);
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  useEffect(() => {
    document.documentElement.style.setProperty('--brand-color', primaryColor);
    localStorage.setItem('theme-primary', primaryColor);
  }, [primaryColor]);

  const toggleTheme = () => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setTheme = (newMode: ThemeMode) => {
    setMode(newMode);
  };

  const setPrimaryColor = (color: string) => {
    setPrimaryColorState(color);
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
    <ThemeContext.Provider value={{ mode, toggleTheme, setTheme, primaryColor, setPrimaryColor, presetColors: PRESET_COLORS }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}

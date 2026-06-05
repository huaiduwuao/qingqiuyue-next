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

const THEME_VARS: Record<ThemeMode, Record<string, string>> = {
  light: {
    '--bg-body': '#F5F5F7',
    '--bg-topbar': 'rgba(255, 255, 255, 0.85)',
    '--bg-sidebar': 'rgba(255, 255, 255, 0.72)',
    '--bg-surface': 'rgba(255, 255, 255, 0.7)',
    '--bg-elevated': 'rgba(255, 255, 255, 0.92)',
    '--bg-card': 'rgba(255, 255, 255, 0.85)',
    '--bg-input': 'rgba(0, 0, 0, 0.04)',
    '--bg-hover': 'rgba(0, 0, 0, 0.04)',
    '--bg-active': 'rgba(0, 0, 0, 0.06)',
    '--border-color': 'rgba(0, 0, 0, 0.08)',
    '--border-strong': 'rgba(0, 0, 0, 0.14)',
    '--text-primary': 'rgba(0, 0, 0, 0.9)',
    '--text-secondary': 'rgba(0, 0, 0, 0.65)',
    '--text-muted': 'rgba(0, 0, 0, 0.45)',
    '--text-disabled': 'rgba(0, 0, 0, 0.3)',
  },
  dark: {
    '--bg-body': '#000000',
    '--bg-topbar': 'rgba(0, 0, 0, 0.85)',
    '--bg-sidebar': 'rgba(0, 0, 0, 0.5)',
    '--bg-surface': 'rgba(20, 22, 32, 0.6)',
    '--bg-elevated': 'rgba(20, 22, 32, 0.85)',
    '--bg-card': 'rgba(20, 22, 32, 0.6)',
    '--bg-input': 'rgba(255, 255, 255, 0.06)',
    '--bg-hover': 'rgba(255, 255, 255, 0.05)',
    '--bg-active': 'rgba(255, 255, 255, 0.08)',
    '--border-color': 'rgba(255, 255, 255, 0.06)',
    '--border-strong': 'rgba(255, 255, 255, 0.12)',
    '--text-primary': 'rgba(255, 255, 255, 0.95)',
    '--text-secondary': 'rgba(255, 255, 255, 0.7)',
    '--text-muted': 'rgba(255, 255, 255, 0.4)',
    '--text-disabled': 'rgba(255, 255, 255, 0.25)',
  },
};

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
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem('theme-mode') as ThemeMode | null;
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [primaryColor, setPrimaryColorState] = useState<string>(() => {
    if (typeof window === 'undefined') return PRESET_COLORS[0].value;
    return localStorage.getItem('theme-primary') || PRESET_COLORS[0].value;
  });

  useEffect(() => {
    localStorage.setItem('theme-mode', mode);
    const vars = THEME_VARS[mode];
    Object.entries(vars).forEach(([k, v]) => {
      document.documentElement.style.setProperty(k, v);
    });
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

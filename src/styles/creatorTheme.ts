'use client';

import { createTheme, ThemeOptions } from '@mui/material/styles';
import { dataGridComponents } from './dataGridTheme';

// 抖音创作者中心主题 - 深色风格
const douyinBase: ThemeOptions = {
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      'PingFang SC',
      'Segoe UI',
      'Roboto',
      'Microsoft YaHei',
      'sans-serif',
    ].join(','),
    h1: { fontSize: '2rem', fontWeight: 700 },
    h2: { fontSize: '1.75rem', fontWeight: 700 },
    h3: { fontSize: '1.5rem', fontWeight: 600 },
    h4: { fontSize: '1.25rem', fontWeight: 600 },
    h5: { fontSize: '1.125rem', fontWeight: 600 },
    h6: { fontSize: '1rem', fontWeight: 600 },
    body1: { fontSize: '0.875rem', lineHeight: 1.6 },
    body2: { fontSize: '0.8125rem', lineHeight: 1.5 },
    caption: { fontSize: '0.75rem', color: '#8B8FA3' },
    button: { textTransform: 'none', fontWeight: 500 },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      defaultProps: { variant: 'contained', disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 4,
          padding: '8px 16px',
          transition: 'all 0.2s ease-in-out',
          '&:hover': { transform: 'translateY(-1px)' },
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { borderRadius: 8, backgroundImage: 'none' },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundImage: 'none',
          transition: 'all 0.25s ease-in-out',
          '&:hover': { transform: 'translateY(-2px)' },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { transition: 'all 0.15s ease-in-out' },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 4, fontWeight: 500 },
      },
    },
  },
};

export const douyinDarkTheme = createTheme({
  ...douyinBase,
  components: {
    ...douyinBase.components,
    ...dataGridComponents,
  },
  palette: {
    mode: 'dark',
    primary: {
      main: '#FE2C55',
      light: '#FF4D75',
      dark: '#D81B42',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#25F4EE',
      light: '#5DF7F2',
      dark: '#1AC3BD',
      contrastText: '#0A0B14',
    },
    success: { main: '#5DDB96', light: '#85E5B0', dark: '#3CB876' },
    error: { main: '#FE2C55', light: '#FF4D75', dark: '#D81B42' },
    warning: { main: '#FFB400', light: '#FFC533', dark: '#CC9100' },
    info: { main: '#25F4EE', light: '#5DF7F2', dark: '#1AC3BD' },
    background: {
      default: '#0A0B14',
      paper: '#161821',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#8B8FA3',
      tertiary: '#C5C8D6',
      disabled: '#5A5E72',
    },
    divider: '#252836',
    action: {
      active: '#FFFFFF',
      hover: 'rgba(255, 255, 255, 0.06)',
      selected: 'rgba(254, 44, 85, 0.15)',
      disabled: '#5A5E72',
      disabledBackground: '#252836',
    },
  },
});

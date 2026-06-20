'use client';

import { createTheme, ThemeOptions } from '@mui/material/styles';
import { dataGridComponents } from './dataGridTheme';

// Design System Tokens - 清秋月内容平台
// Based on Data-Dense Dashboard style with dark mode support

const baseTheme: ThemeOptions = {
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      'Segoe UI',
      'Roboto',
      'Fira Sans',
      'Microsoft YaHei',
      'sans-serif',
    ].join(','),
    h1: {
      fontSize: '1.75rem',
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '-0.02em',
      '@media (min-width:900px)': { fontSize: '2.25rem' },
      '@media (min-width:1200px)': { fontSize: '2.75rem' },
    },
    h2: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.3,
      letterSpacing: '-0.01em',
      '@media (min-width:900px)': { fontSize: '1.875rem' },
      '@media (min-width:1200px)': { fontSize: '2.25rem' },
    },
    h3: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.4,
      '@media (min-width:900px)': { fontSize: '1.5rem' },
      '@media (min-width:1200px)': { fontSize: '1.75rem' },
    },
    h4: {
      fontSize: '1.125rem',
      fontWeight: 600,
      lineHeight: 1.4,
      '@media (min-width:900px)': { fontSize: '1.25rem' },
      '@media (min-width:1200px)': { fontSize: '1.375rem' },
    },
    h5: {
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: 1.5,
      '@media (min-width:900px)': { fontSize: '1.125rem' },
      '@media (min-width:1200px)': { fontSize: '1.25rem' },
    },
    h6: {
      fontSize: '0.875rem',
      fontWeight: 600,
      lineHeight: 1.5,
      '@media (min-width:1200px)': { fontSize: '1rem' },
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
    },
    caption: {
      fontSize: '0.75rem',
      lineHeight: 1.5,
      color: 'text.secondary',
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 0,
  },
  components: {
    MuiButton: {
      defaultProps: {
        variant: 'contained',
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 0,
          padding: '8px 16px',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-1px)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          },
        },
        outlined: {
          borderWidth: '1.5px',
          '&:hover': {
            borderWidth: '1.5px',
          },
        },
        sizeSmall: {
          padding: '4px 12px',
          fontSize: '0.8125rem',
        },
        sizeLarge: {
          padding: '12px 24px',
          fontSize: '1rem',
        },
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 0,
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            transform: 'translateY(-2px)',
          },
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          borderRadius: 0,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        size: 'small',
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 0,
            transition: 'all 0.2s ease-in-out',
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'primary.main',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderWidth: '2px',
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          fontWeight: 500,
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: 'transparent',
          '& .MuiTableCell-head': {
            fontWeight: 600,
            fontSize: 13,
            color: 'text.secondary',
            backgroundColor: 'transparent',
            borderBottom: '1px solid',
            borderColor: 'divider',
            textAlign: 'center',
            whiteSpace: 'nowrap',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: 'transparent',
          padding: '14px 12px',
          fontSize: 13,
          color: 'text.primary',
          textAlign: 'center',
          verticalAlign: 'middle',
        },
        head: {
          borderBottom: '1px solid',
          borderColor: 'divider',
        },
        stickyHeader: {
          backgroundColor: 'background.paper',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'none',
          '&:hover': {
            backgroundColor: 'transparent',
          },
          '&:last-child .MuiTableCell-body': {
            borderBottom: 'none',
          },
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          backgroundColor: 'transparent',
          boxShadow: 'none',
        },
      },
    },
    MuiTablePagination: {
      styleOverrides: {
        root: {
          color: 'text.secondary',
          fontSize: 12,
          borderTop: '1px solid',
          borderColor: 'divider',
        },
        toolbar: {
          minHeight: 48,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 0,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: 'none',
        },
      },
    },
    MuiAppBar: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {},
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: '2px 8px',
          padding: '8px 12px',
          transition: 'all 0.15s ease-in-out',
          '&:hover': {
            backgroundColor: 'action.hover',
          },
          '&.Mui-selected': {
            backgroundColor: 'primary.main',
            color: 'primary.contrastText',
            '&:hover': {
              backgroundColor: 'primary.dark',
            },
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          minHeight: 48,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          borderRadius: '3px 3px 0 0',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: ({ theme }) => ({
          backgroundColor:
            theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.92)' : 'rgba(51, 65, 85, 0.95)',
          color: theme.palette.common.white,
          borderRadius: 6,
          fontSize: '0.75rem',
          padding: '6px 12px',
        }),
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: 'all 0.15s ease-in-out',
          '&:hover': {
            backgroundColor: 'action.hover',
          },
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
      },
    },
    MuiBadge: {
      styleOverrides: {
        badge: {
          fontWeight: 600,
        },
      },
    },
  },
};

// Light Theme - 清秋月内容平台 (Elegant Autumn Moon)
export const lightTheme = createTheme({
  ...baseTheme,
  palette: {
    mode: 'light',
    primary: {
      main: '#7C3AED',    // Deep violet - elegant and refined
      light: '#A78BFA',
      dark: '#5B21B6',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#0369A1',    // Ocean blue - trust and depth
      light: '#38BDF8',
      dark: '#075985',
      contrastText: '#FFFFFF',
    },
    success: {
      main: '#059669',    // Jade green - fresh and natural
      light: '#34D399',
      dark: '#047857',
      contrastText: '#FFFFFF',
    },
    error: {
      main: '#DC2626',
      light: '#F87171',
      dark: '#B91C1C',
      contrastText: '#FFFFFF',
    },
    warning: {
      main: '#D97706',    // Amber - warm autumn
      light: '#FBBF24',
      dark: '#B45309',
      contrastText: '#FFFFFF',
    },
    info: {
      main: '#0891B2',    // Teal - calm clarity
      light: '#22D3EE',
      dark: '#0E7490',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#FAFAFA',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1F2937',
      secondary: '#6B7280',
      tertiary: '#4B5563',
      disabled: '#9CA3AF',
    },
    divider: '#E5E7EB',
    action: {
      active: '#6B7280',
      hover: 'rgba(124, 58, 237, 0.04)',
      selected: 'rgba(124, 58, 237, 0.08)',
      disabled: '#D1D5DB',
      disabledBackground: '#F3F4F6',
    },
  },
  components: {
    ...baseTheme.components,
    ...dataGridComponents,
    MuiCard: {
      ...baseTheme.components?.MuiCard,
      styleOverrides: {
        root: {
          border: '1px solid #E5E7EB',
          borderRadius: 0,
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            boxShadow: '0 4px 20px rgba(124, 58, 237, 0.1)',
            transform: 'translateY(-2px)',
          },
        },
      },
    },
    MuiAppBar: {
      ...baseTheme.components?.MuiAppBar,
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          color: '#1F2937',
          borderBottom: '1px solid #E5E7EB',
        },
      },
    },
    MuiDrawer: {
      ...baseTheme.components?.MuiDrawer,
      styleOverrides: {
        paper: {
          backgroundColor: '#FFFFFF',
          borderRight: '1px solid #E5E7EB',
        },
      },
    },
    MuiListItemButton: {
      ...baseTheme.components?.MuiListItemButton,
      styleOverrides: {
        root: {
          '&.Mui-selected': {
            backgroundColor: 'rgba(124, 58, 237, 0.1)',
            color: '#7C3AED',
            '&:hover': {
              backgroundColor: 'rgba(124, 58, 237, 0.15)',
            },
          },
        },
      },
    },
  },
});

// Dark Theme - 清秋月内容平台 (Elegant Autumn Moon)
export const darkTheme = createTheme({
  ...baseTheme,
  palette: {
    mode: 'dark',
    primary: {
      main: '#A78BFA',    // Soft violet for dark mode
      light: '#C4B5FD',
      dark: '#7C3AED',
      contrastText: '#1E1B4B',
    },
    secondary: {
      main: '#38BDF8',    // Sky blue for dark mode
      light: '#7DD3FC',
      dark: '#0369A1',
      contrastText: '#082F49',
    },
    success: {
      main: '#34D399',    // Jade for dark mode
      light: '#6EE7B7',
      dark: '#059669',
      contrastText: '#022C22',
    },
    error: {
      main: '#F87171',
      light: '#FCA5A5',
      dark: '#DC2626',
      contrastText: '#450A0A',
    },
    warning: {
      main: '#FBBF24',    // Amber for dark mode
      light: '#FCD34D',
      dark: '#D97706',
      contrastText: '#1F2937',
    },
    info: {
      main: '#22D3EE',    // Teal for dark mode
      light: '#67E8F9',
      dark: '#0891B2',
      contrastText: '#083344',
    },
    background: {
      default: '#000000',
      paper: '#000000',
    },
    text: {
      primary: '#F1F5F9',
      secondary: '#CBD5E1',
      tertiary: '#94A3B8',
      disabled: '#94A3B8',
    },
    divider: '#334155',
    action: {
      active: '#CBD5E1',
      hover: 'rgba(167, 139, 250, 0.08)',
      selected: 'rgba(167, 139, 250, 0.12)',
      disabled: '#64748B',
      disabledBackground: '#334155',
    },
  },
  components: {
    ...baseTheme.components,
    ...dataGridComponents,
    MuiCard: {
      ...baseTheme.components?.MuiCard,
      styleOverrides: {
        root: {
          border: '1px solid #334155',
          borderRadius: 0,
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            boxShadow: '0 4px 20px rgba(167, 139, 250, 0.15)',
            transform: 'translateY(-2px)',
          },
        },
      },
    },
    MuiAppBar: {
      ...baseTheme.components?.MuiAppBar,
      styleOverrides: {
        root: {
          backgroundColor: '#1E293B',
          color: '#F1F5F9',
          borderBottom: '1px solid #334155',
        },
      },
    },
    MuiDrawer: {
      ...baseTheme.components?.MuiDrawer,
      styleOverrides: {
        paper: {
          backgroundColor: '#1E293B',
          borderRight: '1px solid #334155',
        },
      },
    },
    MuiListItemButton: {
      ...baseTheme.components?.MuiListItemButton,
      styleOverrides: {
        root: {
          '&.Mui-selected': {
            backgroundColor: 'rgba(167, 139, 250, 0.15)',
            color: '#C4B5FD',
            '&:hover': {
              backgroundColor: 'rgba(167, 139, 250, 0.2)',
            },
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
  },
});

// Export default as light theme
export const theme = lightTheme;

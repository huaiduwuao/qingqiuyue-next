import type { Components, Theme } from '@mui/material/styles';

/**
 * 共享的 DataGrid 主题覆盖 — 同时被 theme.ts 和 creatorTheme.ts 引用。
 *
 * 注意:DataGrid 内部会注入一个 .MuiDataGridVariables-{hash} 类,
 * 同样把这些 t- CSS 变量设成默认 #FFF,优先级跟我们这里平级且声明更晚。
 * 用属性选择器把特异性从 0,1,0 拉到 0,2,0 压过它。
 */
export const dataGridComponents: Components<Omit<Theme, 'components'>> = {
  MuiDataGrid: {
    styleOverrides: {
      root: ({ theme }) => ({
        border: 'none',
        backgroundColor: 'transparent',
        color: theme.palette.text.primary,
        fontSize: 13,
        '--DataGrid-rowBorderColor': 'transparent',
        '--DataGrid-columnBorderColor': 'transparent',
        '&[class*="MuiDataGridVariables"]': {
          '--DataGrid-t-color-background-base': theme.palette.background.default,
          '--DataGrid-t-color-background-overlay': theme.palette.background.paper,
          '--DataGrid-t-color-foreground-base': theme.palette.text.primary,
          '--DataGrid-t-color-border-base': theme.palette.divider,
          '--DataGrid-t-header-background-base': 'transparent',
          '--DataGrid-t-cell-background-pinned': 'transparent',
        },
        '--unstable_DataGrid-headings-opacity': 1,
      }),
      main: ({ theme }) => ({
        backgroundColor: 'transparent',
        color: theme.palette.text.primary,
      }),
      panel: ({ theme }) => ({
        backgroundColor: theme.palette.background.paper,
        color: theme.palette.text.primary,
      }),
      columnHeaders: ({ theme }) => ({
        backgroundColor: 'transparent',
        borderBottom: `1px solid ${theme.palette.divider}`,
        color: theme.palette.text.secondary,
        fontSize: 13,
        fontWeight: 600,
      }),
      columnHeader: {
        '&:focus, &:focus-within': { outline: 'none' },
        '&[data-field="__check__"], &[data-field="actions"]': {
          color: 'inherit',
        },
      },
      cell: ({ theme }) => ({
        borderBottom: 'none',
        color: theme.palette.text.primary,
        padding: '12px 14px',
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        '&:focus, &:focus-within': { outline: 'none' },
      }),
      row: ({ theme }) => ({
        backgroundColor: 'transparent',
        '&:hover': { backgroundColor: theme.palette.action.hover },
      }),
      footerContainer: ({ theme }) => ({
        borderTop: `1px solid ${theme.palette.divider}`,
        minHeight: 48,
        backgroundColor: 'transparent',
      }),
      overlay: { backgroundColor: 'transparent' },
      withBorderColor: { borderColor: 'transparent' },
      columnSeparator: { display: 'none' },
      virtualScroller: { backgroundColor: 'transparent' },
    },
  },
};

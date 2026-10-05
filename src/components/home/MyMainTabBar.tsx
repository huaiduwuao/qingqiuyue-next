'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { ListLayoutSwitch } from '@/components/common/ListLayout';
import type { MAIN_TABS } from './myHomeTabs';

/**
 * 主页签栏 + 布局切换 + 批量管理。外层 position:relative,右侧挂一条渐隐遮罩,
 * 提示"后面还有页签,可以横滑"。memo:输入搜索词、列表翻页时不重渲染。
 */
export const MyMainTabBar = React.memo(function MyMainTabBar({
  visibleTabs,
  mainTab,
  onSwitchTab: switchTab,
  batchMode,
  selected,
  filteredList,
  onSelectAll: selectAll,
  onBatchDelete: batchDelete,
  onEnterBatch: enterBatchMode,
  onExitBatch: exitBatchMode,
}: {
  visibleTabs: typeof MAIN_TABS;
  mainTab: string;
  onSwitchTab: (key: string) => void;
  batchMode: boolean;
  selected: Set<number>;
  filteredList: unknown[];
  onSelectAll: () => void;
  onBatchDelete: () => void;
  onEnterBatch: () => void;
  onExitBatch: () => void;
}) {
  return (
    <Box sx={{ position: 'relative', mb: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          borderBottom: '1px solid var(--border-color, transparent)',
          pb: 0,
          overflowX: 'auto',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
      {visibleTabs.map((t) => {
        const isActive = mainTab === t.key;
        return (
          <Box
            key={t.key}
            onClick={() => switchTab(t.key)}
            // 从侧边栏进的子页排在页签栏末尾,窄屏上会落在屏幕外:把选中项横向滚进可视区(只动横向)
            ref={isActive ? (el: HTMLDivElement | null) => {
              const bar = el?.parentElement;
              if (!el || !bar) return;
              const over = el.offsetLeft + el.offsetWidth - (bar.scrollLeft + bar.clientWidth);
              if (over > 0) bar.scrollLeft += over + 40; // 右缘有 32px 的渐隐遮罩
              else if (el.offsetLeft < bar.scrollLeft) bar.scrollLeft = el.offsetLeft;
            } : undefined}
            sx={{
              position: 'relative',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              // 手机上和精选的频道栏一样:纯文字、14px、间距紧、选中项下方一小截品牌色短条
              px: { xs: 1.25, md: 1.5 },
              py: { xs: 1, md: 1.25 },
              cursor: 'pointer',
              color: isActive
                ? { xs: 'var(--brand-color, #FE2C55)', md: 'var(--text-primary, currentColor)' }
                : 'var(--text-secondary, currentColor)',
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              borderBottom: { xs: 0, md: '2px solid' },
              borderColor: isActive ? 'primary.main' : 'transparent',
              mb: { xs: 0, md: '-1px' },
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
              '&:hover': { color: 'var(--text-primary, currentColor)' },
              '& > svg': { display: { xs: 'none', md: 'inline-block' } },
              '&::after': isActive ? {
                content: '""',
                display: { xs: 'block', md: 'none' },
                position: 'absolute',
                left: '50%',
                bottom: 2,
                width: 18,
                height: 3,
                ml: '-9px',
                borderRadius: 1.5,
                bgcolor: 'var(--brand-color, #FE2C55)',
              } : undefined,
            }}
          >
            {t.icon}
            <Typography component="span" sx={{ fontSize: { xs: 14, md: 13 }, fontWeight: isActive ? { xs: 700, md: 600 } : 400 }}>{t.label}</Typography>
          </Box>
        );
      })}

      <Box sx={{ flex: 1 }} />

      {/* 布局切换 / 批量管理:窄屏藏起,塞进 Tab 栏会把 11 个页签挤成横向滚动 */}
      <ListLayoutSwitch sx={{ mr: 1, display: { xs: 'none', sm: 'flex' } }} />

      {batchMode ? (
        <>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mr: 1 }}>
            已选 {selected.size} / {filteredList.length}
          </Typography>
          <Button
            size="small"
            onClick={selectAll}
            sx={{ textTransform: 'none', fontSize: 12, color: 'text.secondary' }}
          >
            {selected.size === filteredList.length && filteredList.length > 0 ? '取消全选' : '全选'}
          </Button>
          <Button
            size="small"
            onClick={batchDelete}
            disabled={selected.size === 0}
            sx={{ textTransform: 'none', fontSize: 12, color: selected.size === 0 ? 'text.disabled' : 'error.main' }}
          >
            删除
          </Button>
          <IconButton size="small" onClick={exitBatchMode} aria-label="退出批量">
            <CloseRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </>
      ) : (
        <Button
          variant="outlined"
          size="small"
          onClick={enterBatchMode}
          disabled={filteredList.length === 0}
          sx={{
            borderColor: 'var(--border-strong, transparent)',
            color: 'var(--text-secondary, currentColor)',
            textTransform: 'none',
            fontSize: 12,
            borderRadius: 1.5,
            whiteSpace: 'nowrap',
            display: { xs: 'none', sm: 'inline-flex' },
            '&:hover': { borderColor: 'var(--border-strong, transparent)', bgcolor: 'var(--bg-hover, transparent)' },
            '&.Mui-disabled': { color: 'var(--text-disabled, currentColor)', borderColor: 'var(--border-color, transparent)' },
          }}
        >
          批量管理
        </Button>
      )}
      </Box>

      {/* 右缘渐隐遮罩 + 一个小箭头,明确"还能横滑"。pointerEvents:none 不挡点击。 */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: '1px',
          width: 32,
          pointerEvents: 'none',
          display: { xs: 'flex', sm: 'none' },
          alignItems: 'center',
          justifyContent: 'flex-end',
          pr: 0.5,
          background: (t: any) =>
            t.palette.mode === 'dark'
              ? 'linear-gradient(90deg, rgba(20,22,32,0) 0%, rgba(20,22,32,0.9) 60%)'
              : 'linear-gradient(90deg, rgba(245,245,247,0) 0%, rgba(245,245,247,0.95) 60%)',
          color: 'var(--text-muted, currentColor)',
        }}
      >
      </Box>
    </Box>
  );
});

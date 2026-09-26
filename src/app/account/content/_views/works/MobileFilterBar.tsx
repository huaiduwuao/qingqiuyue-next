'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

export interface FilterChip {
  id: string;
  label: string;
  count?: number;
}

/**
 * 手机端创作者中心子页的「一行筛选」:横滑胶囊 + 右侧图标按钮(搜索 / 排序 / 类型菜单)。
 * 吸顶,和赏金广场(RewardSquareMobile)的筛选条同一套样式。
 * 电脑版那种 Tabs + 搜索框 + 多个 Select + 布局切换在手机上不出现。
 */
export default function MobileFilterBar({
  chips,
  value,
  onChange,
  search,
  actions,
  footer,
  first,
}: {
  chips: FilterChip[];
  value: string;
  onChange: (id: string) => void;
  /** 给了就在右侧放一个搜索图标,点开在下方出一行输入框 */
  search?: { value: string; onChange: (v: string) => void; placeholder: string };
  /** 右侧额外的图标按钮(排序/类型 Menu 的触发器等) */
  actions?: React.ReactNode;
  /** 筛选条下方的一行小字(计数、当前排序) */
  footer?: React.ReactNode;
  /** 是页面第一个元素:抵掉 main 的上内距,避免顶上空出两倍间距 */
  first?: boolean;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const keyword = search?.value ?? '';

  return (
    <Box
      sx={{
        position: 'sticky',
        top: -12,
        zIndex: 5,
        mx: -1.5,
        px: 1.5,
        pt: 1.5,
        pb: 0.75,
        mt: first ? -1.5 : 0,
        bgcolor: 'background.default',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            gap: 0.75,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {chips.map((c) => {
            const on = c.id === value;
            return (
              <Box
                key={c.id || 'all'}
                component="button"
                type="button"
                onClick={() => onChange(c.id)}
                sx={{
                  all: 'unset',
                  flexShrink: 0,
                  cursor: 'pointer',
                  px: 1.5,
                  py: 0.6,
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: on ? 700 : 500,
                  color: on ? '#fff' : 'text.secondary',
                  bgcolor: on ? 'primary.main' : 'background.paper',
                  border: '1px solid',
                  borderColor: on ? 'primary.main' : 'divider',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {c.label}
                {typeof c.count === 'number' && (
                  <Box component="span" sx={{ ml: 0.5, fontSize: 11, opacity: on ? 0.85 : 0.7 }}>
                    {c.count}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
        {search && (
          <IconButton
            size="small"
            aria-label="搜索"
            onClick={() => setSearchOpen((o) => !o)}
            sx={{ color: searchOpen || keyword ? 'primary.main' : 'text.secondary' }}
          >
            <SearchRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        )}
        {actions}
      </Box>
      {search && (searchOpen || keyword) && (
        <Box
          sx={{
            mt: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 0.75,
            borderRadius: 999,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <SearchRoundedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
          <InputBase
            autoFocus={!keyword}
            placeholder={search.placeholder}
            value={keyword}
            onChange={(e) => search.onChange(e.target.value)}
            sx={{ flex: 1, fontSize: 14 }}
          />
          {keyword && (
            <IconButton size="small" aria-label="清空" onClick={() => search.onChange('')} sx={{ p: 0.25 }}>
              <CloseRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Box>
      )}
      {footer && (
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, fontSize: 12, color: 'text.secondary', minHeight: 18 }}>
          {footer}
        </Box>
      )}
    </Box>
  );
}

/** 页面右下角唯一的主操作(创建合集 / 提现 / 发布…),位置避开底部导航和音乐底栏。 */
export const MOBILE_FAB_SX = {
  position: 'fixed',
  right: 16,
  bottom: 'calc(16px + var(--bottom-nav-inset, 0px) + var(--player-inset, 0px))',
  zIndex: 10,
  fontWeight: 700,
  boxShadow: '0 8px 20px rgba(254,44,85,0.35)',
} as const;

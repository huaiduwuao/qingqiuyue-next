'use client';

import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Menu from '@mui/material/Menu';
import SearchIcon from '@mui/icons-material/Search';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { DATE_RANGES, SUB_TABS } from './myHomeModel';

/**
 * 「作品」页签下的子页签 + 搜索框 + 日期筛选(手机是两个图标,桌面是一整行)。
 * 搜索框的即时输入只留在这里,防抖 300ms 后才交给父组件 —— 打字时整个「我的」页不跟着重渲染。
 */
export const MyWorksToolbar = React.memo(function MyWorksToolbar({
  showSubTabs,
  isMobile,
  subTab,
  setSubTab,
  dateRange,
  setDateRange,
  initialKeyword,
  onKeywordDebounced,
}: {
  showSubTabs: boolean;
  isMobile: boolean;
  subTab: string;
  setSubTab: (v: string) => void;
  dateRange: string;
  setDateRange: (v: string) => void;
  initialKeyword: string;
  /** 打字防抖后的关键词(已 trim):它才进 queryKey / 请求 */
  onKeywordDebounced: (kw: string) => void;
}) {
  // 手机上作品工具栏的搜索框收成一个图标,点开才占一行
  const [searchOpen, setSearchOpen] = useState(false);
  const [keyword, setKeyword] = useState(initialKeyword);
  const [dateMenuAnchor, setDateMenuAnchor] = useState<null | HTMLElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      onKeywordDebounced(keyword.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [keyword]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {showSubTabs && isMobile && (
        // 手机:子页签一行横滑,搜索/日期是两个图标;以前搜索框 + 日期按钮折成第二行
        <Box sx={{ mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ display: 'flex', gap: 0.5, flex: 1, minWidth: 0, overflowX: 'auto', '&::-webkit-scrollbar': { display: 'none' } }}>
              {SUB_TABS.map((t) => {
                const isActive = subTab === t.key;
                return (
                  <Box
                    key={t.key}
                    onClick={() => setSubTab(t.key)}
                    sx={{
                      flexShrink: 0,
                      px: 1.25,
                      py: 0.5,
                      borderRadius: 1.5,
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? '#fff' : 'var(--text-secondary, currentColor)',
                      bgcolor: isActive ? 'primary.main' : 'var(--bg-hover, transparent)',
                      border: '1px solid',
                      borderColor: isActive ? 'primary.main' : 'var(--border-color, transparent)',
                    }}
                  >
                    {t.label}
                  </Box>
                );
              })}
            </Box>
            <IconButton
              size="small"
              aria-label="搜索作品"
              onClick={() => setSearchOpen((o) => !o)}
              sx={{ color: searchOpen || keyword ? 'primary.main' : 'var(--text-secondary, currentColor)' }}
            >
              <SearchIcon sx={{ fontSize: 18 }} />
            </IconButton>
            <IconButton
              size="small"
              aria-label="日期筛选"
              onClick={(e) => setDateMenuAnchor(e.currentTarget)}
              sx={{ color: dateRange !== 'all' ? 'primary.main' : 'var(--text-secondary, currentColor)' }}
            >
              <CalendarMonthIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
          {(searchOpen || keyword) && (
            <TextField
              fullWidth
              autoFocus={searchOpen && !keyword}
              size="small"
              placeholder="搜索你发布的作品"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 14, color: 'var(--text-muted, currentColor)' }} />
                    </InputAdornment>
                  ),
                  sx: { bgcolor: 'var(--bg-hover, transparent)', fontSize: 13, borderRadius: 1.5, '& fieldset': { borderColor: 'var(--border-color, transparent)' } },
                },
              }}
              sx={{ mt: 1 }}
            />
          )}
        </Box>
      )}
      {/* 日期菜单两端共用(手机从图标打开,桌面从按钮打开) */}
      <Menu
        anchorEl={dateMenuAnchor}
        open={!!dateMenuAnchor}
        onClose={() => setDateMenuAnchor(null)}
      >
        {DATE_RANGES.map((d) => (
          <Box
            key={d.key}
            onClick={() => {
              setDateRange(d.key);
              setDateMenuAnchor(null);
            }}
            sx={{
              px: 2,
              py: 1,
              fontSize: 12,
              cursor: 'pointer',
              minWidth: 120,
              color: dateRange === d.key ? 'primary.main' : 'text.primary',
              fontWeight: dateRange === d.key ? 600 : 400,
              '&:hover': { bgcolor: 'var(--bg-hover, transparent)' },
            }}
          >
            {d.label}
          </Box>
        ))}
      </Menu>
      {showSubTabs && !isMobile && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {SUB_TABS.map((t) => {
              const isActive = subTab === t.key;
              return (
                <Box
                  key={t.key}
                  onClick={() => setSubTab(t.key)}
                  sx={{
                    px: 1.25,
                    py: 0.5,
                    borderRadius: 1.5,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? '#fff' : 'var(--text-secondary, currentColor)',
                    bgcolor: isActive ? 'primary.main' : 'var(--bg-hover, transparent)',
                    border: '1px solid',
                    borderColor: isActive ? 'primary.main' : 'var(--border-color, transparent)',
                    transition: 'all 0.15s',
                    '&:hover': { borderColor: isActive ? 'primary.main' : 'var(--border-color, transparent)' },
                  }}
                >
                  {t.label}
                </Box>
              );
            })}
          </Box>

          <Box sx={{ flex: 1 }} />

          <TextField
            size="small"
            placeholder="搜索你发布的作品"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 14, color: 'var(--text-muted, currentColor)' }} />
                  </InputAdornment>
                ),
                sx: {
                  bgcolor: 'var(--bg-hover, transparent)',
                  color: 'var(--text-primary, currentColor)',
                  fontSize: 12,
                  borderRadius: 1.5,
                  '& input::placeholder': { color: 'var(--text-muted, currentColor)', opacity: 1 },
                  '& fieldset': { borderColor: 'var(--border-color, transparent)' },
                },
              },
            }}
            sx={{ width: 200 }}
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<CalendarMonthIcon sx={{ fontSize: 14 }} />}
            onClick={(e) => setDateMenuAnchor(e.currentTarget)}
            sx={{
              borderColor: 'var(--border-strong, transparent)',
              color: 'var(--text-secondary, currentColor)',
              textTransform: 'none',
              fontSize: 12,
              borderRadius: 1.5,
              '&:hover': { borderColor: 'var(--border-strong, transparent)', bgcolor: 'var(--bg-hover, transparent)' },
            }}
          >
            {DATE_RANGES.find((d) => d.key === dateRange)?.label || '日期筛选'}
          </Button>
        </Box>
      )}
    </>
  );
});

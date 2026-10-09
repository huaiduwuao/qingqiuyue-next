'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { ACCENT } from '@/constants/accents';
import { AI_GRADIENT } from '@/components/ai/AISearchResults';

/** 顶部固定栏:返回 + 大搜索框 + 搜索按钮 + 清空。memo:筛选、联想等其它 state 变化时不重渲染。 */
export const SearchHeader = React.memo(function SearchHeader({
  query,
  setQuery,
  aiMode,
  onSubmit: handleSubmit,
  onBack: handleBack,
  onClear: handleClear,
}: {
  query: string;
  setQuery: (v: string) => void;
  aiMode: boolean;
  onSubmit: () => void;
  onBack: () => void;
  onClear: () => void;
}) {
  const q = query.trim();
  return (
    <Box
      component="header"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1, md: 1.5 },
        minHeight: 68,
        // 刘海安全区:加在 padding 上,高度用 minHeight 撑开(不然 border-box 会把内容压扁)
        pt: 'var(--sat, 0px)',
        pl: { xs: 'max(var(--sal, 0px), 12px)', md: 3 },
        pr: { xs: 'max(var(--sar, 0px), 12px)', md: 3 },
        bgcolor: 'var(--bg-topbar, rgba(10, 10, 15, 0.85))',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.06))',
      }}
    >
      <IconButton onClick={handleBack} size="small" aria-label="返回" sx={{ color: 'var(--text-secondary, rgba(255,255,255,0.75))' }}>
        <ArrowBackIcon fontSize="small" />
      </IconButton>
      <TextField
        fullWidth
        size="small"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
          } else if (e.key === 'Escape') {
            handleBack();
          }
        }}
        placeholder={aiMode ? '用一句话描述你想找的,比如:适合睡前听的安静音乐' : '搜索你感兴趣的内容、创作者或话题'}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                {aiMode ? (
                  <AutoAwesomeIcon sx={{ fontSize: 16, color: ACCENT.blue.main }} />
                ) : (
                  <SearchIcon sx={{ fontSize: 16, color: 'var(--text-muted, rgba(255,255,255,0.5))' }} />
                )}
              </InputAdornment>
            ),
            endAdornment: query ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={handleClear}
                  aria-label="清空"
                  sx={{ color: 'var(--text-muted, rgba(255,255,255,0.5))', '&:hover': { color: 'var(--text-primary, #fff)' } }}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </InputAdornment>
            ) : undefined,
            sx: {
              bgcolor: 'var(--bg-input, rgba(255,255,255,0.06))',
              color: 'var(--text-primary, #fff)',
              fontSize: 14,
              borderRadius: 2,
              '& input::placeholder': { color: 'var(--text-muted, rgba(255,255,255,0.4))', opacity: 1 },
              '& fieldset': { borderColor: 'var(--border-color, rgba(255,255,255,0.1))' },
              '&:hover fieldset': { borderColor: 'var(--border-strong, rgba(255,255,255,0.2))' },
              '&.Mui-focused fieldset': { borderColor: aiMode ? ACCENT.blue.main : 'var(--brand-color, #FE2C55)' },
              ...(aiMode && { '& fieldset': { borderColor: ACCENT.blue.border30 } }),
            },
          },
        }}
        sx={{ maxWidth: 560 }}
      />
      <Button
        disableElevation
        size="medium"
        onClick={handleSubmit}
        disabled={!q}
        sx={{
          flexShrink: 0,
          minWidth: { xs: 0, md: 80 },
          px: { xs: 1.5, md: 2.5 },
          py: 0.75,
          whiteSpace: 'nowrap',
          borderRadius: 2,
          bgcolor: 'primary.main',
          ...(aiMode && { backgroundImage: AI_GRADIENT }),
          color: 'var(--text-primary, #fff)',
          fontSize: 13,
          fontWeight: 700,
          textTransform: 'none',
          boxShadow: 'none',
          // 让涟漪在 primary.main 上更明显
          '& .MuiTouchRipple-child': { bgcolor: 'var(--text-muted, rgba(255,255,255,0.45))' },
          '&:hover': { bgcolor: 'primary.main', filter: 'brightness(1.1)' },
          '&.Mui-disabled': { bgcolor: 'var(--bg-active, rgba(255,255,255,0.08))', color: 'var(--text-muted, rgba(255,255,255,0.4))' },
        }}
      >
        {aiMode ? '问 AI' : '搜索'}
      </Button>
    </Box>
  );
});

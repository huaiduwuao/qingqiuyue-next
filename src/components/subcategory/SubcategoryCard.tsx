'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useSubcategories } from './SubcategoryChip';

interface Props {
  code: string;
  parent?: string;
  onClick?: () => void;
}

/**
 * SubcategoryCard —— 卡片(图标占位 + 名 + code)。
 *
 * 用于 subcategory 列表页(可放到未来 /topic/history 的入口)。
 * 当前用占位 icon,后续可接入 SubcategoryHero 的渐变体系。
 */
export function SubcategoryCard({ code, parent = 'NEWS', onClick }: Props) {
  const { data } = useSubcategories(parent);
  const entry = data?.find((s) => s.code === code);
  const name = entry?.name ?? code;

  return (
    <Box
      onClick={onClick}
      sx={{
        borderRadius: 2,
        bgcolor: 'action.hover',
        p: 1.5,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform .15s ease, bgcolor .15s ease',
        '&:hover': onClick ? { transform: 'translateY(-2px)', bgcolor: 'action.selected' } : undefined,
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 1.5,
          bgcolor: 'background.paper',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 1,
          fontSize: 18,
        }}
      >
        📚
      </Box>
      <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{name}</Typography>
      <Typography sx={{ fontSize: 11, color: 'text.disabled', mt: 0.25 }}>{code}</Typography>
    </Box>
  );
}

export default SubcategoryCard;
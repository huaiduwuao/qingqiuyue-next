'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';

interface Props {
  /** 横滚列表项 */
  codes: string[];
  /** 当前选中的 code(单选) */
  selected?: string;
  /** label 字典(可选,code → 显示名) */
  labels?: Record<string, string>;
  onChange?: (code: string) => void;
}

/**
 * SubcategoryPicker —— 横滚 chip 列表 + 选中态。
 *
 * 用作详情页"切 subcategory"过滤(如人物详情上同时显示朝代子分类),
 * 或列表页 tab 替代方案。依赖 MUI ToggleButton 的视觉语言。
 */
export function SubcategoryPicker({ codes, selected, labels, onChange }: Props) {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 0.75,
        overflowX: 'auto',
        py: 1,
        px: 0.5,
        '&::-webkit-scrollbar': { display: 'none' },
        scrollbarWidth: 'none',
      }}
    >
      {codes.map((code) => {
        const isSelected = selected === code;
        return (
          <Chip
            key={code}
            label={labels?.[code] ?? code}
            onClick={() => onChange?.(code)}
            variant={isSelected ? 'filled' : 'outlined'}
            color={isSelected ? 'primary' : 'default'}
            sx={{
              fontSize: 13,
              fontWeight: 500,
              flexShrink: 0,
            }}
          />
        );
      })}
    </Box>
  );
}

export default SubcategoryPicker;
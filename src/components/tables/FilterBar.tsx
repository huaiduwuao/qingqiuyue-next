'use client';

import React from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputAdornment from '@mui/material/InputAdornment';
import Button from '@mui/material/Button';
import InputLabel from '@mui/material/InputLabel';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';

export interface FilterField {
  key: string;
  label: string;
  type: 'text' | 'select';
  options?: { label: string; value: string | number }[];
  placeholder?: string;
  width?: number;
}

export interface FilterBarProps {
  fields: FilterField[];
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
  onReset?: () => void;
  /** 自定义「查询」按钮回调 —— 不传则用 onChange 自动触发 */
  onSearch?: () => void;
  /** 禁用「查询」按钮(比如数据加载中) */
  searching?: boolean;
}

function hasAnyValue(values: Record<string, any>): boolean {
  return Object.values(values).some((v) => v !== '' && v !== null && v !== undefined);
}

export function FilterBar({ fields, values, onChange, onReset, onSearch, searching }: FilterBarProps) {
  const handleFieldChange = (key: string, val: any) => {
    onChange({ ...values, [key]: val });
  };

  const showReset = !!onReset && hasAnyValue(values);

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1.25,
        p: 1.25,
        mb: 2,
        borderRadius: 2,
        bgcolor: 'background.paper',
        color: 'text.primary',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      {fields.map((f) => {
        if (f.type === 'text') {
          const w = f.width ?? 200;
          return (
            <TextField
              key={f.key}
              size="small"
              label={f.label}
              placeholder={f.placeholder || `请输入${f.label}`}
              value={values[f.key] ?? ''}
              onChange={(e) => handleFieldChange(f.key, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && onSearch) onSearch();
              }}
              sx={{ width: w, '& .MuiInputBase-input': { fontSize: 13 } }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRoundedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                },
              }}
            />
          );
        }
        const w = f.width ?? 160;
        return (
          <FormControl key={f.key} size="small" sx={{ minWidth: w }}>
            <InputLabel id={`filter-${f.key}-label`}>{f.label}</InputLabel>
            <Select
              labelId={`filter-${f.key}-label`}
              label={f.label}
              value={values[f.key] ?? ''}
              displayEmpty
              onChange={(e) => handleFieldChange(f.key, e.target.value)}
              sx={{ fontSize: 13, '& .MuiSelect-select': { py: 0.75 } }}
            >
              <MenuItem value="" sx={{ fontSize: 13 }}>
                <em style={{ color: 'inherit' }}>全部</em>
              </MenuItem>
              {(f.options || []).map((opt) => (
                <MenuItem key={String(opt.value)} value={opt.value} sx={{ fontSize: 13 }}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      })}

      {/* 「查询」按钮 — 永远显示;onSearch 存在就显式触发,否则自动走 onChange(refetch) */}
      <Button
        size="small"
        variant="contained"
        color="primary"
        startIcon={<SearchRoundedIcon fontSize="small" />}
        onClick={onSearch}
        disabled={!!searching}
        sx={{ textTransform: 'none', fontSize: 13, minWidth: 88 }}
      >
        {searching ? '查询中…' : '查询'}
      </Button>

      {showReset && (
        <Button
          size="small"
          variant="outlined"
          color="inherit"
          startIcon={<RestartAltRoundedIcon fontSize="small" />}
          onClick={onReset}
          sx={{ textTransform: 'none', fontSize: 13 }}
        >
          重置
        </Button>
      )}
    </Box>
  );
}

export default FilterBar;

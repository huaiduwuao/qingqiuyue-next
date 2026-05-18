'use client';

import React from 'react';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';

interface FilterOptions {
  type?: string;
  status?: string;
  keyword?: string;
}

interface ContentFilterProps {
  options: FilterOptions;
  onChange: (options: FilterOptions) => void;
  onSearch?: () => void;
}

export default function ContentFilter({ options, onChange, onSearch }: ContentFilterProps) {
  return (
    <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel>类型</InputLabel>
        <Select
          value={options.type || ''}
          label="类型"
          onChange={(e) => onChange({ ...options, type: e.target.value })}
        >
          <MenuItem value="">全部</MenuItem>
          <MenuItem value="video">视频</MenuItem>
          <MenuItem value="music">音乐</MenuItem>
          <MenuItem value="novel">小说</MenuItem>
        </Select>
      </FormControl>
      <TextField
        size="small"
        label="关键词"
        value={options.keyword || ''}
        onChange={(e) => onChange({ ...options, keyword: e.target.value })}
      />
      {onSearch && (
        <Button variant="contained" onClick={onSearch}>
          搜索
        </Button>
      )}
    </Box>
  );
}

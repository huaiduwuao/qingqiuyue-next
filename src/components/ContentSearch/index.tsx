'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import SearchIcon from '@mui/icons-material/Search';
import IconButton from '@mui/material/IconButton';

interface SearchResult {
  id: string;
  name: string;
  type: string;
}

export default function ContentSearch() {
  const [options, setOptions] = useState<SearchResult[]>([]);
  const [value, setValue] = useState<SearchResult | null>(null);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Autocomplete
        sx={{ width: 300 }}
        options={options}
        value={value}
        onChange={(_, newValue) => setValue(newValue)}
        renderInput={(params) => (
          <TextField {...params} placeholder="搜索内容..." size="small" />
        )}
      />
      <IconButton type="submit">
        <SearchIcon />
      </IconButton>
    </Box>
  );
}

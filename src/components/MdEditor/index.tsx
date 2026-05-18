'use client';

import React from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';

interface MdEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}

export default function MdEditor({ value, onChange, placeholder }: MdEditorProps) {
  return (
    <Box>
      <TextField
        fullWidth
        multiline
        rows={10}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        variant="outlined"
      />
    </Box>
  );
}

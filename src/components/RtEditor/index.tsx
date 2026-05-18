'use client';

import React from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';

interface RtEditorProps {
  value?: string;
  onChange?: (value: string) => void;
}

export default function RtEditor({ value, onChange }: RtEditorProps) {
  return (
    <Box>
      <TextField
        fullWidth
        multiline
        rows={6}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        variant="outlined"
      />
    </Box>
  );
}

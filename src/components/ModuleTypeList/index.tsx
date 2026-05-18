'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';

interface ModuleTypeListProps {
  types: { id: string; name: string }[];
  value: string;
  onChange: (value: string) => void;
}

export default function ModuleTypeList({ types, value, onChange }: ModuleTypeListProps) {
  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Tabs value={value} onChange={(_, newValue) => onChange(newValue)}>
        {types.map((type) => (
          <Tab key={type.id} label={type.name} value={type.id} />
        ))}
      </Tabs>
    </Box>
  );
}

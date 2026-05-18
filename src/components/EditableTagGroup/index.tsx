'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';

interface EditableTagGroupProps {
  tags: string[];
  onChange?: (tags: string[]) => void;
}

export default function EditableTagGroup({ tags = [], onChange }: EditableTagGroupProps) {
  const [inputValue, setInputValue] = React.useState('');

  const handleAdd = () => {
    if (inputValue && onChange) {
      onChange([...tags, inputValue]);
      setInputValue('');
    }
  };

  const handleDelete = (tagToDelete: string) => {
    if (onChange) {
      onChange(tags.filter((tag) => tag !== tagToDelete));
    }
  };

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {tags.map((tag) => (
        <Chip key={tag} label={tag} onDelete={() => handleDelete(tag)} />
      ))}
      <TextField
        size="small"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
        sx={{ width: 100 }}
      />
      <IconButton size="small" onClick={handleAdd}>
        <AddIcon />
      </IconButton>
    </Box>
  );
}

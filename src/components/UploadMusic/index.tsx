'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

interface UploadMusicProps {
  value?: string;
  onChange?: (url: string) => void;
}

export default function UploadMusic({ value, onChange }: UploadMusicProps) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setTimeout(() => {
      setUploading(false);
      if (onChange) {
        onChange(URL.createObjectURL(file));
      }
    }, 1000);
  };

  return (
    <Box>
      {value && (
        <Box sx={{ mb: 1 }}>
          <audio src={value} controls />
        </Box>
      )}
      <Button component="label" variant="outlined" startIcon={<CloudUploadIcon />} disabled={uploading}>
        {uploading ? '上传中...' : '上传音乐'}
        <input type="file" hidden accept="audio/*" onChange={handleUpload} />
      </Button>
    </Box>
  );
}

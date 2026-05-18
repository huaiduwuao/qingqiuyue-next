'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

interface UploadFileProps {
  value?: string;
  onChange?: (url: string) => void;
}

export default function UploadFile({ value, onChange }: UploadFileProps) {
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
          <a href={value} target="_blank" rel="noopener noreferrer">
            下载文件
          </a>
        </Box>
      )}
      <Button component="label" variant="outlined" startIcon={<CloudUploadIcon />} disabled={uploading}>
        {uploading ? '上传中...' : '上传文件'}
        <input type="file" hidden onChange={handleUpload} />
      </Button>
    </Box>
  );
}

'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

interface UploadPictureProps {
  value?: string;
  onChange?: (url: string) => void;
}

export default function UploadPicture({ value, onChange }: UploadPictureProps) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    // Simulate upload - in real app, call your upload API
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
          <img src={value} alt="preview" style={{ maxWidth: 200, maxHeight: 200 }} />
        </Box>
      )}
      <Button component="label" variant="outlined" startIcon={<CloudUploadIcon />} disabled={uploading}>
        {uploading ? '上传中...' : '上传图片'}
        <input type="file" hidden accept="image/*" onChange={handleUpload} />
      </Button>
    </Box>
  );
}

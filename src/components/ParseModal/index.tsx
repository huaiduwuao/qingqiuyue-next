'use client';

import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';

interface ParseModalProps {
  open: boolean;
  onClose: () => void;
  onParse?: (url: string) => void;
}

export default function ParseModal({ open, onClose, onParse }: ParseModalProps) {
  const [url, setUrl] = React.useState('');

  const handleParse = () => {
    if (onParse) {
      onParse(url);
    }
    setUrl('');
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>解析</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          label="URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" onClick={handleParse}>
          解析
        </Button>
      </DialogActions>
    </Dialog>
  );
}

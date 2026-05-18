'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  error?: Error | null;
}

export function ErrorState({
  title = '出错了',
  message = '加载失败，请稍后重试',
  onRetry,
  error,
}: ErrorStateProps) {
  const displayMessage = error?.message || message;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 6,
        px: 3,
      }}
    >
      <Alert
        severity="error"
        icon={<ErrorIcon />}
        sx={{
          maxWidth: 400,
          borderRadius: 2,
          '& .MuiAlert-message': { width: '100%' },
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {displayMessage}
        </Typography>
      </Alert>
      {onRetry && (
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={onRetry}
          sx={{ mt: 3 }}
        >
          重试
        </Button>
      )}
    </Box>
  );
}

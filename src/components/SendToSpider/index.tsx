'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import { createBatch } from '@/apis/spider';

interface SendToSpiderProps {
  url?: string;
  label?: string;
  defaultUrl?: string;
  variant?: 'inline' | 'compact';
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

const tryExtractDomain = (raw: string): string => {
  try {
    return new URL(raw).hostname.replace(/^www\./, '');
  } catch {
    return 'manual';
  }
};

export default function SendToSpider({
  url,
  label = '发送到爬虫',
  defaultUrl = '',
  variant = 'compact',
  onSuccess,
  onError,
}: SendToSpiderProps) {
  const [inputUrl, setInputUrl] = useState(url || '');
  const [busy, setBusy] = useState(false);

  const handleSend = async () => {
    const targetUrl = (inputUrl || url || defaultUrl).trim();
    if (!targetUrl) {
      onError?.('请输入 URL');
      return;
    }
    setBusy(true);
    try {
      const domain = tryExtractDomain(targetUrl);
      await createBatch({
        name: `即时抓取 · ${domain}`,
        domain,
        url: targetUrl,
        type: 'html',
      });
      setInputUrl('');
      onSuccess?.(`已发送到爬虫:${targetUrl}`);
    } catch (err: any) {
      onError?.(err?.message || '发送失败');
    } finally {
      setBusy(false);
    }
  };

  const placeholder = defaultUrl || '粘贴 URL 一键抓取';

  if (variant === 'inline') {
    return (
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder={placeholder}
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend();
          }}
          disabled={busy}
          sx={{ minWidth: 240 }}
        />
        <Button
          variant="contained"
          onClick={handleSend}
          disabled={busy || !inputUrl.trim()}
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <CloudDownloadIcon />}
        >
          {busy ? '发送中' : label}
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <TextField
        size="small"
        placeholder={placeholder}
        value={inputUrl}
        onChange={(e) => setInputUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSend();
        }}
        disabled={busy}
      />
      <Button
        variant="contained"
        onClick={handleSend}
        disabled={busy || !inputUrl.trim()}
        startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <CloudDownloadIcon />}
      >
        {busy ? '发送中' : label}
      </Button>
    </Box>
  );
}

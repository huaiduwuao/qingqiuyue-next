'use client';

import { useState, useRef, useCallback } from 'react';
import { Box, Button, Typography, LinearProgress, Alert } from '@mui/material';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import axios from 'axios';

export interface UploadStepProps {
  onUploaded: (jobId: string) => void;
}

const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024; // 2GB

export default function UploadStep({ onUploaded }: UploadStepProps) {
  const [name, setName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = useCallback((f: File) => {
    setError(null);
    if (!f.type.startsWith('video/')) {
      setError('请选择视频文件(mp4 / mov / webm)');
      return;
    }
    if (f.size > MAX_VIDEO_BYTES) {
      setError(`视频过大: ${(f.size / 1e9).toFixed(1)} GB,上限 2 GB`);
      return;
    }
    setFile(f);
    if (!name) {
      // 用文件名(去后缀)作默认角色名
      setName(f.name.replace(/\.[^.]+$/, ''));
    }
  }, [name]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleSelect(f);
  }, [handleSelect]);

  const upload = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      // 1) 创建 job 拿 presigned URL
      const createResp = await axios.post<{
        jobId: string;
        upload: { url: string; method: 'PUT'; headers?: Record<string, string> };
      }>('/api/avatar/pipeline/jobs', {
        name: name || file.name.replace(/\.[^.]+$/, ''),
      });
      const { jobId, upload: u } = createResp.data;

      // 2) PUT 到 MinIO(axios 自带进度)
      await axios.put(u.url, file, {
        headers: { 'Content-Type': file.type, ...(u.headers || {}) },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded * 100) / e.total));
        },
      });

      // 3) 通知父组件
      onUploaded(jobId);
    } catch (e: any) {
      setError(`上传失败: ${e?.response?.data?.msg || e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }, [file, name, onUploaded]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
        第 1 步:上传视频
      </Typography>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
        手机竖屏慢转 360° 一圈,30 秒左右,1080p+,主体占画面 60~80%。
        上限 2 GB。视频会直接传到对象存储,不会经过本服务器中转。
      </Typography>

      <Box
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        sx={{
          p: 4,
          borderRadius: 2,
          border: '2px dashed',
          borderColor: dragging ? 'primary.main' : 'divider',
          bgcolor: dragging ? (t) => `${t.palette.primary.main}10` : 'background.paper',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        <CloudUploadRoundedIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
        <Typography sx={{ mt: 1, fontSize: 13, color: 'text.secondary' }}>
          {file ? `${file.name} (${(file.size / 1e6).toFixed(1)} MB)` : '点击或拖拽视频到这里'}
        </Typography>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          hidden
          onChange={(e) => e.target.files?.[0] && handleSelect(e.target.files[0])}
        />
      </Box>

      {file && (
        <Box>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
            角色名(给 GLB 命名用)
          </Typography>
          <Box
            component="input"
            value={name}
            onChange={(e: any) => setName(e.target.value)}
            placeholder="xiaoqiu"
            sx={{
              width: '100%',
              p: 1,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              fontSize: 13,
              outline: 'none',
              '&:focus': { borderColor: 'primary.main' },
            }}
          />
        </Box>
      )}

      {busy && (
        <Box>
          <LinearProgress variant="determinate" value={progress} />
          <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5, textAlign: 'center' }}>
            上传中 {progress}%
          </Typography>
        </Box>
      )}

      {error && <Alert severity="error" sx={{ fontSize: 12 }}>{error}</Alert>}

      <Button
        variant="contained"
        disabled={!file || busy}
        onClick={upload}
        sx={{ alignSelf: 'flex-end' }}
      >
        {busy ? '上传中…' : '上传'}
      </Button>
    </Box>
  );
}

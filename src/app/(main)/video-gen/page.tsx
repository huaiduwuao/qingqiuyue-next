'use client';

/**
 * VideoGenPage — ComfyUI 视频生成前端
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Paper,
  Tabs,
  Tab,
  Slider,
  LinearProgress,
  Chip,
  Alert,
} from '@mui/material';
import { useTaskEngine } from '@/hooks/useTaskEngine';
import type { WorkflowKind } from '@/lib/comfyui/workflows/registry';
import HotRankingBar from '@/components/home/HotRankingBar';

interface GenerateForm {
  positivePrompt: string;
  negativePrompt: string;
  seed: number;
  width: number;
  height: number;
  frames: number;
  steps: number;
  cfg: number;
  inputImage: string;
}

const DEFAULTS: GenerateForm = {
  positivePrompt: '',
  negativePrompt: '',
  seed: 42,
  width: 512,
  height: 512,
  frames: 16,
  steps: 20,
  cfg: 7.5,
  inputImage: '',
};

export default function VideoGenPage() {
  const [kind, setKind] = useState<WorkflowKind>('text-to-video');
  const [form, setForm] = useState<GenerateForm>(DEFAULTS);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { task, progress, logs, error, connection } = useTaskEngine(taskId);

  const handleSubmit = useCallback(async () => {
    if (!form.positivePrompt.trim()) return;
    setSubmitting(true);
    try {
      const r = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          ...form,
          seed: form.seed || Math.floor(Math.random() * 1_000_000_000),
        }),
      });
      const data = await r.json();
      if (data.taskId) {
        setTaskId(data.taskId);
      }
    } finally {
      setSubmitting(false);
    }
  }, [kind, form]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, inputImage: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const resultUrl = task?.result?.url as string | undefined;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        AI 视频生成
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        基于 ComfyUI 本地 GPU 生成短视频
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Tabs value={kind} onChange={(_, v) => setKind(v)} sx={{ mb: 2 }}>
          <Tab label="文生视频" value="text-to-video" />
          <Tab label="图生视频" value="image-to-video" />
        </Tabs>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="描述你想生成的视频"
            placeholder="例如: 一只橘猫在月光下的屋顶上伸懒腰"
            multiline
            rows={3}
            value={form.positivePrompt}
            onChange={(e) => setForm((f) => ({ ...f, positivePrompt: e.target.value }))}
            fullWidth
          />

          <TextField
            label="负向提示词 (可选)"
            placeholder="例如: 模糊, 低质量, 变形"
            value={form.negativePrompt}
            onChange={(e) => setForm((f) => ({ ...f, negativePrompt: e.target.value }))}
            fullWidth
          />

          {kind === 'image-to-video' && (
            <Box>
              <Button variant="outlined" component="label">
                上传起始图片
                <input type="file" accept="image/*" hidden onChange={handleImageUpload} />
              </Button>
              {form.inputImage && (
                <Box sx={{ mt: 1 }}>
                  <img src={form.inputImage} alt="input" style={{ maxWidth: 200, maxHeight: 200, borderRadius: 8 }} />
                </Box>
              )}
            </Box>
          )}

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
            {[
              { label: '宽度', key: 'width', min: 256, max: 1024, step: 64 },
              { label: '高度', key: 'height', min: 256, max: 1024, step: 64 },
              { label: '帧数', key: 'frames', min: 8, max: 64, step: 1 },
              { label: '步数', key: 'steps', min: 10, max: 50, step: 1 },
              { label: 'CFG', key: 'cfg', min: 1, max: 20, step: 0.5 },
            ].map((item) => (
              <Box key={item.key}>
                <Typography variant="caption" color="text.secondary">
                  {item.label}: {form[item.key as keyof GenerateForm]}
                </Typography>
                <Slider
                  value={form[item.key as keyof GenerateForm] as number}
                  onChange={(_, v) => setForm((f) => ({ ...f, [item.key]: v }))}
                  min={item.min}
                  max={item.max}
                  step={item.step}
                  valueLabelDisplay="auto"
                />
              </Box>
            ))}
          </Box>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              label="Seed"
              type="number"
              value={form.seed}
              onChange={(e) => setForm((f) => ({ ...f, seed: parseInt(e.target.value, 10) || 0 }))}
              size="small"
            />
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={submitting || !form.positivePrompt.trim()}
            >
              {submitting ? '创建任务中...' : '开始生成'}
            </Button>
          </Box>
        </Box>
      </Paper>

      {taskId && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            生成进度
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Chip
              label={task?.status || connection}
              color={task?.status === 'done' ? 'success' : task?.status === 'failed' ? 'error' : 'primary'}
              size="small"
            />
            <Typography variant="body2">{progress}%</Typography>
          </Box>
          <LinearProgress variant="determinate" value={progress} sx={{ mb: 2 }} />

          <Box sx={{ maxHeight: 200, overflow: 'auto', bgcolor: 'background.default', p: 1, borderRadius: 1 }}>
            {logs.map((log, i) => (
              <Typography key={i} variant="caption" sx={{ display: 'block', color: log.level === 'error' ? 'error.main' : 'text.secondary' }}>
                [{new Date(log.ts).toLocaleTimeString()}] {log.message}
              </Typography>
            ))}
          </Box>

          {error && <Alert severity="error" sx={{ mt: 2 }}>{error.message}</Alert>}

          {resultUrl && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>产物:</Typography>
              <video controls style={{ width: '100%', maxHeight: 480, borderRadius: 8 }}>
                <source src={resultUrl} />
              </video>
            </Box>
          )}
        </Paper>
      )}

      {/* 灵感来源:全网视频热榜,每 60s 自动刷新 */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <HotRankingBar
          contentType="VIDEO"
          title="热门视频 · 灵感来源"
          maxItems={10}
          expandable
        />
      </Paper>
    </Container>
  );
}

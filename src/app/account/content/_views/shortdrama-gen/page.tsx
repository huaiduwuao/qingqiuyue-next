'use client';

/**
 * ShortdramaGenPage — 短剧生成工作流
 *
 * 流程:
 *   1. 导入小说/剧本 (分镜/场景划分)
 *   2. 生成视频 (文生视频/图生视频)
 *   3. 合成剪辑 (多段视频拼接)
 *   4. 导出发布
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Container,
  Typography,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  LinearProgress,
  Chip,
  Alert,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SendIcon from '@mui/icons-material/Send';
import { useTaskEngine } from '@/hooks/useTaskEngine';
import type { WorkflowKind } from '@/lib/comfyui/workflows/registry';

const STEPS = ['导入剧本', '生成视频', '合成剪辑', '导出发布'];

interface Scene {
  id: string;
  title: string;
  prompt: string;
  status: 'pending' | 'generating' | 'done' | 'failed';
  videoUrl?: string;
  progress: number;
}

const DEFAULTS = {
  positivePrompt: '',
  negativePrompt: '',
  seed: 42,
  width: 720,
  height: 1280, // 竖版短剧
  frames: 16,
  steps: 20,
  cfg: 7.5,
};

export default function ShortdramaGenPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [scriptText, setScriptText] = useState('');
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { task, progress, logs, error } = useTaskEngine(taskId);

  // 步骤 1: 解析剧本为场景
  const handleParseScript = useCallback(() => {
    if (!scriptText.trim()) return;

    // 简单按换行或分号分割场景
    const lines = scriptText.split(/[\n;；]/).filter((l) => l.trim());
    const parsed: Scene[] = lines.map((line, idx) => ({
      id: `scene-${Date.now()}-${idx}`,
      title: line.trim().slice(0, 30),
      prompt: line.trim(),
      status: 'pending' as const,
      progress: 0,
    }));
    setScenes(parsed);
    setActiveStep(1);
  }, [scriptText]);

  // 步骤 2: 生成视频
  const handleGenerateScene = useCallback(async (scene: Scene) => {
    setScenes((prev) =>
      prev.map((s) => (s.id === scene.id ? { ...s, status: 'generating' as const, progress: 0 } : s)),
    );

    try {
      const r = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'text-to-video',
          positivePrompt: scene.prompt,
          ...DEFAULTS,
          seed: DEFAULTS.seed + Math.floor(Math.random() * 1000),
        }),
      });
      const data = await r.json();
      if (data.taskId) {
        // 轮询进度
        const poll = setInterval(async () => {
          const res = await fetch(`/api/task/${data.taskId}`);
          const t = await res.json();
          if (t.data?.status === 'done') {
            clearInterval(poll);
            setScenes((prev) =>
              prev.map((s) =>
                s.id === scene.id
                  ? { ...s, status: 'done' as const, videoUrl: t.data.result?.url, progress: 100 }
                  : s,
              ),
            );
          } else if (t.data?.status === 'failed') {
            clearInterval(poll);
            setScenes((prev) =>
              prev.map((s) => (s.id === scene.id ? { ...s, status: 'failed' as const } : s)),
            );
          }
        }, 2000);
      }
    } catch (e) {
      setScenes((prev) =>
        prev.map((s) => (s.id === scene.id ? { ...s, status: 'failed' as const } : s)),
      );
    }
  }, []);

  const handleGenerateAll = useCallback(async () => {
    for (const scene of scenes.filter((s) => s.status === 'pending')) {
      await handleGenerateScene(scene);
    }
    setActiveStep(2);
  }, [scenes, handleGenerateScene]);

  // 步骤 3: 合成
  const handleCompose = useCallback(() => {
    // TODO: 实现视频合成逻辑
    setActiveStep(3);
  }, []);

  // 步骤 4: 导出
  const handleExport = useCallback(() => {
    // TODO: 实现导出逻辑
    alert('导出功能开发中');
  }, []);

  const doneCount = scenes.filter((s) => s.status === 'done').length;
  const totalProgress = scenes.length > 0 ? Math.round((doneCount / scenes.length) * 100) : 0;

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Typography variant="h5" gutterBottom>
        短剧生成工作流
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        从剧本到短剧视频的全流程 AI 生成
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* 步骤 1: 导入剧本 */}
      {activeStep === 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            导入剧本
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            输入剧本内容，系统将自动拆分为多个场景。场景之间用换行或分号分隔。
          </Typography>
          <TextField
            multiline
            rows={12}
            fullWidth
            placeholder={"示例:\n场景1: 月光下，少女在屋顶仰望星空\n场景2: 突然，一道流星划过天际\n场景3: 少女惊讶地睁大眼睛"}
            value={scriptText}
            onChange={(e) => setScriptText(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="outlined" component="label" startIcon={<CloudUploadIcon />}>
              上传剧本文件
              <input type="file" accept=".txt,.md" hidden />
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" onClick={handleParseScript} disabled={!scriptText.trim()}>
              解析场景
            </Button>
          </Box>
        </Paper>
      )}

      {/* 步骤 2: 生成视频 */}
      {activeStep === 1 && (
        <Box>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">场景列表 ({doneCount}/{scenes.length} 已完成)</Typography>
              <Button
                variant="contained"
                startIcon={<PlayArrowIcon />}
                onClick={handleGenerateAll}
                disabled={scenes.some((s) => s.status === 'generating')}
              >
                批量生成
              </Button>
            </Box>
            <LinearProgress variant="determinate" value={totalProgress} sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              {scenes.map((scene) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={scene.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ flex: 1 }}>{scene.title}</Typography>
                        <Chip
                          size="small"
                          label={scene.status === 'done' ? '完成' : scene.status === 'generating' ? '生成中' : scene.status === 'failed' ? '失败' : '待生成'}
                          color={scene.status === 'done' ? 'success' : scene.status === 'generating' ? 'primary' : scene.status === 'failed' ? 'error' : 'default'}
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        {scene.prompt.slice(0, 50)}...
                      </Typography>
                      {scene.status === 'generating' && (
                        <LinearProgress variant="determinate" value={scene.progress} sx={{ mb: 1 }} />
                      )}
                      {scene.videoUrl && (
                        <video
                          src={scene.videoUrl}
                          controls
                          style={{ width: '100%', maxHeight: 120, borderRadius: 4 }}
                        />
                      )}
                      <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                        {scene.status === 'pending' && (
                          <Button size="small" variant="outlined" onClick={() => handleGenerateScene(scene)}>
                            生成
                          </Button>
                        )}
                        {scene.status === 'done' && (
                          <Button size="small" variant="outlined">重新生成</Button>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button onClick={() => setActiveStep(0)}>上一步</Button>
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" onClick={() => setActiveStep(2)} disabled={doneCount === 0}>
              下一步
            </Button>
          </Box>
        </Box>
      )}

      {/* 步骤 3: 合成剪辑 */}
      {activeStep === 2 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            合成剪辑
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            将所有场景视频按顺序拼接成完整短剧
          </Typography>
          <List>
            {scenes.map((scene, idx) => (
              <ListItem key={scene.id} secondaryAction={
                <Typography variant="caption" color="text.secondary">{idx + 1}</Typography>
              }>
                <ListItemText
                  primary={scene.title}
                  secondary={scene.videoUrl ? '已生成' : '未生成'}
                />
              </ListItem>
            ))}
          </List>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button onClick={() => setActiveStep(1)}>上一步</Button>
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" onClick={handleCompose}>
              开始合成
            </Button>
          </Box>
        </Paper>
      )}

      {/* 步骤 4: 导出发布 */}
      {activeStep === 3 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            导出发布
          </Typography>
          <Alert severity="success" sx={{ mb: 3 }}>
            短剧合成完成！可以导出或直接发布到平台。
          </Alert>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button onClick={() => setActiveStep(2)}>上一步</Button>
            <Box sx={{ flex: 1 }} />
            <Button variant="outlined">导出视频</Button>
            <Button variant="contained" onClick={handleExport} startIcon={<SendIcon />}>
              发布到平台
            </Button>
          </Box>
        </Paper>
      )}
    </Container>
  );
}

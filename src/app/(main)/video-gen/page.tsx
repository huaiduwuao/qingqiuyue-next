'use client';

/**
 * VideoGenPage — ComfyUI 视频生成前端
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listWorkflows, createVideoJob } from '@/apis/gen';
import { formatApiError } from '@/lib/api/client';
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { task, progress, logs, error, connection } = useTaskEngine(taskId);

  // 可用工作流。后端预置的三个模板 workflowJson 还是占位,已被 seed 成 draft,
  // 所以这里通常是空 —— 空就说明"还没有配置好可用的工作流",而不是接口挂了。
  const wfQuery = useQuery({
    queryKey: ['gen-workflows'],
    queryFn: listWorkflows,
    staleTime: 5 * 60 * 1000,
  });
  const workflows = wfQuery.data ?? [];
  const [workflowName, setWorkflowName] = useState('');
  useEffect(() => {
    if (!workflowName && workflows.length > 0) setWorkflowName(workflows[0].name);
  }, [workflows, workflowName]);

  const handleSubmit = useCallback(async () => {
    if (!form.positivePrompt.trim() || !workflowName) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // 之前这里 POST /api/video/generate —— 网关 404,而且请求体的字段名
      // (kind/positivePrompt/width/...)后端一个都不认。真实契约见 apis/gen.ts:
      // 顶层只有 workflowName/prompt/negativePrompt,其余参数走 params 透传给 ComfyUI。
      const { jobId } = await createVideoJob({
        workflowName,
        prompt: form.positivePrompt,
        negativePrompt: form.negativePrompt,
        params: {
          seed: String(form.seed || Math.floor(Math.random() * 1_000_000_000)),
          width: String(form.width),
          height: String(form.height),
          frames: String(form.frames),
          steps: String(form.steps),
          cfg: String(form.cfg),
        },
      });
      setTaskId(String(jobId));
    } catch (err) {
      // 不再吞掉失败。扣费发生在后端下单那一刻,失败原因必须让用户看见
      // (最常见的是"工作流尚未配置"和"余额不足")。
      setSubmitError(formatApiError(err) || '提交失败');
    } finally {
      setSubmitting(false);
    }
  }, [form, workflowName]);

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
          {/* 工作流选择。为空说明后端还没有配置好可用的 ComfyUI 工作流 —— 如实说明,
              而不是让用户填完表单点下去才发现提交不了(而且以前还会先扣费)。 */}
          {!wfQuery.isLoading && workflows.length === 0 ? (
            <Alert severity="warning">
              暂无可用的生成工作流:后端预置模板的 ComfyUI 工作流 JSON 还是占位内容,
              需要管理员导入真实工作流并启用后才能生成。
            </Alert>
          ) : (
            <TextField
              select
              label="生成工作流"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              slotProps={{ select: { native: true } }}
              helperText={
                workflows.find((w) => w.name === workflowName)
                  ? `消耗 ${workflows.find((w) => w.name === workflowName)!.costCredits} 钻 · 提交即扣费,失败会自动退回`
                  : ' '
              }
              fullWidth
            >
              {workflows.map((w) => (
                <option key={w.id} value={w.name}>
                  {w.name} — {w.description}
                </option>
              ))}
            </TextField>
          )}

          {submitError && <Alert severity="error">{submitError}</Alert>}

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
              disabled={submitting || !form.positivePrompt.trim() || !workflowName}
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
              color={task?.status === 'completed' ? 'success' : task?.status === 'failed' ? 'error' : 'primary'}
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

    </Container>
  );
}

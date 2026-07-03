'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import MovieIcon from '@mui/icons-material/Movie';
import DiamondIcon from '@mui/icons-material/Diamond';
import { useQuery, useMutation } from '@tanstack/react-query';

interface Workflow {
  id: number;
  name: string;
  description: string;
  contentType: string;
  previewUrl?: string;
  costCredits: number;
}

interface GenerationJob {
  id: number;
  status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  prompt: string;
  costCredits: number;
  resultUrls?: string[];
  errorMsg?: string;
  createdAt: string;
}

async function fetchWorkflows(): Promise<Workflow[]> {
  const res = await fetch('/api/ai/generate/workflows');
  if (!res.ok) throw new Error('加载工作流失败');
  const payload = await res.json();
  return payload.data || [];
}

async function createJob(body: {
  workflowName: string;
  prompt: string;
  negativePrompt?: string;
  agentId?: string;
}): Promise<{ jobId: number }> {
  const res = await fetch('/api/ai/generate/video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.msg || '提交失败');
  }
  const payload = await res.json();
  return payload.data;
}

async function fetchJob(id: number): Promise<GenerationJob> {
  const res = await fetch(`/api/ai/generate/jobs/${id}`);
  if (!res.ok) throw new Error('加载任务失败');
  const payload = await res.json();
  return payload.data;
}

export default function VideoGeneratePage() {
  const router = useRouter();
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [currentJob, setCurrentJob] = useState<GenerationJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const workflowsQuery = useQuery({
    queryKey: ['generation-workflows'],
    queryFn: fetchWorkflows,
  });

  const createMutation = useMutation({
    mutationFn: createJob,
    onSuccess: ({ jobId }) => {
      setError(null);
      subscribeJob(jobId);
    },
    onError: (err: any) => setError(err.message),
  });

  // 首次加载工作流后默认选中第一个
  useEffect(() => {
    if (workflowsQuery.data?.length && !selectedWorkflow) {
      setSelectedWorkflow(workflowsQuery.data[0]);
    }
  }, [workflowsQuery.data, selectedWorkflow]);

  // SSE 订阅任务进度
  const subscribeJob = (jobId: number) => {
    if (esRef.current) {
      esRef.current.close();
    }

    fetchJob(jobId).then(setCurrentJob).catch(() => {});

    const es = new EventSource(`/api/ai/generate/jobs/${jobId}/events`);
    esRef.current = es;

    es.addEventListener('status', (e) => {
      try {
        const data = JSON.parse(e.data);
        setCurrentJob((prev) =>
          prev
            ? { ...prev, status: data.status, progress: data.progress, errorMsg: data.errorMsg }
            : null
        );
        if (data.status === 'completed' || data.status === 'failed') {
          fetchJob(jobId).then(setCurrentJob).catch(() => {});
          es.close();
        }
      } catch {}
    });

    es.onerror = () => {
      es.close();
    };
  };

  useEffect(() => {
    return () => {
      esRef.current?.close();
    };
  }, []);

  const handleSubmit = () => {
    if (!selectedWorkflow) {
      setError('请先选择工作流');
      return;
    }
    if (!prompt.trim()) {
      setError('请输入视频描述');
      return;
    }
    createMutation.mutate({
      workflowName: selectedWorkflow.name,
      prompt: prompt.trim(),
      negativePrompt: negativePrompt.trim(),
    });
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <MovieIcon /> AI 视频生成
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        输入画面描述，选择工作流，即可生成短视频。
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* 左侧：工作流选择 + 输入 */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              选择工作流
            </Typography>
            {workflowsQuery.isLoading ? (
              <LinearProgress />
            ) : (
              <Grid container spacing={2} sx={{ mb: 3 }}>
                {workflowsQuery.data?.map((wf) => (
                  <Grid size={{ xs: 12, sm: 6 }} key={wf.id}>
                    <Card
                      variant={selectedWorkflow?.id === wf.id ? 'elevation' : 'outlined'}
                      elevation={selectedWorkflow?.id === wf.id ? 4 : 0}
                      onClick={() => setSelectedWorkflow(wf)}
                      sx={{
                        cursor: 'pointer',
                        borderColor: selectedWorkflow?.id === wf.id ? 'primary.main' : undefined,
                      }}
                    >
                      {wf.previewUrl && (
                        <CardMedia
                          component="img"
                          height="120"
                          image={wf.previewUrl}
                          alt={wf.name}
                        />
                      )}
                      <CardContent>
                        <Typography variant="subtitle1">{wf.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {wf.description}
                        </Typography>
                        <Chip
                          icon={<DiamondIcon />}
                          label={`${wf.costCredits} 钻石`}
                          size="small"
                          color="primary"
                          sx={{ mt: 1 }}
                        />
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}

            <TextField
              fullWidth
              multiline
              rows={4}
              label="视频描述（Prompt）"
              placeholder="例如：一位穿着汉服的少女在樱花树下微笑，镜头缓慢推进..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              multiline
              rows={2}
              label="不希望出现的内容（Negative Prompt，可选）"
              placeholder="例如：模糊、变形、低质量、水印..."
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              sx={{ mb: 2 }}
            />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                variant="contained"
                size="large"
                disabled={createMutation.isPending || !selectedWorkflow || !prompt.trim()}
                onClick={handleSubmit}
              >
                {createMutation.isPending ? '提交中...' : '开始生成'}
              </Button>
              {selectedWorkflow && (
                <Typography variant="body2" color="text.secondary">
                  预计消耗 <DiamondIcon sx={{ fontSize: 14, verticalAlign: 'middle' }} />
                  {selectedWorkflow.costCredits} 钻石
                </Typography>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* 右侧：进度与结果 */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              生成进度
            </Typography>

            {!currentJob ? (
              <Typography variant="body2" color="text.secondary">
                提交任务后在此查看进度
              </Typography>
            ) : (
              <Box>
                <Box sx={{ mb: 2 }}>
                  <Chip
                    label={currentJob.status}
                    color={
                      currentJob.status === 'completed'
                        ? 'success'
                        : currentJob.status === 'failed'
                        ? 'error'
                        : 'primary'
                    }
                    size="small"
                  />
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    任务 ID: {currentJob.id}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {currentJob.prompt}
                  </Typography>
                </Box>

                <LinearProgress
                  variant="determinate"
                  value={currentJob.progress}
                  sx={{ mb: 2 }}
                />
                <Typography variant="body2" sx={{ mb: 2 }}>
                  {currentJob.progress}%
                </Typography>

                {currentJob.errorMsg && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {currentJob.errorMsg}
                  </Alert>
                )}

                {currentJob.status === 'completed' && currentJob.resultUrls && (
                  <Box>
                    {currentJob.resultUrls.map((url, idx) => (
                      <Box key={idx} sx={{ mb: 2 }}>
                        <video
                          src={url}
                          controls
                          style={{ width: '100%', borderRadius: 8 }}
                        />
                        <Button
                          variant="outlined"
                          size="small"
                          href={url}
                          download
                          sx={{ mt: 1 }}
                        >
                          下载视频
                        </Button>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}

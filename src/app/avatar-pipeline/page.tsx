'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Box, Typography, Stepper, Step, StepLabel, Paper, Alert, CircularProgress,
} from '@mui/material';
import axios from 'axios';
import ModeStep, { type AvatarMode } from '@/components/avatar-pipeline/ModeStep';
import UploadStep from '@/components/avatar-pipeline/UploadStep';
import LibraryStep, { type LibraryCharacter } from '@/components/avatar-pipeline/LibraryStep';
import ConfigureStep from '@/components/avatar-pipeline/ConfigureStep';
import RunStep from '@/components/avatar-pipeline/RunStep';
import PreviewStep from '@/components/avatar-pipeline/PreviewStep';
import { usePipelineJob } from '@/components/avatar-pipeline/usePipelineJob';
import type { JobSnapshot } from '@/lib/avatar-pipeline/types';

const STEPS = ['方式', '素材', '配置', '运行', '预览'] as const;

// 内层组件:用 useSearchParams,需要被 Suspense 包裹
function WizardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialJobId = searchParams.get('job');

  const { state, setStep, setJob, cancel, reset } = usePipelineJob(initialJobId);
  const [jobId, setJobId] = useState<string | null>(initialJobId);
  const [mode, setMode] = useState<AvatarMode | null>(null);
  const [configName, setConfigName] = useState('');
  const [fromLibrary, setFromLibrary] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // 进入页面如果有 ?job=<id>,尝试加载快照
  useEffect(() => {
    if (!initialJobId) return;
    setJobId(initialJobId);
    axios.get<JobSnapshot>(`/api/avatar/pipeline/jobs/${initialJobId}`)
      .then((r) => {
        setJob(r.data);
        if (r.data.status === 'awaiting_upload' || r.data.status === 'ready') {
          setStep('configure');
        } else if (r.data.status === 'running') {
          setStep('run');
        } else {
          setStep('preview');
        }
      })
      .catch(() => router.replace('/avatar-pipeline'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialJobId]);

  // mode 选择
  const onModeSelect = useCallback((m: AvatarMode) => {
    setMode(m);
    setStep(m === 'library' ? 'library' : 'upload');
  }, [setStep]);

  // 视频上传完成
  const onUploaded = useCallback((id: string) => {
    setJobId(id);
    router.replace(`/avatar-pipeline?job=${id}`);
    setStep('configure');
  }, [router, setStep]);

  // 角色库选完
  const onLibrarySelected = useCallback((char: LibraryCharacter, customName: string) => {
    setFromLibrary(char.id);
    setConfigName(customName);
    void createAndStartLibraryJob(char.id, customName);
  }, []);

  const createAndStartLibraryJob = useCallback(async (libId: string, name: string) => {
    setStarting(true);
    setStartError(null);
    try {
      const r1 = await axios.post<{ jobId: string }>('/api/avatar/pipeline/jobs', {
        name,
        fromLibrary: libId,
      });
      const id = r1.data.jobId;
      setJobId(id);
      router.replace(`/avatar-pipeline?job=${id}`);
      await axios.post(`/api/avatar/pipeline/jobs/${id}/start`);
      setStep('run');
    } catch (e: any) {
      setStartError(e?.response?.data?.msg || e?.message || String(e));
    } finally {
      setStarting(false);
    }
  }, [router, setStep]);

  // 视频模式启动
  const onStart = useCallback(async (cfg: { name: string; skip3dgs: boolean; height: number }) => {
    if (!jobId) return;
    setStarting(true);
    setStartError(null);
    setConfigName(cfg.name);
    try {
      await axios.post(`/api/avatar/pipeline/jobs/${jobId}/start`, {
        skip3dgs: cfg.skip3dgs,
        height: cfg.height,
      });
      setStep('run');
    } catch (e: any) {
      setStartError(e?.response?.data?.msg || e?.message || String(e));
    } finally {
      setStarting(false);
    }
  }, [jobId, setStep]);

  const onCancel = useCallback(async () => {
    await cancel();
  }, [cancel]);

  const onContinue = useCallback(() => {
    setStep('preview');
  }, [setStep]);

  const onDeploy = useCallback(async () => {
    if (!jobId) throw new Error('no jobId');
    const r = await axios.post(`/api/avatar/pipeline/jobs/${jobId}/deploy`);
    return r.data;
  }, [jobId]);

  const onRestart = useCallback(() => {
    setJobId(null);
    setMode(null);
    setFromLibrary(null);
    reset();
    router.replace('/avatar-pipeline');
  }, [router, reset]);

  // 计算 stepper 高亮
  const stepIndex = (() => {
    switch (state.step) {
      case 'mode': return 0;
      case 'upload':
      case 'library': return 1;
      case 'configure': return 2;
      case 'run': return 3;
      case 'preview': return 4;
      default: return 0;
    }
  })();

  return (
    <Box>
      <Typography sx={{ fontSize: 22, fontWeight: 700, mb: 0.5 }}>
        数字人 Web 流水线
      </Typography>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 3 }}>
        拍视频 / 选角色 → 一键绑骨 + 雕表情 → 拿到 GLB
      </Typography>

      <Stepper activeStep={stepIndex} sx={{ mb: 3 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Paper sx={{ p: 3, minHeight: 400 }}>
        {state.step === 'mode' && <ModeStep onSelect={onModeSelect} />}

        {state.step === 'upload' && (
          <UploadStep onUploaded={onUploaded} />
        )}

        {state.step === 'library' && (
          <LibraryStep
            onSelected={onLibrarySelected}
            onBack={() => setStep('mode')}
          />
        )}

        {state.step === 'configure' && jobId && mode === 'video' && (
          <ConfigureStep
            defaultName={configName || 'xiaoqiu'}
            defaultSkip3dgs={false}
            defaultHeight={1.75}
            onBack={() => setStep('upload')}
            onStart={onStart}
            busy={starting}
            error={startError}
          />
        )}

        {state.step === 'run' && jobId && (
          <RunStep
            job={state.job}
            stage={state.job?.stage || null}
            pct={state.job?.pct || 0}
            logs={state.logs}
            status={state.job?.status || 'running'}
            connection={state.connection}
            onCancel={onCancel}
            onContinue={onContinue}
          />
        )}

        {state.step === 'preview' && state.job && (
          <PreviewStep
            job={state.job}
            artifacts={state.artifacts}
            onDeploy={onDeploy}
            onRestart={onRestart}
          />
        )}

        {state.step === 'configure' && mode === 'library' && (
          <Alert severity="info">库模式直接进 run 阶段</Alert>
        )}
        {state.step === 'configure' && !mode && (
          <Alert severity="info">请先回第 1 步选个方式</Alert>
        )}
      </Paper>
    </Box>
  );
}

// 外层:包 Suspense 满足 Next 16 useSearchParams 强制要求
export default function AvatarPipelinePage() {
  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: (t) => t.palette.mode === 'dark' ? '#0a0a0a' : '#f5f5f5',
      py: 4,
      px: 2,
    }}>
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        <Suspense
          fallback={
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress size={32} />
            </Box>
          }
        >
          <WizardInner />
        </Suspense>
      </Box>
    </Box>
  );
}

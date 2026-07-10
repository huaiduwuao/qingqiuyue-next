'use client';

import { useState } from 'react';
import { Box, Typography, Button, Alert, Chip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import BlenderAvatar from '@/digital-human/BlenderAvatar';
import type { JobSnapshot } from '@/lib/avatar-pipeline/types';

export interface PreviewStepProps {
  job: JobSnapshot;
  artifacts: { key: string; bytes: number; contentType: string; downloadUrl: string }[];
  onDeploy: () => Promise<void>;
  onRestart: () => void;
}

export default function PreviewStep({ job, artifacts, onDeploy, onRestart }: PreviewStepProps) {
  const theme = useTheme();
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState(false);
  const [deployErr, setDeployErr] = useState<string | null>(null);

  const modelArtifact = artifacts.find((a) => a.key.endsWith('/model.glb'));
  const modelUrl = modelArtifact?.downloadUrl
    ? `${modelArtifact.downloadUrl}?v=${Date.now()}`  // cache-bust
    : null;

  const handleDeploy = async () => {
    setDeploying(true);
    setDeployErr(null);
    try {
      await onDeploy();
      setDeployed(true);
    } catch (e: any) {
      setDeployErr(e?.message || String(e));
    } finally {
      setDeploying(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600 }}>第 4 步:预览产物</Typography>
        {job.status === 'completed' && (
          <Chip size="small" color="success" label="完成" sx={{ height: 20, fontSize: 10 }} />
        )}
        {job.status === 'failed' && (
          <Chip size="small" color="error" label="失败" sx={{ height: 20, fontSize: 10 }} />
        )}
        {job.status === 'cancelled' && (
          <Chip size="small" color="warning" label="已取消" sx={{ height: 20, fontSize: 10 }} />
        )}
      </Box>

      {modelUrl ? (
        <Box sx={{
          height: 360,
          borderRadius: 2,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
        }}>
          <BlenderAvatar modelUrl={modelUrl} autoRotate background={theme.palette.mode === 'dark' ? '#05060B' : '#eef0f5'} />
        </Box>
      ) : (
        <Alert severity="warning">
          产物中找不到 model.glb。{job.status === 'failed' && `失败阶段: ${job.error?.stage}`}
        </Alert>
      )}

      {job.status === 'completed' && (
        <Box>
          <Typography sx={{ fontSize: 12, fontWeight: 600, mb: 1 }}>
            产物清单
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {artifacts.map((a) => (
              <Box
                key={a.key}
                sx={{
                  display: 'flex',
                  gap: 1,
                  alignItems: 'center',
                  fontSize: 11,
                  color: 'text.secondary',
                }}
              >
                <Typography sx={{ fontSize: 11, fontFamily: 'monospace' }}>
                  {a.key.split('/').pop()}
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
                  {(a.bytes / 1024).toFixed(1)} KB
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {deployed && (
        <Alert severity="success">
          已部署到 <code>public/avatars/model.glb</code>,刷新 <code>/digital-human</code> 即可看到新数字人。
        </Alert>
      )}
      {deployErr && <Alert severity="error">部署失败: {deployErr}</Alert>}

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={onRestart}>
          ← 新建一个
        </Button>
        {job.status === 'completed' && (
          <Button
            variant="contained"
            disabled={deploying || deployed}
            onClick={handleDeploy}
          >
            {deploying ? '部署中…' : deployed ? '已部署' : '部署为当前数字人'}
          </Button>
        )}
      </Box>
    </Box>
  );
}

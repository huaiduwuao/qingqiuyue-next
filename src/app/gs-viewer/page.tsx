'use client';

/**
 * GSViewer — 3D Gaussian Splatting 资产预览页面
 *
 * 路由: /gs-viewer?asset=<baseUrl>
 *
 * 用法:
 *   /gs-viewer?asset=/api/avatar/pipeline/jobs/xxx/artifacts
 *   /gs-viewer?asset=https://minio.example.com/qq-media/avatar/assets/job123
 *
 * 如果未提供 asset 参数, 显示 URL 输入框。
 */

import React, { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Box, Container, Typography, TextField, Button, IconButton,
  CircularProgress, Alert, Chip, Tooltip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ThemeProvider } from '@mui/material/styles';
import { darkTheme } from '@/styles/theme';

// 动态导入 (避免 SSR 时 Three.js 报错)
const GaussianSplatRenderer = dynamic(
  () => import('@/digital-human/gs/GaussianSplatRenderer'),
  {
    ssr: false,
    loading: () => (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
        <CircularProgress size={32} />
      </Box>
    ),
  },
);

function GSViewerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const assetParam = searchParams.get('asset') || '';

  const [assetUrl, setAssetUrl] = useState(assetParam);
  const [viewAsset, setViewAsset] = useState<string | null>(
    assetParam || null,
  );
  const [fullscreen, setFullscreen] = useState(false);
  const [quality, setQuality] = useState<'quality' | 'balanced' | 'performance'>('balanced');

  const handleLoad = () => {
    const trimmed = assetUrl.trim();
    if (trimmed) {
      setViewAsset(trimmed);
      // 更新 URL (不刷新页面)
      const url = new URL(window.location.href);
      url.searchParams.set('asset', trimmed);
      window.history.replaceState({}, '', url.toString());
    }
  };

  if (!viewAsset) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
          3D Gaussian Splatting 预览
        </Typography>
        <Alert severity="info" sx={{ mb: 3 }}>
          输入资产目录 URL (包含 gaussians.bin / skinning.bin / smplx.json / meta.json)
        </Alert>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            label="资产 URL"
            placeholder="/api/avatar/pipeline/jobs/xxx/artifacts"
            value={assetUrl}
            onChange={(e) => setAssetUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLoad()}
          />
          <Button variant="contained" onClick={handleLoad} disabled={!assetUrl.trim()}>
            加载
          </Button>
        </Box>
        <Typography variant="caption" color="text.secondary">
          支持 .bin (二进制) 和 .ply (点云) 格式
        </Typography>
      </Container>
    );
  }

  return (
    <Box
      sx={{
        position: fullscreen ? 'fixed' : 'relative',
        inset: fullscreen ? 0 : undefined,
        width: '100%',
        height: fullscreen ? '100vh' : 'calc(100vh - 64px)',
        bgcolor: '#05060B',
        zIndex: fullscreen ? 1300 : 1,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 顶部工具栏 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1,
          px: 2,
          bgcolor: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          zIndex: 2,
        }}
      >
        <IconButton size="small" onClick={() => router.back()} sx={{ color: 'white' }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>

        <Typography sx={{ color: 'white', fontSize: 13, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          GS Viewer — {viewAsset.split('/').slice(-2).join('/')}
        </Typography>

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {(['performance', 'balanced', 'quality'] as const).map((q) => (
            <Chip
              key={q}
              label={q === 'performance' ? '快' : q === 'balanced' ? '平衡' : '好'}
              size="small"
              variant={quality === q ? 'filled' : 'outlined'}
              color={quality === q ? 'primary' : 'default'}
              onClick={() => setQuality(q)}
              sx={{
                color: quality === q ? undefined : 'rgba(255,255,255,0.6)',
                borderColor: 'rgba(255,255,255,0.2)',
                cursor: 'pointer',
                fontSize: 11,
              }}
            />
          ))}
        </Box>

        <Tooltip title={fullscreen ? '退出全屏' : '全屏'}>
          <IconButton
            size="small"
            onClick={() => setFullscreen((v) => !v)}
            sx={{ color: 'rgba(255,255,255,0.7)' }}
          >
            {fullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* 3DGS 渲染器 */}
      <Box sx={{ flex: 1, position: 'relative' }}>
        <GaussianSplatRenderer
          assetUrl={`${viewAsset}/gaussians.bin`}
          skinningUrl={`${viewAsset}/skinning.bin`}
          smplxUrl={`${viewAsset}/smplx.json`}
          metaUrl={`${viewAsset}/meta.json`}
          quality={quality}
          orbitControls
        />
      </Box>
    </Box>
  );
}

export default function GSViewerPage() {
  return (
    <ThemeProvider theme={darkTheme}>
      <Suspense
        fallback={
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
            <CircularProgress size={32} />
          </Box>
        }
      >
        <GSViewerContent />
      </Suspense>
    </ThemeProvider>
  );
}

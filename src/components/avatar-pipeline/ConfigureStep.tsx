'use client';

import { useState } from 'react';
import {
  Box, Typography, Button, FormControlLabel, Switch,
  TextField, Alert, Slider,
} from '@mui/material';

export interface ConfigureStepProps {
  defaultName: string;
  defaultSkip3dgs: boolean;
  defaultHeight: number;
  onBack: () => void;
  onStart: (config: { name: string; skip3dgs: boolean; height: number }) => void;
  busy: boolean;
  error: string | null;
}

export default function ConfigureStep({
  defaultName,
  defaultSkip3dgs,
  defaultHeight,
  onBack,
  onStart,
  busy,
  error,
}: ConfigureStepProps) {
  const [name, setName] = useState(defaultName);
  const [skip3dgs, setSkip3dgs] = useState(defaultSkip3dgs);
  const [height, setHeight] = useState(defaultHeight);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
        第 2 步:配置参数
      </Typography>

      <Box>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
          角色名
        </Typography>
        <TextField
          fullWidth
          size="small"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="xiaoqiu"
        />
      </Box>

      <Box>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
          身高: <strong>{height.toFixed(2)} m</strong>
        </Typography>
        <Slider
          value={height}
          onChange={(_, v) => setHeight(v as number)}
          min={1.40}
          max={2.10}
          step={0.01}
          marks={[
            { value: 1.55, label: '1.55' },
            { value: 1.75, label: '1.75' },
            { value: 1.95, label: '1.95' },
          ]}
        />
      </Box>

      <FormControlLabel
        control={
          <Switch
            checked={skip3dgs}
            onChange={(e) => setSkip3dgs(e.target.checked)}
          />
        }
        label={
          <Box>
            <Typography sx={{ fontSize: 13 }}>跳过 3DGS 训练</Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
              没 NVIDIA GPU / 显存 &lt; 8GB 时勾选;直接用 COLMAP 稠密点云 → mesh
            </Typography>
          </Box>
        }
      />

      <Alert severity="info" sx={{ fontSize: 12 }}>
        <strong>预计耗时</strong>:30 秒视频 + 跳过 3DGS ≈ 5~10 分钟;<br />
        含 3DGS 训练 ≈ 30~60 分钟(取决于 GPU)。
      </Alert>

      {error && <Alert severity="error" sx={{ fontSize: 12 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={onBack} disabled={busy}>
          返回
        </Button>
        <Button
          variant="contained"
          disabled={busy || !name}
          onClick={() => onStart({ name, skip3dgs, height })}
        >
          {busy ? '启动中…' : '开始生成'}
        </Button>
      </Box>
    </Box>
  );
}

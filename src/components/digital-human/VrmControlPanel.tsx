'use client';

/**
 * VrmControlPanel — 右侧折叠控制面板（MUI Drawer）
 *
 * 收纳：
 *   - 12 个表情 Slider（精细控制）
 *   - 5 个场景 ToggleButton
 *   - 6 个相机视角 IconButton
 *   - 跳舞控制（开/关 + 风格 + BPM + 动作幅度）
 *   - 唱歌控制（演示歌曲 / 麦克风）
 *   - 杂项（彩屑、自动眨眼、视线跟随、FOV）
 *
 * 用法：
 *   <VrmControlPanel open={panelOpen} onClose={...} handle={stageRef.current} />
 */

import React from 'react';
import {
  Box, Drawer, IconButton, Typography, Slider, Stack, ToggleButton, ToggleButtonGroup,
  Switch, FormControlLabel, Divider, Button, Tooltip, useMediaQuery, useTheme,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { alpha } from '@mui/material/styles';
import {
  EXPRESSION_CHANNELS, CAMERA_PRESETS, CAMERA_LABELS,
  DANCE_STYLES, DANCE_LABELS,
  type ScenePresetName, type CameraPresetName, type DanceStyle,
} from '@/digital-human/vrm/types';
import { SCENE_PRESETS, SCENE_LABELS } from '@/digital-human/vrm/sceneBuilders';
import type { VrmStageHandle } from '@/digital-human/VrmStage';

interface Props {
  open: boolean;
  onClose: () => void;
  handle: VrmStageHandle | null;
  /** 父组件已有的状态镜像（用于 UI 同步） */
  state: {
    dancing: boolean;
    danceStyle: DanceStyle;
    bpm: number;
    danceAmp: number;
    scene: ScenePresetName;
    camera: CameraPresetName;
    confetti: boolean;
    autoBlink: boolean;
    lookAtCamera: boolean;
    fov: number;
    songOn: boolean;
    micOn: boolean;
  };
  onChange: (patch: Partial<Props['state']>) => void;
}

export default function VrmControlPanel({ open, onClose, handle, state, onChange }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [expressions, setExpressions] = React.useState<Record<string, number>>({});

  // 暴露给 handle 的内部 setter（手动 UI 操作时通过 setUserLipOverride 通知主组件）
  const setExpression = (key: string, value: number) => {
    console.log('[VrmControlPanel] slider', key, '=', value, '| handle:', !!handle);
    setExpressions((prev) => ({ ...prev, [key]: value }));
    handle?.setEmotion({ [key]: value });
    if (['aa', 'ih', 'ou', 'ee', 'oh'].includes(key)) handle?.setUserLipOverride(true);
    if (['blinkLeft', 'blinkRight'].includes(key)) handle?.setUserBlinkOverride(true);
  };

  const resetExpressions = () => {
    console.log('[VrmControlPanel] reset');
    setExpressions({});
    handle?.setEmotion({});
    handle?.setUserLipOverride(false);
    handle?.setUserBlinkOverride(false);
  };

  const sectionLabel = (text: string) => (
    <Typography sx={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.22em', color: 'text.disabled', textTransform: 'uppercase', mb: 0.75, mt: 1 }}>
      {text}
    </Typography>
  );

  return (
    <Drawer
      anchor={isMobile ? 'bottom' : 'right'}
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            width: { xs: '100%', md: 340 },
            maxHeight: { xs: '80vh', md: '100%' },
            bgcolor: 'rgba(16,13,30,0.92)',
            backdropFilter: 'blur(16px)',
            borderLeft: { xs: 0, md: '1px solid rgba(255,255,255,0.1)' },
            borderTop: { xs: '1px solid rgba(255,255,255,0.1)', md: 0 },
            color: 'text.primary',
          },
        },
      }}
    >
      <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5, height: '100%', overflow: 'auto' }}>
        {/* 标题栏 */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.12em' }}>
            🎛 舞台控制台
          </Typography>
          <IconButton size="small" onClick={onClose}><CloseRoundedIcon fontSize="small" /></IconButton>
        </Box>

        {/* 表情精细控制（12 个 Slider）*/}
        {sectionLabel('表情精细（12 通道）')}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          {EXPRESSION_CHANNELS.map(({ key, label }) => (
            <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', width: 56, flex: 'none' }}>{label}</Typography>
              <Slider
                size="small" min={0} max={1} step={0.01}
                value={expressions[key] ?? 0}
                onChange={(_, v) => setExpression(key, v as number)}
                sx={{ flex: 1, color: '#ff4fd8' }}
              />
              <Typography sx={{ fontSize: 10, color: 'text.disabled', width: 28, textAlign: 'right', fontFamily: 'ui-monospace' }}>
                {(expressions[key] ?? 0).toFixed(2)}
              </Typography>
            </Box>
          ))}
          <Button size="small" onClick={resetExpressions} sx={{ alignSelf: 'flex-start', mt: 0.5, fontSize: 11 }}>
            重置所有表情
          </Button>
        </Box>

        <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.06)' }} />

        {/* 场景 */}
        {sectionLabel('场景')}
        <ToggleButtonGroup
          exclusive size="small" fullWidth
          value={state.scene}
          onChange={(_, v) => v && onChange({ scene: v as ScenePresetName })}
          sx={{ flexWrap: 'wrap', gap: 0.5, '& .MuiToggleButton-root': { flex: '1 1 30%', borderRadius: '8px !important', fontSize: 11, px: 0.5, py: 0.5, whiteSpace: 'nowrap' } }}
        >
          {SCENE_PRESETS.map((s: ScenePresetName) => (
            <ToggleButton key={s} value={s}>
              {SCENE_LABELS[s]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {/* 相机视角 */}
        {sectionLabel('相机视角')}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 0.5 }}>
          {CAMERA_PRESETS.map((c) => (
            <Tooltip key={c} title={CAMERA_LABELS[c]} arrow>
              <Button
                size="small" variant={state.camera === c ? 'contained' : 'outlined'}
                onClick={() => onChange({ camera: c })}
                sx={{ minWidth: 0, px: 0.5, fontSize: 10, py: 0.5,
                  bgcolor: state.camera === c ? (t) => alpha(t.palette.primary.main, 0.4) : 'transparent' }}
              >
                {CAMERA_LABELS[c].slice(0, 2)}
              </Button>
            </Tooltip>
          ))}
        </Box>

        <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.06)' }} />

        {/* 跳舞 */}
        {sectionLabel('跳舞')}
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Button
            size="small" variant={state.dancing ? 'contained' : 'outlined'}
            onClick={() => onChange({ dancing: !state.dancing })}
            sx={{ flex: 1, fontSize: 12 }}
          >
            {state.dancing ? '■ 停止' : '▶ 开始'}
          </Button>
          <ToggleButtonGroup
            exclusive size="small"
            value={state.danceStyle}
            onChange={(_, v) => v && onChange({ danceStyle: v as DanceStyle })}
          >
            {DANCE_STYLES.map((s) => (
              <ToggleButton key={s} value={s} sx={{ fontSize: 10, px: 1 }}>{DANCE_LABELS[s]}</ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>
        <Box sx={{ mt: 0.5 }}>
          <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>BPM {state.bpm}</Typography>
          <Slider size="small" min={60} max={200} step={1} value={state.bpm}
            onChange={(_, v) => onChange({ bpm: v as number })} sx={{ color: '#4fd8ff' }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>动作幅度 {state.danceAmp.toFixed(2)}</Typography>
          <Slider size="small" min={0} max={1.5} step={0.05} value={state.danceAmp}
            onChange={(_, v) => onChange({ danceAmp: v as number })} sx={{ color: '#4fd8ff' }} />
        </Box>

        <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.06)' }} />

        {/* 唱歌 */}
        {sectionLabel('唱歌（口型同步）')}
        <Stack direction="row" spacing={1}>
          <Button size="small" variant={state.songOn ? 'contained' : 'outlined'}
            onClick={() => onChange({ songOn: !state.songOn })} sx={{ flex: 1, fontSize: 11 }}>
            {state.songOn ? '■ 停止歌曲' : '▶ 演示歌曲'}
          </Button>
          <Button size="small" variant={state.micOn ? 'contained' : 'outlined'}
            onClick={() => onChange({ micOn: !state.micOn })} sx={{ flex: 1, fontSize: 11 }}>
            {state.micOn ? '■ 关麦' : '🎤 麦克风'}
          </Button>
        </Stack>

        <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.06)' }} />

        {/* 杂项 */}
        {sectionLabel('杂项')}
        <Stack spacing={0}>
          <FormControlLabel
            control={<Switch size="small" checked={state.confetti} onChange={(_, v) => onChange({ confetti: v })} />}
            label={<Typography sx={{ fontSize: 11 }}>彩屑氛围（跳舞时）</Typography>}
          />
          <FormControlLabel
            control={<Switch size="small" checked={state.autoBlink} onChange={(_, v) => onChange({ autoBlink: v })} />}
            label={<Typography sx={{ fontSize: 11 }}>自动眨眼</Typography>}
          />
          <FormControlLabel
            control={<Switch size="small" checked={state.lookAtCamera} onChange={(_, v) => onChange({ lookAtCamera: v })} />}
            label={<Typography sx={{ fontSize: 11 }}>视线跟随镜头</Typography>}
          />
          <Box sx={{ mt: 0.5 }}>
            <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>FOV {state.fov}°</Typography>
            <Slider size="small" min={20} max={60} step={1} value={state.fov}
              onChange={(_, v) => onChange({ fov: v as number })} sx={{ color: '#9b6bff' }} />
          </Box>
        </Stack>
      </Box>
    </Drawer>
  );
}

'use client';

/**
 * /digital-human 顶部按钮排:退出 + 模型选择 + 会话列表切换 + 广场开关 + 屏幕开关 + 控制台切换
 * (从 ImmersiveDigitalHuman.tsx 拆出,JSX 原样搬)。
 */
import React from 'react';
import { FormControl, IconButton, MenuItem, Select } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import TvRoundedIcon from '@mui/icons-material/TvRounded';
import ParkRoundedIcon from '@mui/icons-material/ParkRounded';
import type { VrmModelConfig } from './vrm/config/types';
import type { AvatarMode } from './immersiveUtils';

export const ImmersiveTopBar = React.memo(function ImmersiveTopBar({
  models,
  selectedModel,
  onSelectModel,
  onExit,
  sessionDrawerOpen,
  onToggleSessions,
  avatarMode,
  worldOn,
  onToggleWorld,
  narrow,
  displaysOn,
  onToggleDisplays,
  panelOpen,
  onTogglePanel,
}: {
  models: VrmModelConfig[];
  selectedModel: VrmModelConfig | null;
  onSelectModel: (m: VrmModelConfig) => void;
  onExit: () => void;
  sessionDrawerOpen: boolean;
  onToggleSessions: () => void;
  avatarMode: AvatarMode;
  worldOn: boolean;
  onToggleWorld: () => void;
  narrow: boolean;
  displaysOn: boolean;
  onToggleDisplays: () => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
}) {
  return (
    <>
      <IconButton
        onClick={onExit}
        size="medium"
        aria-label="退出"
        sx={{
          position: 'absolute',
          top: 'calc(12px + var(--sat, 0px))',
          left: 12,
          zIndex: 3,
          color: 'rgba(255,255,255,0.85)',
          bgcolor: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(8px)',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
        }}
      >
        <CloseRoundedIcon />
      </IconButton>

      {/* 模型选择器 */}
      {models.length > 1 && (
        <FormControl
          size="small"
          sx={{
            position: 'absolute',
            top: 'calc(12px + var(--sat, 0px))',
            // 手机上会话按钮在 left:60,模型选择器排在它右边,不叠在一起
            left: { xs: 108, sm: 60 },
            zIndex: 3,
            minWidth: { xs: 0, sm: 120 },
            maxWidth: { xs: 'calc(100vw - 220px)', sm: 'none' }, // 右边让出广场开关 + 控制台两个按钮
            '& .MuiOutlinedInput-root': {
              color: 'rgba(255,255,255,0.85)',
              bgcolor: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(8px)',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
              '&.Mui-focused fieldset': { borderColor: '#25F4EE' },
            },
            '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.7)' },
          }}
        >
          <Select
            value={selectedModel?.id ?? ''}
            onChange={(e) => {
              const m = models.find((m) => m.id === e.target.value);
              if (m) onSelectModel(m);
            }}
            displayEmpty
            startAdornment={
              <PersonRoundedIcon sx={{ fontSize: 18, mr: 0.5, color: 'rgba(255,255,255,0.7)' }} />
            }
            sx={{ fontSize: 13 }}
          >
            {models.map((m) => (
              <MenuItem key={m.id} value={m.id} sx={{ fontSize: 13 }}>
                {m.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      <IconButton
        onClick={onToggleSessions}
        size="medium"
        aria-label="会话列表"
        sx={{
          position: 'absolute',
          top: 'calc(12px + var(--sat, 0px))',
          left: { xs: 60, sm: models.length > 1 ? 190 : 60 },
          zIndex: 3,
          color: sessionDrawerOpen ? '#25F4EE' : 'rgba(255,255,255,0.85)',
          bgcolor: sessionDrawerOpen ? 'rgba(37,244,238,0.15)' : 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(8px)',
          '&:hover': { bgcolor: 'rgba(37,244,238,0.2)' },
        }}
      >
        <ForumRoundedIcon />
      </IconButton>
      {avatarMode === 'vrm' && (
        <IconButton
          onClick={onToggleWorld}
          size="medium"
          aria-label={worldOn ? '收起星光广场' : '打开星光广场'}
          title={worldOn ? '收起星光广场(回到小舞台)' : '打开星光广场'}
          sx={{
            position: 'absolute',
            top: 'calc(12px + var(--sat, 0px))',
            right: narrow ? 60 : 108,
            zIndex: 3,
            color: worldOn ? '#9dffcb' : 'rgba(255,255,255,0.85)',
            bgcolor: worldOn ? 'rgba(157,255,203,0.15)' : 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
            '&:hover': { bgcolor: 'rgba(157,255,203,0.2)' },
          }}
        >
          <ParkRoundedIcon />
        </IconButton>
      )}
      {avatarMode === 'vrm' && !narrow && (
        <IconButton
          onClick={onToggleDisplays}
          size="medium"
          aria-label={displaysOn ? '收起场景里的屏幕' : '显示场景里的屏幕'}
          title={displaysOn ? '收起场景里的屏幕' : '显示场景里的屏幕'}
          sx={{
            position: 'absolute',
            top: 'calc(12px + var(--sat, 0px))',
            right: 60,
            zIndex: 3,
            color: displaysOn ? '#25F4EE' : 'rgba(255,255,255,0.85)',
            bgcolor: displaysOn ? 'rgba(37,244,238,0.15)' : 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
            '&:hover': { bgcolor: 'rgba(37,244,238,0.2)' },
          }}
        >
          <TvRoundedIcon />
        </IconButton>
      )}
      <IconButton
        onClick={onTogglePanel}
        size="medium"
        aria-label="舞台控制台"
        sx={{
          position: 'absolute',
          top: 'calc(12px + var(--sat, 0px))',
          right: 12,
          zIndex: 3,
          color: panelOpen ? '#ff4fd8' : 'rgba(255,255,255,0.85)',
          bgcolor: panelOpen ? 'rgba(255,79,216,0.15)' : 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(8px)',
          '&:hover': { bgcolor: 'rgba(255,79,216,0.2)' },
        }}
      >
        <TuneRoundedIcon />
      </IconButton>
    </>
  );
});

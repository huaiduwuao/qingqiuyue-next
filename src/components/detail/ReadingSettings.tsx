'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Slider from '@mui/material/Slider';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import SettingsIcon from '@mui/icons-material/Settings';
import FormatSizeIcon from '@mui/icons-material/FormatSize';
import PaletteIcon from '@mui/icons-material/Palette';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';

export interface PageStyle {
  color: string;
  bgColor: string;
  bodyImage: string;
  bodySettingImage: string;
  blackBodyImage: string;
  blackBodySettingImage: string;
  fontFamily: string;
  fontSize: number;
  loadStyle: 'pull' | 'click';
  black: boolean;
}

export interface ThemePreset extends Omit<PageStyle, 'fontFamily' | 'fontSize' | 'loadStyle' | 'black'> {
  label: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { color: '#2E8B57', bgColor: '#CCE8CF', bodyImage: '/novel_theme1_bg.png', bodySettingImage: '/novel_theme1_bg_setting.png', blackBodyImage: '/novel_theme7_bg.png', blackBodySettingImage: '/novel_theme7_bg_setting.png', label: '青竹' },
  { color: '#0000FF', bgColor: '#E6E6FA', bodyImage: '/novel_theme2_bg.png', bodySettingImage: '/novel_theme2_bg_setting.png', blackBodyImage: '/novel_theme7_bg.png', blackBodySettingImage: '/novel_theme7_bg_setting.png', label: '雾蓝' },
  { color: '#FF0000', bgColor: '#FFE4E1', bodyImage: '/novel_theme3_bg.png', bodySettingImage: '/novel_theme3_bg_setting.png', blackBodyImage: '/novel_theme7_bg.png', blackBodySettingImage: '/novel_theme7_bg_setting.png', label: '胭脂' },
  { color: '#800080', bgColor: '#F0E6F0', bodyImage: '/novel_theme4_bg.png', bodySettingImage: '/novel_theme4_bg_setting.png', blackBodyImage: '/novel_theme7_bg.png', blackBodySettingImage: '/novel_theme7_bg_setting.png', label: '紫罗兰' },
  { color: '#8B4513', bgColor: '#F5E6D3', bodyImage: '/novel_theme5_bg.png', bodySettingImage: '/novel_theme5_bg_setting.png', blackBodyImage: '/novel_theme7_bg.png', blackBodySettingImage: '/novel_theme7_bg_setting.png', label: '暖棕' },
  { color: 'text.primary', bgColor: '#FAFAFA', bodyImage: '/novel_theme6_bg.png', bodySettingImage: '/novel_theme6_bg_setting.png', blackBodyImage: '/novel_theme7_bg.png', blackBodySettingImage: '/novel_theme7_bg_setting.png', label: '净白' },
];

export const DEFAULT_PAGE_STYLE: PageStyle = {
  ...THEME_PRESETS[0],
  fontFamily: '',
  fontSize: 16,
  loadStyle: 'pull',
  black: false,
};

interface ReadingSettingsProps {
  open: boolean;
  onClose: () => void;
  style: PageStyle;
  onChange: (updates: Partial<PageStyle>) => void;
  /** 底部额外 slot,例如"加入书架"按钮 (novel 用) */
  footerAction?: React.ReactNode;
}

export function ReadingSettings({ open, onClose, style, onChange, footerAction }: ReadingSettingsProps) {
  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box
        sx={{
          width: { xs: '100%', sm: 320 },
          bgcolor: 'background.paper',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <SettingsIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          <Typography sx={{ fontSize: 15, fontWeight: 600, flex: 1 }}>阅读设置</Typography>
          <IconButton size="small" onClick={onClose}>
            ✕
          </IconButton>
        </Box>

        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {/* 字号 */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
              <FormatSizeIcon sx={{ fontSize: 14, color: 'primary.main' }} />
              <Typography variant="subtitle2">字体大小</Typography>
              <Typography sx={{ ml: 'auto', fontSize: 12, color: 'text.secondary', fontFamily: 'monospace' }}>
                {style.fontSize}px
              </Typography>
            </Box>
            <Slider
              value={style.fontSize}
              min={12}
              max={24}
              step={1}
              onChange={(_, v) => onChange({ fontSize: v as number })}
              marks={[
                { value: 12, label: 'A' },
                { value: 16, label: 'A' },
                { value: 24, label: 'A' },
              ]}
            />
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* 主题色 */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
              <PaletteIcon sx={{ fontSize: 14, color: 'primary.main' }} />
              <Typography variant="subtitle2">主题颜色</Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
              {THEME_PRESETS.map((theme, idx) => {
                const isActive = style.color === theme.color && style.bgColor === theme.bgColor;
                return (
                  <Box
                    key={idx}
                    onClick={() => onChange(theme)}
                    sx={{
                      cursor: 'pointer',
                      p: 1,
                      borderRadius: 1.5,
                      border: '2px solid',
                      borderColor: isActive ? 'primary.main' : 'transparent',
                      transition: 'all 0.2s',
                      bgcolor: theme.bgColor,
                      '&:hover': { transform: 'translateY(-2px)' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box sx={{ width: 16, height: 16, borderRadius: 0.5, bgcolor: theme.color }} />
                      <Typography sx={{ fontSize: 11, color: theme.color, fontWeight: 600 }}>
                        {theme.label}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* 翻页模式 */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>阅读模式</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                fullWidth
                variant={style.loadStyle === 'pull' ? 'contained' : 'outlined'}
                onClick={() => onChange({ loadStyle: 'pull' })}
              >
                滚动
              </Button>
              <Button
                size="small"
                fullWidth
                variant={style.loadStyle === 'click' ? 'contained' : 'outlined'}
                onClick={() => onChange({ loadStyle: 'click' })}
              >
                翻页
              </Button>
            </Box>
          </Box>

          {/* 日夜 */}
          <Box sx={{ mb: 3 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={style.black ? <LightModeIcon /> : <DarkModeIcon />}
              onClick={() => onChange({ black: !style.black })}
              sx={{ borderRadius: 4 }}
            >
              {style.black ? '日间模式' : '夜间模式'}
            </Button>
          </Box>

          {footerAction}
        </Box>
      </Box>
    </Drawer>
  );
}

'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Switch from '@mui/material/Switch';
import Slider from '@mui/material/Slider';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import SettingsIcon from '@mui/icons-material/Settings';
import HighQualityIcon from '@mui/icons-material/HighQuality';
import SubtitlesIcon from '@mui/icons-material/Subtitles';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import FlipCameraAndroidIcon from '@mui/icons-material/FlipCameraAndroid';
import PictureInPictureAltIcon from '@mui/icons-material/PictureInPictureAlt';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import AspectRatioIcon from '@mui/icons-material/AspectRatio';
import SpeedIcon from '@mui/icons-material/Speed';
import CellTowerIcon from '@mui/icons-material/CellTower';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import HelpIcon from '@mui/icons-material/Help';
import LogoutIcon from '@mui/icons-material/Logout';

export type LiveQuality = 'SD' | 'HD' | 'FHD' | 'BD';
export type LiveAspect = '16:9' | '4:3' | 'fill';
export type LiveSpeed = 0.5 | 1 | 1.25 | 1.5 | 2;

export interface LivePlayerSettingsState {
  quality: LiveQuality;
  danmakuOn: boolean;
  danmakuOpacity: number; // 20-100
  danmakuSpeed: number; // 4-12 (seconds, lower = faster)
  danmakuFontSize: number; // 10-22
  muted: boolean;
  mirror: boolean;
  pip: boolean;
  aspect: LiveAspect;
  speed: LiveSpeed;
  notifyOn: boolean;
  autoScrollChat: boolean;
  giftFx: 'full' | 'simple';
  allowMobile: boolean;
}

export const DEFAULT_LIVE_SETTINGS: LivePlayerSettingsState = {
  quality: 'FHD',
  danmakuOn: true,
  danmakuOpacity: 80,
  danmakuSpeed: 8,
  danmakuFontSize: 14,
  muted: false,
  mirror: false,
  pip: false,
  aspect: '16:9',
  speed: 1,
  notifyOn: true,
  autoScrollChat: true,
  giftFx: 'full',
  allowMobile: true,
};

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function Section({ title, icon, children }: SectionProps) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.25 }}>
        <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>{title}</Typography>
      </Box>
      <Box sx={{ pl: 0.5 }}>{children}</Box>
    </Box>
  );
}

interface RowProps {
  label: string;
  desc?: string;
  control: React.ReactNode;
}

function SettingRow({ label, desc, control }: RowProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 1,
        minHeight: 44,
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, color: 'text.primary' }}>{label}</Typography>
        {desc && (
          <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.25, lineHeight: 1.4 }}>
            {desc}
          </Typography>
        )}
      </Box>
      <Box sx={{ flexShrink: 0 }}>{control}</Box>
    </Box>
  );
}

interface ChipGroupProps<T extends string | number> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: 'small' | 'medium';
}

function ChipGroup<T extends string | number>({ options, value, onChange, size = 'small' }: ChipGroupProps<T>) {
  return (
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Box
            key={String(o.value)}
            onClick={() => onChange(o.value)}
            sx={{
              px: 1.25,
              py: 0.5,
              fontSize: 11,
              fontWeight: active ? 600 : 400,
              borderRadius: 1.5,
              cursor: 'pointer',
              bgcolor: active ? 'primary.main' : 'rgba(255,255,255,0.04)',
              color: active ? '#fff' : 'text.secondary',
              border: '1px solid',
              borderColor: active ? 'primary.main' : 'divider',
              transition: 'all 0.15s',
              '&:hover': { borderColor: active ? 'primary.main' : 'primary.light' },
            }}
          >
            {o.label}
          </Box>
        );
      })}
    </Box>
  );
}

interface LivePlayerSettingsProps {
  open: boolean;
  onClose: () => void;
  settings: LivePlayerSettingsState;
  onChange: (updates: Partial<LivePlayerSettingsState>) => void;
  onReport?: () => void;
  onHelp?: () => void;
  onLeave?: () => void;
  /** 顶部:主播/直播信息 slot,例如 "月下旅人 · 直播中 12480" */
  headerInfo?: React.ReactNode;
}

export function LivePlayerSettings({
  open,
  onClose,
  settings,
  onChange,
  onReport,
  onHelp,
  onLeave,
  headerInfo,
}: LivePlayerSettingsProps) {
  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box
        sx={{
          width: { xs: '100%', sm: 360 },
          bgcolor: 'background.paper',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            borderBottom: '1px solid',
            borderColor: 'divider',
            flexShrink: 0,
          }}
        >
          <SettingsIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          <Typography sx={{ fontSize: 15, fontWeight: 600, flex: 1 }}>直播设置</Typography>
          <IconButton size="small" onClick={onClose} aria-label="关闭">
            ✕
          </IconButton>
        </Box>

        {headerInfo && (
          <Box sx={{ px: 2, py: 1, bgcolor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid', borderColor: 'divider' }}>
            {headerInfo}
          </Box>
        )}

        <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 2 }}>
          {/* 播放 */}
          <Section title="播放" icon={<HighQualityIcon sx={{ fontSize: 16 }} />}>
            <SettingRow
              label="清晰度"
              desc={settings.quality === 'BD' ? '蓝光 1080P' : settings.quality === 'FHD' ? '超清 720P' : settings.quality === 'HD' ? '高清 480P' : '流畅 360P'}
              control={
                <ChipGroup
                  options={[
                    { value: 'SD' as LiveQuality, label: '流畅' },
                    { value: 'HD' as LiveQuality, label: '高清' },
                    { value: 'FHD' as LiveQuality, label: '超清' },
                    { value: 'BD' as LiveQuality, label: '蓝光' },
                  ]}
                  value={settings.quality}
                  onChange={(v) => onChange({ quality: v })}
                />
              }
            />
            <SettingRow
              label="播放速度"
              desc="影响直播回放,不会影响实时直播"
              control={
                <ChipGroup
                  options={[
                    { value: 0.5 as LiveSpeed, label: '0.5x' },
                    { value: 1 as LiveSpeed, label: '1x' },
                    { value: 1.25 as LiveSpeed, label: '1.25x' },
                    { value: 1.5 as LiveSpeed, label: '1.5x' },
                    { value: 2 as LiveSpeed, label: '2x' },
                  ]}
                  value={settings.speed}
                  onChange={(v) => onChange({ speed: v })}
                />
              }
            />
            <SettingRow
              label="画面比例"
              control={
                <ChipGroup
                  options={[
                    { value: '16:9' as LiveAspect, label: '16:9' },
                    { value: '4:3' as LiveAspect, label: '4:3' },
                    { value: 'fill' as LiveAspect, label: '填满' },
                  ]}
                  value={settings.aspect}
                  onChange={(v) => onChange({ aspect: v })}
                />
              }
            />
          </Section>

          <Divider sx={{ my: 1.5 }} />

          {/* 弹幕 */}
          <Section title="弹幕" icon={<SubtitlesIcon sx={{ fontSize: 16 }} />}>
            <SettingRow
              label="开启弹幕"
              desc="关闭后直播画面不再显示飘字"
              control={
                <Switch
                  checked={settings.danmakuOn}
                  onChange={(_, v) => onChange({ danmakuOn: v })}
                  size="small"
                />
              }
            />
            <SettingRow
              label="不透明度"
              control={
                <Box sx={{ width: 120 }}>
                  <Slider
                    value={settings.danmakuOpacity}
                    min={20}
                    max={100}
                    step={10}
                    size="small"
                    disabled={!settings.danmakuOn}
                    onChange={(_, v) => onChange({ danmakuOpacity: v as number })}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(v) => `${v}%`}
                  />
                </Box>
              }
            />
            <SettingRow
              label="滚动速度"
              desc="数字越小飘得越快"
              control={
                <Box sx={{ width: 120 }}>
                  <Slider
                    value={settings.danmakuSpeed}
                    min={4}
                    max={12}
                    step={1}
                    size="small"
                    disabled={!settings.danmakuOn}
                    onChange={(_, v) => onChange({ danmakuSpeed: v as number })}
                    valueLabelDisplay="auto"
                    marks={[
                      { value: 4, label: '快' },
                      { value: 12, label: '慢' },
                    ]}
                  />
                </Box>
              }
            />
            <SettingRow
              label="字体大小"
              control={
                <Box sx={{ width: 120 }}>
                  <Slider
                    value={settings.danmakuFontSize}
                    min={10}
                    max={22}
                    step={1}
                    size="small"
                    disabled={!settings.danmakuOn}
                    onChange={(_, v) => onChange({ danmakuFontSize: v as number })}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(v) => `${v}px`}
                  />
                </Box>
              }
            />
          </Section>

          <Divider sx={{ my: 1.5 }} />

          {/* 画面 */}
          <Section title="画面与声音" icon={<VolumeUpIcon sx={{ fontSize: 16 }} />}>
            <SettingRow
              label="静音"
              desc={settings.muted ? '当前已静音' : '正常播放声音'}
              control={
                <Switch
                  checked={settings.muted}
                  onChange={(_, v) => onChange({ muted: v })}
                  size="small"
                />
              }
            />
            <SettingRow
              label="镜像翻转"
              desc="适合前置摄像头/特定舞蹈教学"
              control={
                <Switch
                  checked={settings.mirror}
                  onChange={(_, v) => onChange({ mirror: v })}
                  size="small"
                />
              }
            />
            <SettingRow
              label="画中画"
              desc="小窗浮在其他应用上层"
              control={
                <Switch
                  checked={settings.pip}
                  onChange={(_, v) => onChange({ pip: v })}
                  size="small"
                />
              }
            />
          </Section>

          <Divider sx={{ my: 1.5 }} />

          {/* 消息提醒 */}
          <Section title="消息与互动" icon={<NotificationsActiveIcon sx={{ fontSize: 16 }} />}>
            <SettingRow
              label="新消息提醒"
              desc="新聊天/连麦/抽奖时弹通知"
              control={
                <Switch
                  checked={settings.notifyOn}
                  onChange={(_, v) => onChange({ notifyOn: v })}
                  size="small"
                />
              }
            />
            <SettingRow
              label="自动滚动到最新"
              desc="聊天列表始终停在最新一条"
              control={
                <Switch
                  checked={settings.autoScrollChat}
                  onChange={(_, v) => onChange({ autoScrollChat: v })}
                  size="small"
                />
              }
            />
            <SettingRow
              label="礼物特效"
              desc="全屏动画或仅顶部飞过"
              control={
                <ChipGroup
                  options={[
                    { value: 'full' as const, label: '全屏' },
                    { value: 'simple' as const, label: '精简' },
                  ]}
                  value={settings.giftFx}
                  onChange={(v) => onChange({ giftFx: v })}
                />
              }
            />
          </Section>

          <Divider sx={{ my: 1.5 }} />

          {/* 网络 */}
          <Section title="网络与流量" icon={<CellTowerIcon sx={{ fontSize: 16 }} />}>
            <SettingRow
              label="移动网络播放"
              desc="关闭后 4G/5G 下会暂停并询问"
              control={
                <Switch
                  checked={settings.allowMobile}
                  onChange={(_, v) => onChange({ allowMobile: v })}
                  size="small"
                />
              }
            />
          </Section>

          <Divider sx={{ my: 1.5 }} />

          {/* 操作 */}
          <Section title="更多" icon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<ReportProblemIcon sx={{ fontSize: 16 }} />}
                onClick={onReport}
                sx={{ justifyContent: 'flex-start', color: 'text.primary', borderColor: 'divider' }}
              >
                举报直播间
              </Button>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<HelpIcon sx={{ fontSize: 16 }} />}
                onClick={onHelp}
                sx={{ justifyContent: 'flex-start', color: 'text.primary', borderColor: 'divider' }}
              >
                帮助与反馈
              </Button>
              <Button
                fullWidth
                variant="outlined"
                color="error"
                startIcon={<LogoutIcon sx={{ fontSize: 16 }} />}
                onClick={onLeave}
                sx={{ justifyContent: 'flex-start' }}
              >
                退出直播间
              </Button>
            </Box>
          </Section>
        </Box>

        <Box
          sx={{
            p: 1.5,
            borderTop: '1px solid',
            borderColor: 'divider',
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
            直播设置会在本设备保存,不会影响其他设备
          </Typography>
        </Box>
      </Box>
    </Drawer>
  );
}

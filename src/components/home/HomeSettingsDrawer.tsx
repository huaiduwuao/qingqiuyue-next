'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Switch from '@mui/material/Switch';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import SettingsIcon from '@mui/icons-material/Settings';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import KeyboardRoundedIcon from '@mui/icons-material/KeyboardRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import HeadsetMicRoundedIcon from '@mui/icons-material/HeadsetMicRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import DensitySmallRoundedIcon from '@mui/icons-material/DensitySmallRounded';
import DensityMediumRoundedIcon from '@mui/icons-material/DensityMediumRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import PlayCircleFilledRoundedIcon from '@mui/icons-material/PlayCircleFilledRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import RestoreRoundedIcon from '@mui/icons-material/RestoreRounded';
import RecordVoiceOverRoundedIcon from '@mui/icons-material/RecordVoiceOverRounded';
import MotionPhotosOffRoundedIcon from '@mui/icons-material/MotionPhotosOffRounded';
import ContrastRoundedIcon from '@mui/icons-material/ContrastRounded';
import { useThemeMode, PRESET_COLORS } from '@/contexts/ThemeContext';
import { useHomeSettings, type HomeSettings } from '@/hooks/useHomeSettings';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function Section({ title, icon, children }: SectionProps) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
        <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', letterSpacing: 0.5, textTransform: 'uppercase' }}>
          {title}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>{children}</Box>
    </Box>
  );
}

interface RowProps {
  label: string;
  desc?: string;
  control: React.ReactNode;
  divider?: boolean;
}

function Row({ label, desc, control, divider }: RowProps) {
  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          py: 1.25,
          minHeight: 48,
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
      {divider && <Divider sx={{ borderColor: 'divider' }} />}
    </>
  );
}

interface ChipGroupProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}

function ChipGroup<T extends string>({ options, value, onChange }: ChipGroupProps<T>) {
  return (
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Box
            key={o.value}
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

const SHORTCUTS: { keys: string; desc: string }[] = [
  { keys: '↑ ↓', desc: '上下选择视频/直播' },
  { keys: '← →', desc: '上下一个/上一个切换' },
  { keys: 'Space', desc: '播放/暂停' },
  { keys: 'M', desc: '静音/取消静音' },
  { keys: 'F', desc: '全屏/退出全屏' },
  { keys: 'L', desc: '点赞当前视频' },
  { keys: 'C', desc: '发送评论 (focus 聊天)' },
  { keys: '/', desc: '聚焦搜索框' },
  { keys: 'Esc', desc: '关闭弹层/Drawer' },
  { keys: '?', desc: '显示快捷键列表' },
];

const FAQ: { q: string; a: string }[] = [
  { q: '如何切换深色/浅色模式?', a: '在设置抽屉的"外观"分组中切换,或跟随系统。' },
  { q: '直播清晰度怎么选?', a: '进入直播间 → 右上角设置 → 清晰度。蓝光需稳定 WiFi。' },
  { q: 'AI 搜索记录在哪清?', a: '设置 → AI 设置 → 关闭"保留历史",或者 AI 搜索页右上角"清空"。' },
  { q: '账号异常怎么办?', a: '我的 → 客服,或联系 support@example.com。' },
];

export function HomeSettingsDrawer({ open, onClose }: Props) {
  const { mode, setTheme, primaryColor, setPrimaryColor } = useThemeMode();
  const { settings, update, reset } = useHomeSettings();
  const isDark = mode === 'dark';

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box
        sx={{
          width: { xs: '100%', sm: 380 },
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
          <Typography sx={{ fontSize: 15, fontWeight: 600, flex: 1 }}>偏好设置</Typography>
          <Button size="small" onClick={reset} sx={{ fontSize: 11, color: 'text.secondary', minWidth: 'auto' }}>
            恢复默认
          </Button>
          <IconButton size="small" onClick={onClose} aria-label="关闭">
            ✕
          </IconButton>
        </Box>

        <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 2 }}>
          {/* 外观 */}
          <Section title="外观" icon={<PaletteRoundedIcon sx={{ fontSize: 14 }} />}>
            <Row
              label={isDark ? '深色模式' : '浅色模式'}
              desc="跟随系统或手动切换"
              control={
                <Switch
                  size="small"
                  checked={isDark}
                  onChange={(_, v) => setTheme(v ? 'dark' : 'light')}
                />
              }
              divider
            />
            <Box sx={{ py: 1.25 }}>
              <Typography sx={{ fontSize: 13, color: 'text.primary', mb: 1 }}>主题色</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {PRESET_COLORS.map((c) => {
                  const isActive = primaryColor.toLowerCase() === c.value.toLowerCase();
                  return (
                    <Box
                      key={c.key}
                      onClick={() => setPrimaryColor(c.value)}
                      title={c.label}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        px: 1,
                        py: 0.5,
                        borderRadius: 1.5,
                        cursor: 'pointer',
                        border: '1px solid',
                        borderColor: isActive ? c.value : 'divider',
                        bgcolor: isActive ? `${c.value}15` : 'transparent',
                        transition: 'all 0.15s',
                        '&:hover': { borderColor: c.value },
                      }}
                    >
                      <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: c.value, boxShadow: isActive ? `0 0 0 2px ${c.value}30` : 'none' }} />
                      <Typography sx={{ fontSize: 11, color: isActive ? 'text.primary' : 'text.secondary', fontWeight: isActive ? 600 : 400 }}>
                        {c.label}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Section>

          <Divider sx={{ my: 1.5 }} />

          {/* 通用 */}
          <Section title="通用" icon={<TuneRoundedIcon sx={{ fontSize: 14 }} />}>
            <Row
              label="界面密度"
              desc="紧凑模式可看更多内容"
              control={
                <ChipGroup
                  options={[
                    { value: 'comfortable' as const, label: '舒适' },
                    { value: 'compact' as const, label: '紧凑' },
                  ]}
                  value={settings.density}
                  onChange={(v) => update({ density: v })}
                />
              }
              divider
            />
            <Row
              label="语言"
              desc="界面显示语言"
              control={
                <ChipGroup
                  options={[
                    { value: 'zh-CN' as const, label: '简中' },
                    { value: 'zh-TW' as const, label: '繁中' },
                    { value: 'en' as const, label: 'EN' },
                  ]}
                  value={settings.language}
                  onChange={(v) => update({ language: v })}
                />
              }
              divider
            />
            <Row
              label="默认首页"
              desc="进入首页时默认打开哪个 tab"
              control={
                <ChipGroup
                  options={[
                    { value: 'home' as const, label: '精选' },
                    { value: 'recommend' as const, label: '推荐' },
                    { value: 'follow' as const, label: '关注' },
                    { value: 'friend' as const, label: '朋友' },
                    { value: 'live' as const, label: '直播' },
                  ]}
                  value={settings.defaultTab}
                  onChange={(v) => update({ defaultTab: v })}
                />
              }
              divider
            />
            <Row
              label="自动播放视频"
              desc="进入首页/详情时自动开始播放"
              control={<Switch size="small" checked={settings.autoplayVideo} onChange={(_, v) => update({ autoplayVideo: v })} />}
              divider
            />
            <Row
              label="默认开启声音"
              desc="仅在已开启自动播放时生效"
              control={<Switch size="small" checked={settings.autoplaySound} onChange={(_, v) => update({ autoplaySound: v })} disabled={!settings.autoplayVideo} />}
              divider
            />
            <Row
              label="显示观看人数"
              desc="直播间/视频卡片右下角的人数徽章"
              control={<Switch size="small" checked={settings.showViewerCount} onChange={(_, v) => update({ showViewerCount: v })} />}
              divider
            />
            <Row
              label="红点未读数"
              desc="侧栏 / 我的 / 客服上的小红点"
              control={<Switch size="small" checked={settings.badgeCount} onChange={(_, v) => update({ badgeCount: v })} />}
              divider
            />
            <Row
              label="减弱动效"
              desc="减少过渡和滚动动画,降低眩晕感"
              control={<Switch size="small" checked={settings.reduceMotion} onChange={(_, v) => update({ reduceMotion: v })} />}
              divider
            />
            <Row
              label="高对比度"
              desc="提升文字和边框对比度,弱视友好"
              control={<Switch size="small" checked={settings.highContrast} onChange={(_, v) => update({ highContrast: v })} />}
            />
          </Section>

          <Divider sx={{ my: 1.5 }} />

          {/* 通知 */}
          <Section title="消息通知" icon={<NotificationsActiveRoundedIcon sx={{ fontSize: 14 }} />}>
            <Row
              label="@ 提及我"
              desc="评论/弹幕中 @ 你时通知"
              control={<Switch size="small" checked={settings.notifMention} onChange={(_, v) => update({ notifMention: v })} />}
              divider
            />
            <Row
              label="新评论"
              desc="你的内容收到新评论时通知"
              control={<Switch size="small" checked={settings.notifComment} onChange={(_, v) => update({ notifComment: v })} />}
              divider
            />
            <Row
              label="新增粉丝"
              desc="有人关注你时通知"
              control={<Switch size="small" checked={settings.notifFollow} onChange={(_, v) => update({ notifFollow: v })} />}
              divider
            />
            <Row
              label="关注的主播开播"
              desc="关注的直播间开播时通知"
              control={<Switch size="small" checked={settings.notifLive} onChange={(_, v) => update({ notifLive: v })} />}
            />
          </Section>

          <Divider sx={{ my: 1.5 }} />

          {/* AI 设置 */}
          <Section title="AI 设置" icon={<AutoAwesomeRoundedIcon sx={{ fontSize: 14 }} />}>
            <Row
              label="AI 智能建议"
              desc="在搜索/浏览中显示 AI 推荐"
              control={<Switch size="small" checked={settings.aiSuggestions} onChange={(_, v) => update({ aiSuggestions: v })} />}
              divider
            />
            <Row
              label="保留 AI 历史"
              desc="关闭后 AI 对话记录会被清空"
              control={<Switch size="small" checked={settings.aiHistory} onChange={(_, v) => update({ aiHistory: v })} />}
              divider
            />
            <Row
              label="允许语音输入"
              desc="AI 搜索支持麦克风录入"
              control={<Switch size="small" checked={settings.aiVoiceInput} onChange={(_, v) => update({ aiVoiceInput: v })} />}
            />
          </Section>

          <Divider sx={{ my: 1.5 }} />

          {/* 快捷键 */}
          <Section title="键盘快捷键" icon={<KeyboardRoundedIcon sx={{ fontSize: 14 }} />}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 0.75, rowGap: 0.5, alignItems: 'center' }}>
              {SHORTCUTS.map((s) => (
                <React.Fragment key={s.keys}>
                  <Box
                    sx={{
                      px: 0.75,
                      py: 0.25,
                      borderRadius: 1,
                      bgcolor: 'rgba(255,255,255,0.06)',
                      border: '1px solid',
                      borderColor: 'divider',
                      fontSize: 10,
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      color: 'text.primary',
                      minWidth: 36,
                      textAlign: 'center',
                    }}
                  >
                    {s.keys}
                  </Box>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{s.desc}</Typography>
                </React.Fragment>
              ))}
            </Box>
          </Section>

          <Divider sx={{ my: 1.5 }} />

          {/* 帮助 */}
          <Section title="帮助与支持" icon={<HelpOutlineRoundedIcon sx={{ fontSize: 14 }} />}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 1.5 }}>
              {FAQ.map((f, i) => (
                <Box
                  key={i}
                  sx={{
                    p: 1.25,
                    borderRadius: 1.5,
                    bgcolor: 'rgba(255,255,255,0.02)',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
                    Q: {f.q}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.5 }}>
                    A: {f.a}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<HelpOutlineRoundedIcon sx={{ fontSize: 16 }} />}
                href="/account/settings"
                sx={{ justifyContent: 'flex-start', color: 'text.primary', borderColor: 'divider' }}
              >
                账号与隐私设置
              </Button>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<HeadsetMicRoundedIcon sx={{ fontSize: 16 }} />}
                href="/account/msg"
                sx={{ justifyContent: 'flex-start', color: 'text.primary', borderColor: 'divider' }}
              >
                联系我的客服
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
            偏好设置保存在本设备浏览器中
          </Typography>
        </Box>
      </Box>
    </Drawer>
  );
}

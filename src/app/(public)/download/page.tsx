'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import LaptopWindowsIcon from '@mui/icons-material/LaptopWindows';
import LaptopMacIcon from '@mui/icons-material/LaptopMac';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import AndroidIcon from '@mui/icons-material/Android';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HdIcon from '@mui/icons-material/Hd';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import SyncIcon from '@mui/icons-material/Sync';
import ForumIcon from '@mui/icons-material/Forum';
import PictureInPictureAltIcon from '@mui/icons-material/PictureInPictureAlt';
import HighQualityIcon from '@mui/icons-material/HighQuality';
import SpeedIcon from '@mui/icons-material/Speed';
import MovieFilterIcon from '@mui/icons-material/MovieFilter';
import SecurityIcon from '@mui/icons-material/Security';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  PLATFORMS,
  detectPlatform,
  triggerClientDownload,
  type ClientPlatform,
  type PlatformInfo,
} from '@/utils/download';
import { ACCENT } from '@/constants/accents';
import { CTA_GRADIENT, gradient2, gradient3 } from '@/constants/gradients';

const VERSION = '1.0.0';
const RELEASE_DATE = '2026-05-20';
const FILE_SIZE_MB: Record<ClientPlatform, number> = {
  windows: 86.4,
  macos: 92.1,
  ios: 64.8,
  android: 58.2,
};

const PLATFORM_ICONS: Record<ClientPlatform, React.ComponentType<{ sx?: any }>> = {
  windows: LaptopWindowsIcon,
  macos: LaptopMacIcon,
  ios: PhoneIphoneIcon,
  android: AndroidIcon,
};

const PLATFORM_DETAIL: Record<ClientPlatform, { arch: string; note: string }> = {
  windows: { arch: 'x64 · Win 10/11', note: '支持 Edge WebView2 渲染内核' },
  macos: { arch: 'Apple Silicon / Intel', note: 'Universal 二进制,免切换启动' },
  ios: { arch: 'iOS 15.0+', note: 'App Store 上架,TestFlight 内测同步' },
  android: { arch: 'Android 8.0+', note: 'arm64-v8a · 适配折叠屏与画中画' },
};

const FEATURES = [
  {
    Icon: MovieFilterIcon,
    title: '大屏影院',
    sub: '4K HDR · 杜比音效',
    desc: '桌面端原生窗口,21:9 影院模式,黑边智能识别。',
    accent: ACCENT.purple.main,
  },
  {
    Icon: CloudOffIcon,
    title: '离线缓存',
    sub: '整季 · 整本 · 整书',
    desc: 'Wi-Fi 下自动预下载,通勤/飞行模式无网追剧。',
    accent: ACCENT.blue.main,
  },
  {
    Icon: SyncIcon,
    title: '多端同步',
    sub: '进度 · 收藏 · 弹幕',
    desc: '手机看到一半,打开电脑接着播,记录实时同步。',
    accent: '#25F4EE',
  },
  {
    Icon: HighQualityIcon,
    title: '高清画质',
    sub: '4K · 码率自适应',
    desc: '客户端独占高码率通道,弱网环境优先保流畅。',
    accent: '#FFB400',
  },
  {
    Icon: ForumIcon,
    title: '弹幕互动',
    sub: '本地优先渲染',
    desc: '客户端弹幕引擎,十万级滚动不卡顿,可自定样式。',
    accent: ACCENT.orange.main,
  },
  {
    Icon: PictureInPictureAltIcon,
    title: '后台播放',
    sub: '画中画 · 锁屏控制',
    desc: '切换 App 不断播,锁屏封面 + 远程控制无缝衔接。',
    accent: ACCENT.red.main,
  },
  {
    Icon: SpeedIcon,
    title: '启动加速',
    sub: '秒开 · 冷启 < 1s',
    desc: '本地资源预加载 + 协议优化,二次启动进入桌面 1 秒内。',
    accent: '#5DDB96',
  },
  {
    Icon: SecurityIcon,
    title: '隐私安全',
    sub: '本地优先 · 端到端',
    desc: '下载/缓存数据本地加密,关键链路走国密 SM2/SM4。',
    accent: '#8B5CF6',
  },
];

const SCREENSHOTS = [
  { label: '首页推荐', gradient: gradient3('#FE2C55', '#8B5CF6', '#25F4EE', 55) },
  { label: '影院播放', gradient: gradient2('#0F172A', '#8B5CF6') },
  { label: '弹幕互动', gradient: gradient2('#FE2C55', '#FFB400') },
  { label: '离线管理', gradient: gradient2('#06B6D4', '#5DDB96') },
];

export default function DownloadPage() {
  const router = useRouter();
  const [detected, setDetected] = useState<ClientPlatform | 'unknown'>('unknown');
  const [downloading, setDownloading] = useState<ClientPlatform | null>(null);

  useEffect(() => {
    setDetected(detectPlatform());
  }, []);

  const detectedInfo: PlatformInfo | undefined = useMemo(() => {
    if (detected === 'unknown') return undefined;
    return PLATFORMS.find((p) => p.key === detected);
  }, [detected]);

  const handleDownload = (p: PlatformInfo) => {
    if (downloading) return;
    setDownloading(p.key);
    setTimeout(() => setDownloading(null), 1200);
    triggerClientDownload({
      platform: p.key,
      version: VERSION,
      sizeMb: FILE_SIZE_MB[p.key],
    });
  };

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/home/recommend');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        bgcolor: '#0a0a0f',
        color: 'rgba(255,255,255,0.92)',
        overflowX: 'hidden',
        position: 'relative',
      }}
    >
      {/* 顶部固定工具栏 */}
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          height: 60,
          px: { xs: 2, md: 4 },
          bgcolor: 'rgba(10, 10, 15, 0.7)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <IconButton
          onClick={handleBack}
          size="small"
          aria-label="返回"
          sx={{ color: 'rgba(255,255,255,0.75)' }}
        >
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
          下载客户端
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button
          component={Link}
          href="/home/recommend"
          size="small"
          sx={{
            textTransform: 'none',
            fontSize: 12,
            color: 'rgba(255,255,255,0.6)',
            '&:hover': { color: 'rgba(255,255,255,0.95)', bgcolor: 'rgba(255,255,255,0.06)' },
          }}
        >
          回到首页
        </Button>
      </Box>

      {/* Hero 区域 */}
      <Box
        sx={{
          position: 'relative',
          pt: { xs: 6, md: 10 },
          pb: { xs: 6, md: 10 },
          px: { xs: 2, md: 4 },
          overflow: 'hidden',
        }}
      >
        {/* 背景光晕 */}
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 60% 50% at 20% 10%, rgba(139, 92, 246, 0.22) 0%, transparent 60%), ' +
              'radial-gradient(ellipse 50% 40% at 80% 20%, rgba(37, 244, 238, 0.18) 0%, transparent 60%), ' +
              'radial-gradient(ellipse 70% 50% at 50% 90%, rgba(254, 44, 85, 0.18) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), ' +
              'linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, #000 0%, transparent 70%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, #000 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <Box
          sx={{
            position: 'relative',
            maxWidth: 1200,
            mx: 'auto',
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' },
            gap: { xs: 5, md: 6 },
            alignItems: 'center',
          }}
        >
          {/* 左侧文案 */}
          <Box>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: '#25F4EE',
                  boxShadow: '0 0 12px #25F4EE',
                  animation: 'dot-pulse 1.6s ease-in-out infinite',
                  '@keyframes dot-pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.4 },
                  },
                }}
              />
              <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', letterSpacing: 2, textTransform: 'uppercase' }}>
                QingQiuyue Client · v{VERSION}
              </Typography>
            </Box>

            <Typography
              component="h1"
              sx={{
                fontSize: { xs: 36, md: 56 },
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: -1,
                background: 'linear-gradient(135deg, #fff 0%, #C4B5FD 60%, #25F4EE 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                mb: 2,
              }}
            >
              装进口袋的<br />
              大屏影院
            </Typography>

            <Typography
              sx={{
                fontSize: { xs: 14, md: 16 },
                color: 'rgba(255,255,255,0.65)',
                lineHeight: 1.7,
                mb: 4,
                maxWidth: 540,
              }}
            >
              清秋月原生客户端,跨设备无缝接力,4K HDR + 杜比音效 + 离线缓存,让每一次观看都成为享受。
            </Typography>

            {/* 主 CTA 区 */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
              {detectedInfo ? (
                <Button
                  size="large"
                  onClick={() => handleDownload(detectedInfo)}
                  disabled={!!downloading}
                  startIcon={
                    <CloudDownloadIcon sx={{ fontSize: 22 }} />
                  }
                  sx={{
                    alignSelf: { xs: 'stretch', md: 'flex-start' },
                    background: CTA_GRADIENT.RED_YELLOW,
                    color: '#fff',
                    fontSize: 16,
                    fontWeight: 700,
                    textTransform: 'none',
                    px: 4,
                    py: 1.5,
                    borderRadius: 2.5,
                    boxShadow: '0 8px 24px rgba(254, 44, 85, 0.35)',
                    minWidth: 260,
                    '&:hover': {
                      background: CTA_GRADIENT.RED_YELLOW,
                      filter: 'brightness(1.1)',
                      transform: 'translateY(-1px)',
                    },
                    '&.Mui-disabled': {
                      background: CTA_GRADIENT.RED_YELLOW,
                      color: 'rgba(255,255,255,0.85)',
                      opacity: 0.7,
                    },
                    transition: 'transform 0.15s, filter 0.15s',
                  }}
                >
                  {downloading === detectedInfo.key
                    ? '正在准备…'
                    : `下载 ${detectedInfo.label} 客户端`}
                </Button>
              ) : (
                <Button
                  size="large"
                  onClick={() => {
                    const el = document.getElementById('platforms');
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  startIcon={<CloudDownloadIcon sx={{ fontSize: 22 }} />}
                  sx={{
                    alignSelf: { xs: 'stretch', md: 'flex-start' },
                    background: CTA_GRADIENT.RED_YELLOW,
                    color: '#fff',
                    fontSize: 16,
                    fontWeight: 700,
                    textTransform: 'none',
                    px: 4,
                    py: 1.5,
                    borderRadius: 2.5,
                    boxShadow: '0 8px 24px rgba(254, 44, 85, 0.35)',
                    minWidth: 260,
                    '&:hover': {
                      background: CTA_GRADIENT.RED_YELLOW,
                      filter: 'brightness(1.1)',
                    },
                  }}
                >
                  选择你的平台
                </Button>
              )}

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                {detectedInfo ? (
                  <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                    已自动识别你的设备 ·{' '}
                    <Box
                      component="span"
                      onClick={() => {
                        const el = document.getElementById('platforms');
                        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      sx={{ color: ACCENT.cyan.main, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      切换其他平台
                    </Box>
                  </Typography>
                ) : (
                  <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                    暂未识别到当前设备,请手动选择下方平台。
                  </Typography>
                )}
              </Box>
            </Box>

            {/* 信息 chips */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                size="small"
                label={`v${VERSION}`}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.85)',
                  fontSize: 11,
                  fontWeight: 600,
                  height: 24,
                  '& .MuiChip-label': { px: 1.25 },
                }}
              />
              <Chip
                size="small"
                label={`${RELEASE_DATE} 发布`}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.65)',
                  fontSize: 11,
                  fontWeight: 500,
                  height: 24,
                  '& .MuiChip-label': { px: 1.25 },
                }}
              />
              <Chip
                size="small"
                icon={<CheckCircleIcon sx={{ fontSize: 12, color: '#5DDB96 !important' }} />}
                label="已通过安全检测"
                sx={{
                  bgcolor: 'rgba(93, 219, 150, 0.12)',
                  color: '#5DDB96',
                  fontSize: 11,
                  fontWeight: 600,
                  height: 24,
                  border: '1px solid rgba(93, 219, 150, 0.3)',
                  '& .MuiChip-label': { px: 0.5 },
                }}
              />
            </Box>
          </Box>

          {/* 右侧设备 mockup 拼贴 */}
          <Box
            sx={{
              position: 'relative',
              display: { xs: 'none', md: 'block' },
              minHeight: 480,
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: 30,
                right: 20,
                width: 260,
                height: 340,
                borderRadius: 4,
                background: 'rgba(20, 22, 32, 0.6)',
                border: '1px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(20px)',
                overflow: 'hidden',
                boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
                transform: 'rotate(2deg)',
              }}
            >
              <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 36, bgcolor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', px: 1.5, gap: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#FF5F57' }} />
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#FFBD2E' }} />
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#28CA42' }} />
              </Box>
              <Box sx={{ position: 'absolute', top: 36, left: 0, right: 0, bottom: 0, background: SCREENSHOTS[0].gradient, display: 'flex', alignItems: 'flex-end', p: 2 }}>
                <Box>
                  <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', mb: 0.5, textTransform: 'uppercase', letterSpacing: 1 }}>
                    正在播放
                  </Typography>
                  <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
                    {SCREENSHOTS[0].label}
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Box
              sx={{
                position: 'absolute',
                top: 110,
                right: 240,
                width: 180,
                height: 360,
                borderRadius: 4,
                background: 'rgba(20, 22, 32, 0.7)',
                border: '1px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(20px)',
                overflow: 'hidden',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                transform: 'rotate(-4deg)',
              }}
            >
              <Box sx={{ position: 'absolute', inset: 0, background: SCREENSHOTS[1].gradient, display: 'flex', alignItems: 'flex-end', p: 1.5 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                  {SCREENSHOTS[1].label}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* 平台下载区 */}
      <Box id="platforms" sx={{ py: { xs: 6, md: 8 }, px: { xs: 2, md: 4 }, bgcolor: 'rgba(255,255,255,0.02)' }}>
        <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
          <Box sx={{ textAlign: 'center', mb: 5 }}>
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 700,
                color: ACCENT.cyan.main,
                letterSpacing: 3,
                textTransform: 'uppercase',
                mb: 1.5,
              }}
            >
              Platforms
            </Typography>
            <Typography
              component="h2"
              sx={{ fontSize: { xs: 28, md: 36 }, fontWeight: 800, color: '#fff', mb: 1.5, letterSpacing: -0.5 }}
            >
              全平台原生体验
            </Typography>
            <Typography sx={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', maxWidth: 560, mx: 'auto' }}>
              Windows / macOS / iOS / Android 同步发布,选择适合你的平台开始下载。
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
              gap: 2,
            }}
          >
            {PLATFORMS.map((p) => {
              const Icon = PLATFORM_ICONS[p.key];
              const detail = PLATFORM_DETAIL[p.key];
              const size = FILE_SIZE_MB[p.key].toFixed(1);
              const isBusy = downloading === p.key;
              const isDetected = detected === p.key;
              return (
                <Box
                  key={p.key}
                  sx={{
                    position: 'relative',
                    p: 2.5,
                    borderRadius: 3,
                    bgcolor: 'rgba(20, 22, 32, 0.6)',
                    border: '1px solid',
                    borderColor: isDetected ? ACCENT.cyan.border30 : 'rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(8px)',
                    transition: 'all 0.2s',
                    overflow: 'hidden',
                    '&:hover': {
                      borderColor: isDetected ? ACCENT.cyan.border30 : 'rgba(255,255,255,0.2)',
                      transform: 'translateY(-3px)',
                      boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
                    },
                  }}
                >
                  {isDetected && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        px: 0.75,
                        py: 0.25,
                        borderRadius: 1,
                        bgcolor: ACCENT.cyan.soft18,
                        border: `1px solid ${ACCENT.cyan.border30}`,
                        color: ACCENT.cyan.main,
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: 0.5,
                        textTransform: 'uppercase',
                      }}
                    >
                      Recommended
                    </Box>
                  )}

                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: 2,
                      bgcolor: 'rgba(255,255,255,0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      mb: 2,
                    }}
                  >
                    <Icon sx={{ fontSize: 28 }} />
                  </Box>

                  <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#fff', mb: 0.25 }}>
                    {p.label}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', mb: 1.5 }}>
                    {p.sub}
                  </Typography>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.3)' }} />
                      <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{detail.arch}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.3)' }} />
                      <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{size} MB · .{p.ext}</Typography>
                    </Box>
                  </Box>

                  <Typography
                    sx={{
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.45)',
                      lineHeight: 1.5,
                      mb: 2,
                      minHeight: 33,
                    }}
                  >
                    {detail.note}
                  </Typography>

                  <Button
                    fullWidth
                    variant={isDetected ? 'contained' : 'outlined'}
                    onClick={() => handleDownload(p)}
                    disabled={!!downloading}
                    startIcon={<CloudDownloadIcon sx={{ fontSize: 16 }} />}
                    sx={{
                      textTransform: 'none',
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 1.5,
                      py: 0.9,
                      ...(isDetected
                        ? {
                            background: CTA_GRADIENT.RED_YELLOW,
                            color: '#fff',
                            boxShadow: '0 4px 12px rgba(254, 44, 85, 0.3)',
                            '&:hover': { background: CTA_GRADIENT.RED_YELLOW, filter: 'brightness(1.1)' },
                          }
                        : {
                            borderColor: 'rgba(255,255,255,0.2)',
                            color: 'rgba(255,255,255,0.9)',
                            '&:hover': { borderColor: 'rgba(255,255,255,0.4)', bgcolor: 'rgba(255,255,255,0.04)' },
                          }),
                    }}
                  >
                    {isBusy ? '准备中…' : `下载 .${p.ext}`}
                  </Button>
                </Box>
              );
            })}
          </Box>

          <Typography
            sx={{
              mt: 3,
              fontSize: 11,
              color: 'rgba(255,255,255,0.35)',
              textAlign: 'center',
              lineHeight: 1.6,
            }}
          >
            提示:后端真实安装包 URL 尚未配置,目前下载为占位文本文件(可正常打开)。接入后将自动替换为真实 CDN 包。
          </Typography>
        </Box>
      </Box>

      {/* 特性区 */}
      <Box sx={{ py: { xs: 6, md: 8 }, px: { xs: 2, md: 4 } }}>
        <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
          <Box sx={{ textAlign: 'center', mb: 5 }}>
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 700,
                color: ACCENT.purple.main,
                letterSpacing: 3,
                textTransform: 'uppercase',
                mb: 1.5,
              }}
            >
              Features
            </Typography>
            <Typography
              component="h2"
              sx={{ fontSize: { xs: 28, md: 36 }, fontWeight: 800, color: '#fff', mb: 1.5, letterSpacing: -0.5 }}
            >
              不止能看 · 还能玩
            </Typography>
            <Typography sx={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', maxWidth: 560, mx: 'auto' }}>
              围绕「看 + 玩 + 创」三大场景打造,客户端独占 8 大核心能力。
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
              gap: 2,
            }}
          >
            {FEATURES.map((f) => {
              const Icon = f.Icon;
              return (
                <Box
                  key={f.title}
                  sx={{
                    p: 2.5,
                    borderRadius: 2.5,
                    bgcolor: 'rgba(20, 22, 32, 0.4)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: `${f.accent}55`,
                      bgcolor: 'rgba(20, 22, 32, 0.7)',
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 1.5,
                      bgcolor: `${f.accent}1A`,
                      border: `1px solid ${f.accent}33`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: f.accent,
                      mb: 1.5,
                    }}
                  >
                    <Icon sx={{ fontSize: 22 }} />
                  </Box>
                  <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#fff', mb: 0.25 }}>
                    {f.title}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: f.accent, fontWeight: 600, mb: 1, letterSpacing: 0.5 }}>
                    {f.sub}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
                    {f.desc}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>

      {/* 系统要求 */}
      <Box sx={{ py: { xs: 6, md: 8 }, px: { xs: 2, md: 4 }, bgcolor: 'rgba(255,255,255,0.02)' }}>
        <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
          <Box sx={{ textAlign: 'center', mb: 5 }}>
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 700,
                color: ACCENT.orange.main,
                letterSpacing: 3,
                textTransform: 'uppercase',
                mb: 1.5,
              }}
            >
              Requirements
            </Typography>
            <Typography
              component="h2"
              sx={{ fontSize: { xs: 28, md: 36 }, fontWeight: 800, color: '#fff', mb: 1.5, letterSpacing: -0.5 }}
            >
              系统要求
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
              gap: 2,
            }}
          >
            {PLATFORMS.map((p) => {
              const Icon = PLATFORM_ICONS[p.key];
              const reqs: Record<ClientPlatform, Array<{ k: string; v: string }>> = {
                windows: [
                  { k: '操作系统', v: 'Windows 10 1909+' },
                  { k: '处理器', v: 'Intel i5 / AMD 同级' },
                  { k: '内存', v: '8 GB RAM' },
                  { k: '存储', v: '4 GB 可用' },
                ],
                macos: [
                  { k: '操作系统', v: 'macOS 12 Monterey+' },
                  { k: '处理器', v: 'Apple M1 / Intel i5' },
                  { k: '内存', v: '8 GB RAM' },
                  { k: '存储', v: '4 GB 可用' },
                ],
                ios: [
                  { k: '操作系统', v: 'iOS 15.0+' },
                  { k: '设备', v: 'iPhone 8 / iPad (2018+)' },
                  { k: '内存', v: '2 GB+' },
                  { k: '存储', v: '约 200 MB' },
                ],
                android: [
                  { k: '操作系统', v: 'Android 8.0+' },
                  { k: '处理器', v: '骁龙 660 / 同级' },
                  { k: '内存', v: '3 GB+' },
                  { k: '存储', v: '约 150 MB' },
                ],
              };
              return (
                <Box
                  key={p.key}
                  sx={{
                    p: 2.5,
                    borderRadius: 2.5,
                    bgcolor: 'rgba(20, 22, 32, 0.6)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: 1.5,
                        bgcolor: 'rgba(255,255,255,0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                      }}
                    >
                      <Icon sx={{ fontSize: 18 }} />
                    </Box>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                      {p.label}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    {reqs[p.key].map((r) => (
                      <Box key={r.k} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                          {r.k}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: 500, textAlign: 'right' }}>
                          {r.v}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>

      {/* 底部 CTA */}
      <Box sx={{ py: { xs: 6, md: 10 }, px: { xs: 2, md: 4 } }}>
        <Box
          sx={{
            position: 'relative',
            maxWidth: 1100,
            mx: 'auto',
            p: { xs: 4, md: 6 },
            borderRadius: 4,
            overflow: 'hidden',
            textAlign: 'center',
            background: gradient3('#FE2C55', '#8B5CF6', '#25F4EE', 50),
          }}
        >
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2), transparent 50%)',
            }}
          />
          <Box sx={{ position: 'relative' }}>
            <Typography
              sx={{
                fontSize: { xs: 24, md: 32 },
                fontWeight: 800,
                color: '#fff',
                mb: 1.5,
                letterSpacing: -0.5,
                textShadow: '0 2px 12px rgba(0,0,0,0.3)',
              }}
            >
              现在就开始你的高清之旅
            </Typography>
            <Typography sx={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', mb: 3, maxWidth: 480, mx: 'auto' }}>
              安装客户端,登录账号即可同步所有收藏、记录与个性化设置。
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                size="large"
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                startIcon={<CloudDownloadIcon sx={{ fontSize: 18 }} />}
                sx={{
                  background: '#fff',
                  color: '#0a0a0f',
                  fontSize: 14,
                  fontWeight: 700,
                  textTransform: 'none',
                  px: 3.5,
                  py: 1.25,
                  borderRadius: 2,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  '&:hover': { background: '#fff', filter: 'brightness(0.95)' },
                }}
              >
                回到顶部下载
              </Button>
              <Button
                component={Link}
                href="/home/recommend"
                size="large"
                startIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
                sx={{
                  background: 'rgba(255,255,255,0.18)',
                  backdropFilter: 'blur(12px)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  textTransform: 'none',
                  px: 3.5,
                  py: 1.25,
                  borderRadius: 2,
                  border: '1px solid rgba(255,255,255,0.3)',
                  '&:hover': { background: 'rgba(255,255,255,0.25)' },
                }}
              >
                先看看网页版
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

      {/* 页脚 */}
      <Box sx={{ py: 4, px: { xs: 2, md: 4 }, textAlign: 'center' }}>
        <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
          © 2026 清秋月 · 安装包仅供个人学习与体验使用 · 商业合作请联系运营
        </Typography>
      </Box>
    </Box>
  );
}

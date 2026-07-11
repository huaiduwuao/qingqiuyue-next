'use client';

import React, { useState, useRef, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Divider from '@mui/material/Divider';
import LiveTvRoundedIcon from '@mui/icons-material/LiveTvRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import VideoFileRoundedIcon from '@mui/icons-material/VideoFileRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useActiveTab } from '../../ActiveTabContext';
import { useContentForm, normalizeTags, uploadOneFile } from '../../_components/useContentForm';
import { gradient2 } from '@/constants/gradients';

// 直播回放发布 (LIVE) — 真实表单。
//
// 跟 VIDEO 关键差异:
//   - 视频是直播录制(已经结束的直播),不是实时流
//   - 必填:直播开始时间(ISO datetime,用于 feed 显示「回放」)
//   - 选填:弹幕开关(回放是否显示实时弹幕)
//   - 选填:观看人数峰值(后台统计) / 礼物收入
//   - 标签通常包含「主播名」+ 「直播类型」+ 「平台/游戏」
//
// contentType: 'LIVE' 复用 VIDEO 视频上传,只额外加直播 metadata。
const MAX_TITLE = 40;
const MAX_TAGS = 10;

type CoverStatus = 'uploading' | 'uploaded' | 'failed';
type VideoStatus = 'idle' | 'uploading' | 'uploaded' | 'failed';

export default function LivePublishPage() {
  const { setActiveTab } = useActiveTab();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // 默认直播时间为现在
  const [liveStartedAt, setLiveStartedAt] = useState<string>(() => {
    const now = new Date();
    // datetime-local 需要 YYYY-MM-DDTHH:mm 格式(无时区)
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });
  const [peakViewers, setPeakViewers] = useState<number>(0);
  const [danmakuEnabled, setDanmakuEnabled] = useState(true);
  const [cover, setCover] = useState<{
    file: File;
    previewUrl: string;
    status: CoverStatus;
    uploadedUrl?: string;
  } | null>(null);
  const [video, setVideo] = useState<{
    file: File;
    status: VideoStatus;
    uploadedUrl?: string;
    sizeMB: number;
  } | null>(null);

  const f = useContentForm<any>({
    contentType: 'LIVE',
    maxTitle: MAX_TITLE,
    maxDesc: 200,
    maxTags: MAX_TAGS,
    requireTitle: true,
    requireDesc: false,
    onSuccess: () => {
      if (cover?.previewUrl) URL.revokeObjectURL(cover.previewUrl);
      setActiveTab('content');
    },
    validate: () => {
      if (!video) return '请先上传直播回放视频';
      if (video.status !== 'uploaded') return '视频上传未完成';
      if (!liveStartedAt) return '请选择直播开始时间';
      return null;
    },
    buildPayload: () => ({
      title: f.title.trim(),
      subtitle: f.desc.trim().slice(0, 200),
      content: f.desc.trim().slice(0, 200),
      contentType: 'LIVE',
      coverUrl: cover?.uploadedUrl,
      videoUrl: video?.uploadedUrl,
      videoSizeMB: video?.sizeMB,
      liveStartedAt: new Date(liveStartedAt).toISOString(),
      peakViewers: peakViewers || undefined,
      danmakuEnabled,
      status: 'reviewing',
      tags: normalizeTags(f.tags, MAX_TAGS),
    }),
  });

  // 封面
  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      f.setSnack({ msg: '封面必须是图片', severity: 'warning' });
      return;
    }
    if (cover?.previewUrl) URL.revokeObjectURL(cover.previewUrl);
    const previewUrl = URL.createObjectURL(file);
    setCover({ file, previewUrl, status: 'uploading' });
    const url = await uploadOneFile(file);
    if (url) {
      setCover((c) => (c ? { ...c, status: 'uploaded', uploadedUrl: url } : c));
      f.setSnack({ msg: '封面上传成功', severity: 'success' });
    } else {
      setCover((c) => (c ? { ...c, status: 'failed' } : c));
      f.setSnack({ msg: '封面上传失败,请重试', severity: 'error' });
    }
  };
  const removeCover = () => {
    if (cover?.previewUrl) URL.revokeObjectURL(cover.previewUrl);
    setCover(null);
  };

  // 视频
  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      f.setSnack({ msg: '回放必须是视频文件', severity: 'warning' });
      return;
    }
    const sizeMB = Number((file.size / 1024 / 1024).toFixed(1));
    setVideo({ file, status: 'uploading', sizeMB });
    const url = await uploadOneFile(file);
    if (url) {
      setVideo((v) => (v ? { ...v, status: 'uploaded', uploadedUrl: url } : v));
      f.setSnack({ msg: '回放上传成功', severity: 'success' });
    } else {
      setVideo((v) => (v ? { ...v, status: 'failed' } : v));
      f.setSnack({ msg: '视频上传失败,请重试', severity: 'error' });
    }
  };
  const removeVideo = () => setVideo(null);

  const canSubmitFinal = useMemo(
    () =>
      f.canSubmit &&
      video !== null &&
      video.status === 'uploaded' &&
      !!liveStartedAt,
    [f.canSubmit, video, liveStartedAt],
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <IconButton
          size="small"
          onClick={() => setActiveTab('content')}
          sx={{ border: '1px solid', borderColor: 'divider' }}
        >
          <ArrowBackRoundedIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 18, fontWeight: 700, color: 'text.primary' }}>
            发布直播回放
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>
            直播录制回放 · 必填直播时间 · 可选弹幕开关
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2.5,
        }}
      >
        {/* 左:标题 / 简介 / 直播时间 / 峰值人数 / 弹幕 / 标签 / 提交 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            value={f.title}
            onChange={(e) => f.setTitle(e.target.value)}
            placeholder="直播标题(通常用直播时的标题)"
            slotProps={{
              htmlInput: {
                maxLength: MAX_TITLE,
                style: { fontSize: 18, fontWeight: 600 },
              },
              formHelperText: { sx: { textAlign: 'right', fontSize: 10, m: 0, mt: 0.25 } },
            }}
            helperText={`${f.title.length} / ${MAX_TITLE}`}
          />

          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              简介
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              size="small"
              value={f.desc}
              onChange={(e) => f.setDesc(e.target.value)}
              placeholder="直播简介,200 字内..."
              slotProps={{
                htmlInput: { maxLength: 200 },
                formHelperText: { sx: { textAlign: 'right', fontSize: 10, m: 0, mt: 0.25 } },
              }}
              helperText={`${f.desc.length} / 200`}
            />
          </Box>

          {/* 直播开始时间 — datetime-local */}
          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              直播开始时间 <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
            <TextField
              fullWidth
              size="small"
              type="datetime-local"
              value={liveStartedAt}
              onChange={(e) => setLiveStartedAt(e.target.value)}
              helperText="feed 显示「回放」时用这个时间排序"
              slotProps={{
                formHelperText: { sx: { fontSize: 10, m: 0, mt: 0.25 } },
              }}
            />
          </Box>

          {/* 峰值观看人数 */}
          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              峰值同时在线(选填)
            </Typography>
            <TextField
              fullWidth
              size="small"
              type="number"
              value={peakViewers}
              onChange={(e) => setPeakViewers(Math.max(0, Number(e.target.value) || 0))}
              helperText="直播期间后台统计,展示给用户看直播热度"
              slotProps={{
                htmlInput: { min: 0 },
                formHelperText: { sx: { fontSize: 10, m: 0, mt: 0.25 } },
              }}
            />
          </Box>

          {/* 弹幕开关 */}
          <FormControlLabel
            control={
              <Switch
                checked={danmakuEnabled}
                onChange={(e) => setDanmakuEnabled(e.target.checked)}
                size="small"
              />
            }
            label={
              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 600 }}>
                  允许弹幕
                </Typography>
                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                  关闭后回放只显示视频 + 文字
                </Typography>
              </Box>
            }
            sx={{ alignSelf: 'flex-start' }}
          />

          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              标签
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={f.tags}
              onChange={(e) => f.setTags(e.target.value)}
              placeholder="主播, 类型, 游戏/平台..."
              helperText="例如:游戏, 英雄联盟, 主播名"
              slotProps={{
                formHelperText: { sx: { fontSize: 10, m: 0, mt: 0.25 } },
              }}
            />
          </Box>

          <Divider />

          <Box
            sx={{
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: gradient2('#EF4444', '#F87171'),
              color: '#FFFFFF',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <LiveTvRoundedIcon sx={{ fontSize: 16 }} />
              <Typography sx={{ fontSize: 12, fontWeight: 700 }}>发布须知</Typography>
            </Box>
            <Typography sx={{ fontSize: 11, lineHeight: 1.7, opacity: 0.9 }}>
              直播视频必填,直播开始时间必填,峰值人数 / 弹幕开关选填。
              弹幕开关控制回放时是否显示实时弹幕(平台审核过的)。
            </Typography>
          </Box>

          <Button
            variant="contained"
            size="large"
            onClick={() => f.submit()}
            disabled={!canSubmitFinal}
            sx={{
              textTransform: 'none',
              fontSize: 14,
              fontWeight: 700,
              py: 1.25,
              background: 'linear-gradient(90deg, #DC2626 0%, #FE2C55 100%)',
              '&:hover': { filter: 'brightness(1.08)' },
              '&.Mui-disabled': {
                background: 'action.disabledBackground',
                color: 'text.disabled',
              },
            }}
          >
            {f.isPending
              ? '提交中...'
              : video?.status === 'uploading'
                ? '回放上传中...'
                : `提交直播回放${peakViewers ? ` (峰值 ${peakViewers})` : ''}`}
          </Button>
        </Box>

        {/* 右:封面 + 视频文件 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* 封面 — 16:9 横版(直播封面跟视频一致) */}
          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              封面(选填,推荐 16:9 横版)
            </Typography>
            {cover ? (
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: 280,
                  aspectRatio: '16 / 9',
                  borderRadius: 1.5,
                  overflow: 'hidden',
                  bgcolor: 'action.hover',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <img
                  src={cover.previewUrl}
                  alt={cover.file.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {cover.status === 'uploading' && (
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      bgcolor: 'rgba(0,0,0,0.45)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <LinearProgress sx={{ width: '70%' }} />
                  </Box>
                )}
                {cover.status === 'failed' && (
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      bgcolor: 'rgba(254, 44, 85, 0.85)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 700,
                    }}
                  >
                    失败
                  </Box>
                )}
                <IconButton
                  size="small"
                  onClick={removeCover}
                  aria-label="删除封面"
                  sx={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    bgcolor: 'rgba(15, 23, 42, 0.6)',
                    color: '#fff',
                    p: 0.25,
                    '&:hover': { bgcolor: 'rgba(15, 23, 42, 0.85)' },
                  }}
                >
                  <CloseRoundedIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
            ) : (
              <Box
                onClick={() => coverInputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="上传封面"
                sx={{
                  width: '100%',
                  maxWidth: 280,
                  aspectRatio: '16 / 9',
                  borderRadius: 1.5,
                  border: '1.5px dashed',
                  borderColor: 'divider',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5,
                  cursor: 'pointer',
                  bgcolor: 'background.default',
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                }}
              >
                <CloudUploadRoundedIcon sx={{ fontSize: 28, color: 'text.secondary' }} />
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  点击选择封面图
                </Typography>
              </Box>
            )}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverChange}
              style={{ display: 'none' }}
            />
          </Box>

          {/* 视频文件 — 必填 */}
          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              直播回放视频 <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
            {video ? (
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1.5,
                  bgcolor: video.status === 'failed' ? 'rgba(254, 44, 85, 0.08)' : 'action.hover',
                  border: '1px solid',
                  borderColor: video.status === 'failed' ? 'error.main' : 'divider',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                  <VideoFileRoundedIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontSize: 13,
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {video.file.name}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                      {video.sizeMB} MB ·{' '}
                      {video.status === 'uploading'
                        ? '上传中...'
                        : video.status === 'uploaded'
                          ? '已上传'
                          : '失败'}
                    </Typography>
                  </Box>
                </Box>
                {video.status === 'uploading' && (
                  <LinearProgress sx={{ mb: 1, borderRadius: 1 }} />
                )}
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    onClick={() => videoInputRef.current?.click()}
                    sx={{ textTransform: 'none', fontSize: 11 }}
                  >
                    替换
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    onClick={removeVideo}
                    sx={{ textTransform: 'none', fontSize: 11 }}
                  >
                    删除
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box
                onClick={() => videoInputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="上传直播回放"
                sx={{
                  p: 4,
                  borderRadius: 1.5,
                  border: '1.5px dashed',
                  borderColor: 'divider',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  cursor: 'pointer',
                  bgcolor: 'background.default',
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                }}
              >
                <VideoFileRoundedIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                  点击选择回放视频
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  直播系统导出的 mp4 / mov / flv
                </Typography>
              </Box>
            )}
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              onChange={handleVideoChange}
              style={{ display: 'none' }}
            />
          </Box>
        </Box>
      </Box>

      {f.renderSnackbar()}
    </Box>
  );
}

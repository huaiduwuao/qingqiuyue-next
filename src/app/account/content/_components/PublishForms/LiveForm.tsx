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
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import VideoFileRoundedIcon from '@mui/icons-material/VideoFileRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useContentForm, normalizeTags, uploadOneFile } from '../useContentForm';
import { gradient2 } from '@/constants/gradients';
import type { PublishFormProps } from './types';

// 直播回放发布 (LIVE) — 真实表单。
//
// 跟 VIDEO 关键差异:
//   - 视频是直播录制(已经结束的直播),不是实时流
//   - 必填:直播开始时间(ISO datetime,用于 feed 显示「回放」)
//   - 选填:弹幕开关、观看人数峰值
const MAX_TITLE = 40;
const MAX_TAGS = 10;

type CoverStatus = 'uploading' | 'uploaded' | 'failed';
type VideoStatus = 'idle' | 'uploading' | 'uploaded' | 'failed';

export default function LiveForm({ onSuccess }: PublishFormProps) {
  const coverInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [liveStartedAt, setLiveStartedAt] = useState<string>(() => {
    const now = new Date();
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
      onSuccess?.();
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

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      f.setSnack({ msg: '必须是视频文件', severity: 'warning' });
      return;
    }
    const sizeMB = Number((file.size / 1024 / 1024).toFixed(1));
    setVideo({ file, status: 'uploading', sizeMB });
    const url = await uploadOneFile(file);
    if (url) {
      setVideo((v) => (v ? { ...v, status: 'uploaded', uploadedUrl: url } : v));
      f.setSnack({ msg: '视频上传成功', severity: 'success' });
    } else {
      setVideo((v) => (v ? { ...v, status: 'failed' } : v));
      f.setSnack({ msg: '视频上传失败,请重试', severity: 'error' });
    }
  };
  const removeVideo = () => setVideo(null);

  const canSubmitFinal = useMemo(
    () => f.canSubmit && video !== null && video.status === 'uploaded' && !!liveStartedAt,
    [f.canSubmit, video, liveStartedAt],
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2.5,
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            value={f.title}
            onChange={(e) => f.setTitle(e.target.value)}
            placeholder="直播主题"
            slotProps={{
              htmlInput: { maxLength: MAX_TITLE, style: { fontSize: 18, fontWeight: 600 } },
              formHelperText: { sx: { textAlign: 'right', fontSize: 10, m: 0, mt: 0.25 } },
            }}
            helperText={`${f.title.length} / ${MAX_TITLE}`}
          />
          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>简介</Typography>
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
          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              直播开始时间 <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
            <TextField
              size="small"
              type="datetime-local"
              fullWidth
              value={liveStartedAt}
              onChange={(e) => setLiveStartedAt(e.target.value)}
              slotProps={{
                inputLabel: { shrink: true },
              }}
            />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              峰值观看人数(选填)
            </Typography>
            <TextField
              size="small"
              type="number"
              value={peakViewers}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isNaN(v) && v >= 0) setPeakViewers(v);
              }}
              slotProps={{ htmlInput: { min: 0 } }}
              sx={{ width: 130 }}
            />
          </Box>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={danmakuEnabled}
                onChange={(e) => setDanmakuEnabled(e.target.checked)}
              />
            }
            label={
              <Box>
                <Typography sx={{ fontSize: 12, color: 'text.primary' }}>启用弹幕</Typography>
                <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                  回放是否显示实时弹幕
                </Typography>
              </Box>
            }
          />
          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>标签</Typography>
            <TextField
              fullWidth
              size="small"
              value={f.tags}
              onChange={(e) => f.setTags(e.target.value)}
              placeholder="最多 10 个,逗号或空格分隔"
              helperText="例如:游戏, 直播, 王者荣耀"
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
              bgcolor: gradient2('#DC2626', '#EF4444'),
              color: '#FFFFFF',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <LiveTvRoundedIcon sx={{ fontSize: 16 }} />
              <Typography sx={{ fontSize: 12, fontWeight: 700 }}>发布须知</Typography>
            </Box>
            <Typography sx={{ fontSize: 11, lineHeight: 1.7, opacity: 0.95 }}>
              「直播回放」是已结束的直播录像,不能直接接入 RTMP。
              <br />
              视频必须先用 OBS / 直播平台自带录制,然后上传到这里。
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
            {f.isPending ? '发布中…' : '发布'}
          </Button>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* 封面 16:9 */}
          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              封面(推荐 16:9)
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
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>点击选择封面</Typography>
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

          {/* 视频 */}
          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              录制文件 <Box component="span" sx={{ color: 'error.main' }}>*</Box>
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
                      {(video.sizeMB / 1024).toFixed(2)} GB ·{' '}
                      <Box
                        component="span"
                        sx={{
                          color:
                            video.status === 'uploaded'
                              ? 'success.main'
                              : video.status === 'failed'
                                ? 'error.main'
                                : 'warning.main',
                          fontWeight: 600,
                        }}
                      >
                        {video.status === 'uploading'
                          ? '上传中…'
                          : video.status === 'uploaded'
                            ? '已上传'
                            : '失败'}
                      </Box>
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
                  <Button size="small" color="error" onClick={removeVideo} sx={{ textTransform: 'none', fontSize: 11 }}>
                    删除
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box
                onClick={() => videoInputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="上传录制"
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
                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>点击选择录制文件</Typography>
                <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
                  MP4 / FLV / MKV · 最大 10GB
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

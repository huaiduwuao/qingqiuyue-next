'use client';

import React, { useState, useRef, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Divider from '@mui/material/Divider';
import LocalMoviesRoundedIcon from '@mui/icons-material/LocalMoviesRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import VideoFileRoundedIcon from '@mui/icons-material/VideoFileRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useActiveTab } from '../../ActiveTabContext';
import { useContentForm, normalizeTags, uploadOneFile } from '../../_components/useContentForm';
import { gradient2 } from '@/constants/gradients';

// 电影发布 (FILM) — 真实表单。
//
// 跟 VIDEO 关键差异:
//   - 单条长视频(60-180 分钟),不是多集
//   - 海报比例 2:3(电影行业标准,比 video 16:9 更高瘦)
//   - 多了导演 / 主演 / 时长 三个电影行业字段
//   - 简介更长(500 字)
//   - 标签通常包含"导演名" + "演员名" + "电影类型"
// 后续:支持 IMDB / 豆瓣 ID 引用 + 剧照多图
const MAX_TITLE = 40;
const MAX_DIRECTOR = 30;
const MAX_CAST = 100; // "梁朝伟, 刘德华, 张曼玉" 这类
const MAX_DESC = 500;
const MAX_DURATION_MIN = 240; // 4 小时
const MIN_DURATION_MIN = 40; // 40 分钟,电影行业标准
const MAX_TAGS = 10;

type CoverStatus = 'uploading' | 'uploaded' | 'failed';
type VideoStatus = 'idle' | 'uploading' | 'uploaded' | 'failed';

export default function FilmPublishPage() {
  const { setActiveTab } = useActiveTab();
  const posterInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [director, setDirector] = useState('');
  const [cast, setCast] = useState('');
  const [durationMin, setDurationMin] = useState(90);
  const [poster, setPoster] = useState<{
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
    contentType: 'FILM',
    maxTitle: MAX_TITLE,
    maxDesc: MAX_DESC,
    maxTags: MAX_TAGS,
    requireTitle: true,
    requireDesc: true, // 电影简介必填
    onSuccess: () => {
      if (poster?.previewUrl) URL.revokeObjectURL(poster.previewUrl);
      setActiveTab('content');
    },
    validate: () => {
      if (!video) return '请先上传电影视频';
      if (video.status !== 'uploaded') return '视频上传未完成';
      if (durationMin < MIN_DURATION_MIN)
        return `电影时长不能少于 ${MIN_DURATION_MIN} 分钟`;
      if (durationMin > MAX_DURATION_MIN)
        return `电影时长不能超过 ${MAX_DURATION_MIN} 分钟`;
      return null;
    },
    buildPayload: () => ({
      title: f.title.trim(),
      subtitle: f.desc.trim().slice(0, 200),
      content: f.desc.trim().slice(0, MAX_DESC),
      contentType: 'FILM',
      coverUrl: poster?.uploadedUrl,
      videoUrl: video?.uploadedUrl,
      videoSizeMB: video?.sizeMB,
      director: director.trim() || undefined,
      cast: cast
        .split(/[,，\s]+/)
        .filter(Boolean)
        .slice(0, 10)
        .join(','),
      durationMin,
      status: 'reviewing',
      tags: normalizeTags(f.tags, MAX_TAGS),
    }),
  });

  // 海报
  const handlePosterChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      f.setSnack({ msg: '海报必须是图片', severity: 'warning' });
      return;
    }
    if (poster?.previewUrl) URL.revokeObjectURL(poster.previewUrl);
    const previewUrl = URL.createObjectURL(file);
    setPoster({ file, previewUrl, status: 'uploading' });
    const url = await uploadOneFile(file);
    if (url) {
      setPoster((p) => (p ? { ...p, status: 'uploaded', uploadedUrl: url } : p));
      f.setSnack({ msg: '海报上传成功', severity: 'success' });
    } else {
      setPoster((p) => (p ? { ...p, status: 'failed' } : p));
      f.setSnack({ msg: '海报上传失败,请重试', severity: 'error' });
    }
  };
  const removePoster = () => {
    if (poster?.previewUrl) URL.revokeObjectURL(poster.previewUrl);
    setPoster(null);
  };

  // 视频
  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      f.setSnack({ msg: '电影必须是视频文件', severity: 'warning' });
      return;
    }
    const sizeMB = Number((file.size / 1024 / 1024).toFixed(1));
    if (sizeMB > 10 * 1024) {
      f.setSnack({ msg: '电影超出 10GB,需要分段上传(后续功能)', severity: 'warning' });
    }
    setVideo({ file, status: 'uploading', sizeMB });
    const url = await uploadOneFile(file);
    if (url) {
      setVideo((v) => (v ? { ...v, status: 'uploaded', uploadedUrl: url } : v));
      f.setSnack({ msg: '电影上传成功', severity: 'success' });
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
      durationMin >= MIN_DURATION_MIN &&
      durationMin <= MAX_DURATION_MIN,
    [f.canSubmit, video, durationMin],
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
            发布电影
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>
            长视频电影 · 时长 {MIN_DURATION_MIN}-{MAX_DURATION_MIN} 分钟 · 2:3 海报(电影行业标准)
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
        {/* 左:标题 / 简介 / 导演 / 主演 / 时长 / 标签 / 提交 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            value={f.title}
            onChange={(e) => f.setTitle(e.target.value)}
            placeholder="电影名称"
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
              简介 <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              size="small"
              value={f.desc}
              onChange={(e) => f.setDesc(e.target.value)}
              placeholder="剧情简介,500 字内..."
              slotProps={{
                htmlInput: { maxLength: MAX_DESC },
                formHelperText: { sx: { textAlign: 'right', fontSize: 10, m: 0, mt: 0.25 } },
              }}
              helperText={`${f.desc.length} / ${MAX_DESC}`}
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              导演
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={director}
              onChange={(e) => setDirector(e.target.value.slice(0, MAX_DIRECTOR))}
              placeholder="导演姓名"
              slotProps={{
                htmlInput: { maxLength: MAX_DIRECTOR },
                formHelperText: { sx: { textAlign: 'right', fontSize: 10, m: 0, mt: 0.25 } },
              }}
              helperText={`${director.length} / ${MAX_DIRECTOR}`}
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              主演(逗号分隔,最多 10 个)
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={cast}
              onChange={(e) => setCast(e.target.value.slice(0, MAX_CAST))}
              placeholder="梁朝伟, 刘德华, 张曼玉"
              slotProps={{
                htmlInput: { maxLength: MAX_CAST },
                formHelperText: { sx: { textAlign: 'right', fontSize: 10, m: 0, mt: 0.25 } },
              }}
              helperText={`${cast.length} / ${MAX_CAST}`}
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              时长(分钟)
            </Typography>
            <TextField
              fullWidth
              size="small"
              type="number"
              value={durationMin}
              onChange={(e) => {
                const v = Math.max(1, Math.min(MAX_DURATION_MIN, Number(e.target.value) || 1));
                setDurationMin(v);
              }}
              helperText={`${MIN_DURATION_MIN}-${MAX_DURATION_MIN} 分钟(电影行业标准)`}
              slotProps={{
                htmlInput: { min: MIN_DURATION_MIN, max: MAX_DURATION_MIN },
                formHelperText: { sx: { fontSize: 10, m: 0, mt: 0.25 } },
              }}
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              标签
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={f.tags}
              onChange={(e) => f.setTags(e.target.value)}
              placeholder="类型, 演员, 导演..."
              helperText="例如:剧情, 王家卫, 梁朝伟"
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
              bgcolor: gradient2('#3B82F6', '#60A5FA'),
              color: '#FFFFFF',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <LocalMoviesRoundedIcon sx={{ fontSize: 16 }} />
              <Typography sx={{ fontSize: 12, fontWeight: 700 }}>发布须知</Typography>
            </Box>
            <Typography sx={{ fontSize: 11, lineHeight: 1.7, opacity: 0.9 }}>
              电影视频必填,海报 / 导演 / 主演 / 时长 / 简介必填。
              电影时长最少 40 分钟,最多 4 小时,后续要做分段上传(超大文件)。
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
              background: 'linear-gradient(90deg, #1E40AF 0%, #FE2C55 100%)',
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
                ? '电影上传中...'
                : `提交电影 (${durationMin} 分钟)`}
          </Button>
        </Box>

        {/* 右:海报 + 视频文件 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* 海报 — 2:3 竖版 */}
          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              海报(选填,推荐 2:3 竖版)
            </Typography>
            {poster ? (
              <Box
                sx={{
                  position: 'relative',
                  width: 160,
                  aspectRatio: '2 / 3',
                  borderRadius: 1.5,
                  overflow: 'hidden',
                  bgcolor: 'action.hover',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <img
                  src={poster.previewUrl}
                  alt={poster.file.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {poster.status === 'uploading' && (
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
                {poster.status === 'failed' && (
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      bgcolor: 'rgba(254, 44, 85, 0.85)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    失败
                  </Box>
                )}
                <IconButton
                  size="small"
                  onClick={removePoster}
                  aria-label="删除海报"
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
                onClick={() => posterInputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="上传海报"
                sx={{
                  width: 160,
                  aspectRatio: '2 / 3',
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
                <CloudUploadRoundedIcon sx={{ fontSize: 24, color: 'text.secondary' }} />
                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                  2:3 海报
                </Typography>
              </Box>
            )}
            <input
              ref={posterInputRef}
              type="file"
              accept="image/*"
              onChange={handlePosterChange}
              style={{ display: 'none' }}
            />
          </Box>

          {/* 视频文件 — 必填 */}
          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              电影视频 <Box component="span" sx={{ color: 'error.main' }}>*</Box>
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
                      {video.sizeMB} MB · 约 {Math.round(video.sizeMB / 60)} 分钟(按 ~1MB/分钟估算)
                      {' · '}
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
                aria-label="上传电影视频"
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
                  点击选择电影视频
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  mp4 / mov / mkv · 时长 {MIN_DURATION_MIN}-{MAX_DURATION_MIN} 分钟
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

'use client';

import React, { useState, useRef, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import LinearProgress from '@mui/material/LinearProgress';
import Divider from '@mui/material/Divider';
import AnimationRoundedIcon from '@mui/icons-material/AnimationRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import VideoFileRoundedIcon from '@mui/icons-material/VideoFileRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useContentForm, normalizeTags, uploadOneFile } from '../useContentForm';
import { gradient2 } from '@/constants/gradients';
import type { PublishFormProps } from './types';

// 动画发布 (ANIMATION) — 真实表单。
//
// 跟 VSHOW 几乎同样的选集结构(1-N 集, 每集独立视频)。
// 关键差异:加「动画类型」字段(2D / 3D / 定格 / 其他);加「制作公司 / 监督」字段。
const MAX_TITLE = 40;
const MAX_EPISODE_TITLE = 30;
const MAX_EPISODES = 50;
const MAX_STUDIO = 30;
const MAX_DIRECTOR = 30;
const MAX_TAGS = 8;

type AnimationType = '2D' | '3D' | 'stopmotion' | 'other';
type EpisodeStatus = 'idle' | 'uploading' | 'uploaded' | 'failed';
interface Episode {
  id: string;
  title: string;
  file: File | null;
  uploadedUrl?: string;
  status: EpisodeStatus;
  sizeMB: number;
}

const ANIMATION_TYPE_LABEL: Record<AnimationType, string> = {
  '2D': '2D 动画',
  '3D': '3D 动画',
  stopmotion: '定格动画',
  other: '其他',
};

export default function AnimationForm({ onSuccess }: PublishFormProps) {
  const coverInputRef = useRef<HTMLInputElement>(null);
  const episodeInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [cover, setCover] = useState<{
    file: File;
    previewUrl: string;
    status: 'uploading' | 'uploaded' | 'failed';
    uploadedUrl?: string;
  } | null>(null);
  const [animationType, setAnimationType] = useState<AnimationType>('2D');
  const [studio, setStudio] = useState('');
  const [director, setDirector] = useState('');
  const [episodes, setEpisodes] = useState<Episode[]>(() => [
    { id: `ep-${Date.now()}`, title: '第 1 话', file: null, status: 'idle', sizeMB: 0 },
  ]);

  const f = useContentForm<any>({
    contentType: 'ANIMATION',
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
      if (episodes.length === 0) return '至少需要 1 话';
      if (episodes.some((e) => !e.uploadedUrl)) return '请先上传所有话的视频';
      if (episodes.some((e) => e.status === 'failed')) return '有话上传失败,请删除后重新上传';
      return null;
    },
    buildPayload: () => ({
      title: f.title.trim(),
      subtitle: f.desc.trim().slice(0, 200),
      content: JSON.stringify({
        animationType,
        studio: studio.trim() || undefined,
        director: director.trim() || undefined,
        episodes: episodes.map((e, i) => ({
          index: i + 1,
          title: e.title,
          videoUrl: e.uploadedUrl,
          sizeMB: e.sizeMB,
        })),
      }),
      contentType: 'ANIMATION',
      coverUrl: cover?.uploadedUrl,
      status: 'reviewing',
      tags: normalizeTags(f.tags, MAX_TAGS),
      episodeCount: episodes.length,
      animationType,
      studio: studio.trim() || undefined,
      director: director.trim() || undefined,
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

  const addEpisode = () => {
    if (episodes.length >= MAX_EPISODES) {
      f.setSnack({ msg: `最多 ${MAX_EPISODES} 话`, severity: 'warning' });
      return;
    }
    setEpisodes((prev) => [
      ...prev,
      {
        id: `ep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: `第 ${prev.length + 1} 话`,
        file: null,
        status: 'idle',
        sizeMB: 0,
      },
    ]);
  };
  const removeEpisode = (id: string) => {
    setEpisodes((prev) => prev.filter((e) => e.id !== id));
  };
  const updateEpisodeTitle = (id: string, title: string) => {
    setEpisodes((prev) =>
      prev.map((e) => (e.id === id ? { ...e, title: title.slice(0, MAX_EPISODE_TITLE) } : e)),
    );
  };

  const handleEpisodeFile = async (epId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      f.setSnack({ msg: '话必须是视频文件', severity: 'warning' });
      return;
    }
    const sizeMB = Number((file.size / 1024 / 1024).toFixed(1));
    setEpisodes((prev) =>
      prev.map((ep) =>
        ep.id === epId ? { ...ep, file, status: 'uploading', sizeMB } : ep,
      ),
    );
    const url = await uploadOneFile(file);
    if (url) {
      setEpisodes((prev) =>
        prev.map((ep) =>
          ep.id === epId ? { ...ep, status: 'uploaded', uploadedUrl: url } : ep,
        ),
      );
    } else {
      setEpisodes((prev) =>
        prev.map((ep) => (ep.id === epId ? { ...ep, status: 'failed' } : ep)),
      );
      f.setSnack({ msg: `${file.name} 上传失败`, severity: 'error' });
    }
  };

  const canSubmitFinal = useMemo(
    () =>
      f.canSubmit &&
      episodes.length > 0 &&
      episodes.every((e) => e.status === 'uploaded' && e.uploadedUrl),
    [f.canSubmit, episodes],
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
            placeholder="动画名"
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
              placeholder="剧情梗概,200 字内..."
              slotProps={{
                htmlInput: { maxLength: 200 },
                formHelperText: { sx: { textAlign: 'right', fontSize: 10, m: 0, mt: 0.25 } },
              }}
              helperText={`${f.desc.length} / 200`}
            />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>
              动画类型
            </Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={animationType}
              onChange={(_, v) => v && setAnimationType(v)}
              sx={{
                '& .MuiToggleButton-root': {
                  px: 1.25,
                  fontSize: 12,
                  textTransform: 'none',
                  borderColor: 'divider',
                },
              }}
            >
              {(['2D', '3D', 'stopmotion', 'other'] as AnimationType[]).map((t) => (
                <ToggleButton key={t} value={t}>
                  {ANIMATION_TYPE_LABEL[t]}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              制作公司(选填)
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={studio}
              onChange={(e) => setStudio(e.target.value.slice(0, MAX_STUDIO))}
              placeholder="例如:BONES / MAPPA / 京都动画"
              slotProps={{
                htmlInput: { maxLength: MAX_STUDIO },
                formHelperText: { sx: { textAlign: 'right', fontSize: 10, m: 0, mt: 0.25 } },
              }}
              helperText={`${studio.length} / ${MAX_STUDIO}`}
            />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              监督 / 导演(选填)
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={director}
              onChange={(e) => setDirector(e.target.value.slice(0, MAX_DIRECTOR))}
              placeholder="导演 / 监督名字"
              slotProps={{
                htmlInput: { maxLength: MAX_DIRECTOR },
                formHelperText: { sx: { textAlign: 'right', fontSize: 10, m: 0, mt: 0.25 } },
              }}
              helperText={`${director.length} / ${MAX_DIRECTOR}`}
            />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              封面(推荐 3:2 横版)
            </Typography>
            {cover ? (
              <Box
                sx={{
                  position: 'relative',
                  width: 160,
                  aspectRatio: '3 / 2',
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
                  width: 160,
                  aspectRatio: '3 / 2',
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
                <CloudUploadRoundedIcon sx={{ fontSize: 22, color: 'text.secondary' }} />
                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>3:2 封面</Typography>
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
          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>标签</Typography>
            <TextField
              fullWidth
              size="small"
              value={f.tags}
              onChange={(e) => f.setTags(e.target.value)}
              placeholder="逗号或空格分隔,最多 8 个"
              helperText="例如:热血, 校园, 治愈"
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
              bgcolor: gradient2('#A855F7', '#C084FC'),
              color: '#FFFFFF',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <AnimationRoundedIcon sx={{ fontSize: 16 }} />
              <Typography sx={{ fontSize: 12, fontWeight: 700 }}>发布须知</Typography>
            </Box>
            <Typography sx={{ fontSize: 11, lineHeight: 1.7, opacity: 0.9 }}>
              「动画类型」「制作公司」「监督」是动画行业必填字段 — 帮
              助观众快速筛选。第一版只支持单季,后续扩展多季。
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
              background: 'linear-gradient(90deg, #A855F7 0%, #FE2C55 100%)',
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

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'text.primary' }}>
              选集列表
              <Box component="span" sx={{ ml: 1, fontSize: 11, color: 'text.secondary' }}>
                {episodes.length} / {MAX_EPISODES}
              </Box>
            </Typography>
            <Button
              size="small"
              startIcon={<AddRoundedIcon />}
              onClick={addEpisode}
              disabled={episodes.length >= MAX_EPISODES}
              sx={{ textTransform: 'none', fontSize: 12 }}
            >
              添加一话
            </Button>
          </Box>

          {episodes.map((ep, idx) => (
            <Box
              key={ep.id}
              sx={{
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: ep.status === 'failed' ? 'error.main' : 'divider',
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: 1,
                    bgcolor: '#A855F7',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {idx + 1}
                </Box>
                <TextField
                  fullWidth
                  size="small"
                  value={ep.title}
                  onChange={(e) => updateEpisodeTitle(ep.id, e.target.value)}
                  placeholder={`第 ${idx + 1} 话`}
                  slotProps={{ htmlInput: { maxLength: MAX_EPISODE_TITLE } }}
                />
                {episodes.length > 1 && (
                  <IconButton
                    size="small"
                    onClick={() => removeEpisode(ep.id)}
                    aria-label={`删除第 ${idx + 1} 话`}
                  >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>

              {ep.file ? (
                <Box
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    bgcolor: 'action.hover',
                    border: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <VideoFileRoundedIcon sx={{ fontSize: 24, color: 'primary.main' }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontSize: 12,
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {ep.file.name}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                      {ep.sizeMB} MB ·{' '}
                      <Box
                        component="span"
                        sx={{
                          color:
                            ep.status === 'uploaded'
                              ? 'success.main'
                              : ep.status === 'failed'
                                ? 'error.main'
                                : 'warning.main',
                          fontWeight: 600,
                        }}
                      >
                        {ep.status === 'uploading'
                          ? '上传中…'
                          : ep.status === 'uploaded'
                            ? '已上传'
                            : '失败'}
                      </Box>
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    onClick={() => episodeInputRefs.current[ep.id]?.click()}
                    sx={{ textTransform: 'none', fontSize: 11, minWidth: 0, px: 1 }}
                  >
                    替换
                  </Button>
                </Box>
              ) : (
                <Box
                  onClick={() => episodeInputRefs.current[ep.id]?.click()}
                  role="button"
                  tabIndex={0}
                  aria-label={`第 ${idx + 1} 话上传`}
                  sx={{
                    p: 1.25,
                    borderRadius: 1,
                    border: '1.5px dashed',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    cursor: 'pointer',
                    bgcolor: 'background.default',
                    '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                  }}
                >
                  <VideoFileRoundedIcon sx={{ fontSize: 24, color: 'text.secondary' }} />
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 500 }}>
                    点击选择视频文件
                  </Typography>
                </Box>
              )}
              {ep.status === 'uploading' && <LinearProgress sx={{ borderRadius: 1 }} />}
              <input
                ref={(el) => {
                  episodeInputRefs.current[ep.id] = el;
                }}
                type="file"
                accept="video/*"
                onChange={(e) => handleEpisodeFile(ep.id, e)}
                style={{ display: 'none' }}
              />
            </Box>
          ))}
        </Box>
      </Box>

      {f.renderSnackbar()}
    </Box>
  );
}

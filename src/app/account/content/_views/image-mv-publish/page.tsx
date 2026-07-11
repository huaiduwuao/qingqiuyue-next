'use client';

import React, { useState, useRef, useMemo, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import TextField from '@mui/material/TextField';
import AudioFileRoundedIcon from '@mui/icons-material/AudioFileRounded';
import GraphicEqRoundedIcon from '@mui/icons-material/GraphicEqRounded';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useActiveTab } from '../../ActiveTabContext';
import { useContentForm, normalizeTags, uploadOneFile } from '../../_components/useContentForm';
import { gradient2 } from '@/constants/gradients';

// 图片 MV 发布 (PICTURE MV 变体) — 真实表单。
//
// 字段:标题 / 简介 / 多图槽(1-9 张,按时间轮播) / 背景音乐(单音频)。
// 跟 image-publish(图集)的关键差异:图片 MV 是「多图+音乐」按时间
// 自动播放,不是用户自己翻看;图集只有图,MV 加了 audio。
//
// 提交 payload:content 编 JSON { images: [...], audio: {...} }
// contentType: 'PICTURE'(跟图集同 enum,前端路由区分;后端通过
// audioUrl 是否存在判断是图集还是 MV)。
const MAX_IMAGES = 9;
const MAX_AUDIO_SIZE_MB = 50;

type UploadStatus = 'idle' | 'uploading' | 'uploaded' | 'failed';
interface ImageItem {
  id: string;
  file: File;
  previewUrl: string;
  status: UploadStatus;
  uploadedUrl?: string;
}
interface AudioState {
  file: File;
  status: UploadStatus;
  uploadedUrl?: string;
  sizeMB: number;
  durationSec?: number;
  name: string;
}

export default function ImageMvPublishPage() {
  const { setActiveTab } = useActiveTab();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [audio, setAudio] = useState<AudioState | null>(null);

  const f = useContentForm<any>({
    contentType: 'PICTURE',
    maxTitle: 30,
    maxDesc: 200,
    maxTags: 8,
    requireTitle: true,
    requireDesc: false,
    onSuccess: () => {
      images.forEach((i) => URL.revokeObjectURL(i.previewUrl));
      setActiveTab('content');
    },
    validate: () => {
      if (images.length === 0) return '请至少添加 1 张图片';
      if (images.some((i) => i.status !== 'uploaded')) return '请等待所有图片上传完成';
      // 音频是选填,但如果设了就必须 uploaded
      if (audio && audio.status !== 'uploaded') return '背景音乐上传未完成';
      return null;
    },
    buildPayload: () => ({
      title: f.title.trim(),
      subtitle: f.desc.trim().slice(0, 200),
      content: JSON.stringify({
        // 标记这是 MV 而非图集 — 后端按 audioUrl 区分
        kind: 'image-mv',
        images: images.map((i, idx) => ({
          index: idx,
          url: i.uploadedUrl,
        })),
        audio: audio
          ? { url: audio.uploadedUrl, sizeMB: audio.sizeMB, durationSec: audio.durationSec }
          : null,
      }),
      contentType: 'PICTURE',
      coverUrl: images[0]?.uploadedUrl,
      audioUrl: audio?.uploadedUrl,
      status: 'reviewing',
      tags: normalizeTags(f.tags, 8),
      imageCount: images.length,
    }),
  });

  // 图片管理(沿用 image-publish 模式)
  const addFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setImages((prev) => {
        const remaining = MAX_IMAGES - prev.length;
        if (remaining <= 0) {
          f.setSnack({ msg: `最多 ${MAX_IMAGES} 张图,已满`, severity: 'warning' });
          return prev;
        }
        const accepted = Array.from(files)
          .filter((fl) => fl.type.startsWith('image/'))
          .slice(0, remaining);
        const rejected = Array.from(files).filter((fl) => !fl.type.startsWith('image/'));
        if (rejected.length > 0) {
          f.setSnack({ msg: `已忽略 ${rejected.length} 个非图片文件`, severity: 'warning' });
        }
        const newItems: ImageItem[] = accepted.map((fl) => ({
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file: fl,
          previewUrl: URL.createObjectURL(fl),
          status: 'uploading',
        }));
        // 立即开始上传
        (async () => {
          for (const item of newItems) {
            const url = await uploadOneFile(item.file);
            setImages((curr) =>
              curr.map((c) =>
                c.id === item.id
                  ? url
                    ? { ...c, status: 'uploaded', uploadedUrl: url }
                    : { ...c, status: 'failed' }
                  : c,
              ),
            );
          }
        })();
        return [...prev, ...newItems];
      });
    },
    [f],
  );

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  // 音频上传(用 HTMLAudioElement 读 duration)
  const handleAudioChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      f.setSnack({ msg: '背景音乐必须是音频 (mp3 / m4a / wav)', severity: 'warning' });
      return;
    }
    const sizeMB = Number((file.size / 1024 / 1024).toFixed(1));
    if (sizeMB > MAX_AUDIO_SIZE_MB) {
      f.setSnack({ msg: `音频超出 ${MAX_AUDIO_SIZE_MB}MB`, severity: 'warning' });
      return;
    }
    const url = URL.createObjectURL(file);
    const audioEl = new Audio();
    audioEl.preload = 'metadata';
    audioEl.src = url;
    const durationSec = await new Promise<number | undefined>((resolve) => {
      const onLoaded = () => {
        resolve(audioEl.duration);
        audioEl.removeEventListener('loadedmetadata', onLoaded);
        URL.revokeObjectURL(url);
      };
      const onError = () => {
        resolve(undefined);
        audioEl.removeEventListener('error', onError);
        URL.revokeObjectURL(url);
      };
      audioEl.addEventListener('loadedmetadata', onLoaded);
      audioEl.addEventListener('error', onError);
    });
    setAudio({ file, status: 'uploading', sizeMB, durationSec, name: file.name });
    const uploadedUrl = await uploadOneFile(file);
    if (uploadedUrl) {
      setAudio((a) => (a ? { ...a, status: 'uploaded', uploadedUrl } : a));
      f.setSnack({ msg: '背景音乐上传成功', severity: 'success' });
    } else {
      setAudio((a) => (a ? { ...a, status: 'failed' } : a));
      f.setSnack({ msg: '背景音乐上传失败,请重试', severity: 'error' });
    }
  };
  const removeAudio = () => setAudio(null);

  const remaining = MAX_IMAGES - images.length;
  const canSubmitFinal = useMemo(
    () =>
      f.canSubmit &&
      images.length > 0 &&
      images.every((i) => i.status === 'uploaded') &&
      (!audio || audio.status === 'uploaded'),
    [f.canSubmit, images, audio],
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
            发布图片 MV
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>
            多图轮播 + 背景音乐 · 1-9 张图 · 自动按时间播放
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
          gap: 2.5,
        }}
      >
        {/* 左:多图槽(2/3) */}
        <Box>
          <Box
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              addFiles(e.dataTransfer.files);
            }}
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 1.5,
              p: 2,
              borderRadius: 2,
              bgcolor: 'background.paper',
              border: '1px dashed',
              borderColor: dragOver ? 'primary.main' : 'divider',
              transition: 'border-color 0.15s',
            }}
          >
            {images.map((img, idx) => (
              <Box
                key={img.id}
                sx={{
                  position: 'relative',
                  aspectRatio: '1 / 1',
                  borderRadius: 1.5,
                  overflow: 'hidden',
                  bgcolor: 'action.hover',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <img
                  src={img.previewUrl}
                  alt={img.file.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {img.status === 'uploading' && (
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
                {img.status === 'failed' && (
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      bgcolor: 'rgba(254, 44, 85, 0.85)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    失败
                  </Box>
                )}
                {img.status === 'uploaded' && (
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 4,
                      left: 4,
                      px: 0.5,
                      py: 0.125,
                      borderRadius: 0.5,
                      bgcolor: 'rgba(93, 219, 150, 0.95)',
                      color: '#0F172A',
                      fontSize: 9,
                      fontWeight: 700,
                    }}
                  >
                    {idx + 1} / {images.length}
                  </Box>
                )}
                <IconButton
                  size="small"
                  onClick={() => removeImage(img.id)}
                  aria-label={`删除第 ${idx + 1} 张`}
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
            ))}

            {remaining > 0 && (
              <Box
                onClick={() => imageInputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="添加图片"
                sx={{
                  aspectRatio: '1 / 1',
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
                <AddPhotoAlternateRoundedIcon sx={{ fontSize: 28, color: 'text.secondary' }} />
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  还能加 {remaining} 张
                </Typography>
              </Box>
            )}
          </Box>

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
            style={{ display: 'none' }}
          />

          <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
            <CloudUploadRoundedIcon sx={{ fontSize: 14 }} />
            <Typography sx={{ fontSize: 11 }}>
              支持 JPG/PNG/WEBP,按选择的顺序播放,拖拽到上方区域也可添加
            </Typography>
          </Box>
        </Box>

        {/* 右:元数据 + 音频 + 提交(1/3) */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            size="small"
            value={f.title}
            onChange={(e) => f.setTitle(e.target.value)}
            placeholder="给你的 MV 起个标题"
            slotProps={{
              htmlInput: { maxLength: 30 },
              formHelperText: { sx: { textAlign: 'right', fontSize: 10, m: 0, mt: 0.25 } },
            }}
            helperText={`${f.title.length} / 30`}
          />

          <TextField
            fullWidth
            multiline
            rows={2}
            size="small"
            value={f.desc}
            onChange={(e) => f.setDesc(e.target.value)}
            placeholder="简短描述,200 字内..."
            slotProps={{
              htmlInput: { maxLength: 200 },
              formHelperText: { sx: { textAlign: 'right', fontSize: 10, m: 0, mt: 0.25 } },
            }}
            helperText={`${f.desc.length} / 200`}
          />

          {/* 背景音乐(选填,但强烈推荐 — MV 没音乐就没灵魂) */}
          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              背景音乐
              <Box component="span" sx={{ color: 'text.disabled', ml: 0.5 }}>
                · 选填,但强烈推荐
              </Box>
            </Typography>
            {audio ? (
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1.5,
                  bgcolor: audio.status === 'failed' ? 'rgba(254, 44, 85, 0.08)' : 'action.hover',
                  border: '1px solid',
                  borderColor: audio.status === 'failed' ? 'error.main' : 'divider',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <GraphicEqRoundedIcon sx={{ fontSize: 24, color: 'primary.main' }} />
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
                      {audio.name}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                      {audio.sizeMB} MB
                      {audio.durationSec ? ` · ${formatDuration(audio.durationSec)}` : ''}
                      {' · '}
                      {audio.status === 'uploading'
                        ? '上传中...'
                        : audio.status === 'uploaded'
                          ? '已上传'
                          : '失败'}
                    </Typography>
                  </Box>
                </Box>
                {audio.status === 'uploading' && (
                  <LinearProgress sx={{ mb: 0.5, borderRadius: 1 }} />
                )}
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Button
                    size="small"
                    onClick={() => audioInputRef.current?.click()}
                    sx={{ textTransform: 'none', fontSize: 11, minWidth: 0, px: 1 }}
                  >
                    替换
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    onClick={removeAudio}
                    sx={{ textTransform: 'none', fontSize: 11, minWidth: 0, px: 1 }}
                  >
                    删除
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box
                onClick={() => audioInputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="上传背景音乐"
                sx={{
                  p: 2,
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
                <AudioFileRoundedIcon sx={{ fontSize: 28, color: 'text.secondary' }} />
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  点击选择背景音乐
                </Typography>
                <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                  mp3 / m4a · ≤ {MAX_AUDIO_SIZE_MB}MB
                </Typography>
              </Box>
            )}
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/mp3,audio/m4a,audio/wav,audio/mpeg,audio/*"
              onChange={handleAudioChange}
              style={{ display: 'none' }}
            />
          </Box>

          <TextField
            fullWidth
            size="small"
            value={f.tags}
            onChange={(e) => f.setTags(e.target.value)}
            placeholder="逗号或空格分隔,最多 8 个"
            helperText="例如:旅行, 回忆, 治愈"
            slotProps={{
              formHelperText: { sx: { fontSize: 10, m: 0, mt: 0.25 } },
            }}
          />

          <Box
            sx={{
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: gradient2('#22D3EE', '#67E8F9'),
              color: '#0F172A',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <PhotoLibraryRoundedIcon sx={{ fontSize: 16 }} />
              <Typography sx={{ fontSize: 12, fontWeight: 700 }}>发布须知</Typography>
            </Box>
            <Typography sx={{ fontSize: 11, lineHeight: 1.7, opacity: 0.85 }}>
              图片按选择顺序播放,每张 3 秒(后续支持自定义时长)。
              加背景音乐让 MV 有「呼吸感」。
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
              background: 'linear-gradient(90deg, #22D3EE 0%, #FE2C55 100%)',
              '&:hover': { filter: 'brightness(1.08)' },
              '&.Mui-disabled': {
                background: 'action.disabledBackground',
                color: 'text.disabled',
              },
            }}
          >
            {f.isPending
              ? '提交中...'
              : images.some((i) => i.status === 'uploading') || audio?.status === 'uploading'
                ? '上传中...'
                : `提交图片 MV (${images.length} 张图${audio ? ' + 音乐' : ''})`}
          </Button>
        </Box>
      </Box>

      {f.renderSnackbar()}
    </Box>
  );
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

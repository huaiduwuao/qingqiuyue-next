'use client';

import React, { useState, useRef, useMemo, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import TextField from '@mui/material/TextField';
import ImageIcon from '@mui/icons-material/Image';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import { useContentForm, normalizeTags, uploadOneFile } from '../useContentForm';
import { gradient2 } from '@/constants/gradients';
import type { PublishFormProps } from './types';

// 图文发布(图集)— PICTURE contentType,多图 + 短文 + 标签。
//
// title/desc/tags/snack/submit 走 useContentForm hook,本组件只管 images[]
// 自己的状态机(每张图独立 idle/uploading/uploaded/failed)。
const MAX_IMAGES = 9;

type UploadStatus = 'idle' | 'uploading' | 'uploaded' | 'failed';
interface ImageItem {
  id: string;
  file: File;
  previewUrl: string;
  status: UploadStatus;
  uploadedUrl?: string;
  progress: number;
}

export default function ImageForm({ onSuccess }: PublishFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<ImageItem[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const f = useContentForm<any>({
    contentType: 'PICTURE',
    maxTitle: 30,
    maxDesc: 200,
    maxTags: 8,
    requireTitle: true,
    requireDesc: false,
    onSuccess: () => {
      // cleanup preview URL 避免内存泄漏
      images.forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl));
      onSuccess?.();
    },
    validate: () => {
      if (images.length === 0) return '请至少添加 1 张图片';
      return null;
    },
    buildPayload: () => {
      const urls = images.map((i) => i.uploadedUrl).filter((u): u is string => !!u);
      return {
        title: f.title.trim(),
        subtitle: f.desc.trim().slice(0, 200),
        content: f.desc.trim().slice(0, 200),
        contentType: 'PICTURE',
        coverUrl: urls[0],
        status: 'reviewing',
        tags: normalizeTags(f.tags, 8),
      } as any;
    },
  });

  const addFiles = useCallback((files: FileList | null) => {
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
        status: 'idle',
        progress: 0,
      }));
      return [...prev, ...newItems];
    });
  }, [f]);

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  // 顺序上传每张图。失败即停 + 提示哪张失败;已成功的 URL 保留。
  const handleSubmit = async () => {
    f.setSnack({ msg: `开始上传 ${images.length} 张图片...`, severity: 'info' });
    const urls: string[] = [];
    for (const item of images) {
      if (item.status === 'uploaded' && item.uploadedUrl) {
        urls.push(item.uploadedUrl);
        continue;
      }
      setImages((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'uploading', progress: 0 } : i)),
      );
      const url = await uploadOneFile(item.file);
      if (!url) {
        setImages((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: 'failed' } : i)),
        );
        f.setSnack({
          msg: `图片「${item.file.name}」上传失败,请删除后重试`,
          severity: 'error',
        });
        return;
      }
      setImages((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, status: 'uploaded', uploadedUrl: url, progress: 100 } : i,
        ),
      );
      urls.push(url);
    }
    // 所有图上传成功 → 调 hook 的 submit(走 updateShare)
    const result = await f.submit();
    if (!result.ok) {
      // hook 已经 setSnack 错误,这里不重复
    }
  };

  // canSubmit 加上 images 检查
  const canSubmitFinal = useMemo(
    () =>
      f.canSubmit &&
      images.length > 0 &&
      !images.some((i) => i.status === 'uploading' || i.status === 'failed'),
    [f.canSubmit, images],
  );

  const remaining = MAX_IMAGES - images.length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
          gap: 2.5,
        }}
      >
        {/* 左:多图上传区(2/3) */}
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
            {images.map((img) => (
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
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
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
                      p: 1,
                    }}
                  >
                    <LinearProgress
                      sx={{ width: '80%', borderRadius: 1 }}
                      variant="determinate"
                      value={img.progress}
                    />
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
                    上传失败
                  </Box>
                )}
                {img.status === 'uploaded' && (
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 4,
                      left: 4,
                      px: 0.75,
                      py: 0.25,
                      borderRadius: 0.75,
                      bgcolor: 'rgba(93, 219, 150, 0.95)',
                      color: '#0F172A',
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    已上传
                  </Box>
                )}
                <IconButton
                  size="small"
                  onClick={() => removeImage(img.id)}
                  aria-label={`删除 ${img.file.name}`}
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
                onClick={() => fileInputRef.current?.click()}
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
                  transition: 'border-color 0.15s, bgcolor 0.15s',
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
            ref={fileInputRef}
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
              支持 JPG/PNG/WEBP/GIF,单张 ≤ 10MB,拖拽到上方区域也可添加
            </Typography>
          </Box>
        </Box>

        {/* 右:元数据 + 提交(1/3) */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              标题 <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={f.title}
              onChange={(e) => f.setTitle(e.target.value)}
              placeholder="给你的图文起个标题"
              slotProps={{
                htmlInput: { maxLength: 30 },
                formHelperText: { sx: { textAlign: 'right', fontSize: 10, m: 0, mt: 0.25 } },
              }}
              helperText={`${f.title.length} / 30`}
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              简介
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              size="small"
              value={f.desc}
              onChange={(e) => f.setDesc(e.target.value)}
              placeholder="说说这张图集背后的故事..."
              slotProps={{
                htmlInput: { maxLength: 200 },
                formHelperText: { sx: { textAlign: 'right', fontSize: 10, m: 0, mt: 0.25 } },
              }}
              helperText={`${f.desc.length} / 200`}
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
              placeholder="逗号或空格分隔,最多 8 个"
              helperText="例如:旅行, 美食, 摄影"
              slotProps={{
                formHelperText: { sx: { fontSize: 10, m: 0, mt: 0.25 } },
              }}
            />
          </Box>

          <Box
            sx={{
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: gradient2('#25F4EE', '#5DF7F2'),
              color: '#0F172A',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <ImageIcon sx={{ fontSize: 16 }} />
              <Typography sx={{ fontSize: 12, fontWeight: 700 }}>发布须知</Typography>
            </Box>
            <Typography sx={{ fontSize: 11, lineHeight: 1.7, opacity: 0.85 }}>
              提交后进入审核队列,通常 10 分钟内出结果。
              首次发布需先完成实名认证(在「等级勋章」中查看进度)。
            </Typography>
          </Box>

          <Button
            variant="contained"
            size="large"
            onClick={handleSubmit}
            disabled={!canSubmitFinal}
            sx={{
              textTransform: 'none',
              fontSize: 14,
              fontWeight: 700,
              py: 1.25,
              background: 'linear-gradient(90deg, #25F4EE 0%, #FE2C55 100%)',
              '&:hover': { filter: 'brightness(1.08)' },
              '&.Mui-disabled': {
                background: 'action.disabledBackground',
                color: 'text.disabled',
              },
            }}
          >
            {f.isPending
              ? '发布中…'
              : images.some((i) => i.status === 'uploading')
                ? '图片上传中…'
                : '发布'}
          </Button>
        </Box>
      </Box>

      {f.renderSnackbar()}
    </Box>
  );
}

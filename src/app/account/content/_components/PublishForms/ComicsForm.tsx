'use client';

import React, { useState, useRef, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Divider from '@mui/material/Divider';
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useContentForm, normalizeTags, uploadOneFile } from '../useContentForm';
import { gradient2 } from '@/constants/gradients';
import type { PublishFormProps } from './types';

// 漫画发布 (COMICS) — 真实表单。
//
// 字段:作品名 / 简介 / 封面 / 分镜列表(每页图片 + 旁白)。
// 跟 NOVEL 的关键差异:每页是图片(file upload) + 旁白短文本,而 NOVEL 每章是长文本。
const MAX_TITLE = 40;
const MAX_CAPTION = 200;
const MAX_PAGES = 200;
const MAX_TAGS = 8;

type PageStatus = 'idle' | 'uploading' | 'uploaded' | 'failed';
interface ComicsPage {
  id: string;
  file: File | null;
  previewUrl: string;
  uploadedUrl?: string;
  status: PageStatus;
  caption: string;
}

export default function ComicsForm({ onSuccess }: PublishFormProps) {
  const coverInputRef = useRef<HTMLInputElement>(null);
  const pageInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [cover, setCover] = useState<{
    file: File;
    previewUrl: string;
    status: 'uploading' | 'uploaded' | 'failed';
    uploadedUrl?: string;
  } | null>(null);
  const [pages, setPages] = useState<ComicsPage[]>(() => [
    { id: `pg-${Date.now()}`, file: null, previewUrl: '', status: 'idle', caption: '' },
  ]);

  const f = useContentForm<any>({
    contentType: 'COMICS',
    maxTitle: MAX_TITLE,
    maxDesc: 200,
    maxTags: MAX_TAGS,
    requireTitle: true,
    requireDesc: false,
    onSuccess: () => {
      if (cover?.previewUrl) URL.revokeObjectURL(cover.previewUrl);
      pages.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
      onSuccess?.();
    },
    validate: () => {
      if (pages.length === 0) return '至少需要 1 页';
      if (pages.every((p) => !p.uploadedUrl)) return '至少 1 页需要上传图片';
      if (pages.some((p) => p.status === 'failed')) return '有页上传失败,请删除后重试';
      return null;
    },
    buildPayload: () => ({
      title: f.title.trim(),
      subtitle: f.desc.trim().slice(0, 200),
      content: JSON.stringify(
        pages.map((p, i) => ({
          index: i + 1,
          imageUrl: p.uploadedUrl,
          caption: p.caption,
        })),
      ),
      contentType: 'COMICS',
      coverUrl: cover?.uploadedUrl,
      status: 'reviewing',
      tags: normalizeTags(f.tags, MAX_TAGS),
      pageCount: pages.length,
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

  // 分镜管理
  const addPage = () => {
    if (pages.length >= MAX_PAGES) {
      f.setSnack({ msg: `最多 ${MAX_PAGES} 页`, severity: 'warning' });
      return;
    }
    setPages((prev) => [
      ...prev,
      {
        id: `pg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        file: null,
        previewUrl: '',
        status: 'idle',
        caption: '',
      },
    ]);
  };
  const removePage = (id: string) => {
    setPages((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };
  const updatePageCaption = (id: string, caption: string) => {
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, caption: caption.slice(0, MAX_CAPTION) } : p)),
    );
  };

  const handlePageFile = async (pgId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      f.setSnack({ msg: '分镜必须是图片', severity: 'warning' });
      return;
    }
    setPages((prev) => {
      const old = prev.find((p) => p.id === pgId);
      if (old?.previewUrl) URL.revokeObjectURL(old.previewUrl);
      return prev.map((p) =>
        p.id === pgId
          ? { ...p, file, status: 'uploading' as PageStatus, previewUrl: URL.createObjectURL(file) }
          : p,
      );
    });
    const url = await uploadOneFile(file);
    if (url) {
      setPages((prev) =>
        prev.map((p) =>
          p.id === pgId ? { ...p, status: 'uploaded', uploadedUrl: url } : p,
        ),
      );
    } else {
      setPages((prev) =>
        prev.map((p) => (p.id === pgId ? { ...p, status: 'failed' } : p)),
      );
      f.setSnack({ msg: `${file.name} 上传失败`, severity: 'error' });
    }
  };

  const canSubmitFinal = useMemo(
    () =>
      f.canSubmit &&
      pages.length > 0 &&
      pages.some((p) => p.status === 'uploaded' && p.uploadedUrl) &&
      pages.every((p) => p.status !== 'failed'),
    [f.canSubmit, pages],
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
        {/* 左:作品名 / 简介 / 封面 / 标签 / 提交 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            value={f.title}
            onChange={(e) => f.setTitle(e.target.value)}
            placeholder="作品名"
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
              简介 / 故事梗概
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              size="small"
              value={f.desc}
              onChange={(e) => f.setDesc(e.target.value)}
              placeholder="作品简介,200 字内..."
              slotProps={{
                htmlInput: { maxLength: 200 },
                formHelperText: { sx: { textAlign: 'right', fontSize: 10, m: 0, mt: 0.25 } },
              }}
              helperText={`${f.desc.length} / 200`}
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              封面(选填,推荐 2:3 竖版)
            </Typography>
            {cover ? (
              <Box
                sx={{
                  position: 'relative',
                  width: 140,
                  aspectRatio: '2 / 3',
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
                      fontSize: 11,
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
                  width: 140,
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
                <CloudUploadRoundedIcon sx={{ fontSize: 22, color: 'text.secondary' }} />
                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                  2:3 封面
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
              bgcolor: gradient2('#FB923C', '#FDBA74'),
              color: '#0F172A',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <AutoStoriesRoundedIcon sx={{ fontSize: 16 }} />
              <Typography sx={{ fontSize: 12, fontWeight: 700 }}>发布须知</Typography>
            </Box>
            <Typography sx={{ fontSize: 11, lineHeight: 1.7, opacity: 0.85 }}>
              分镜顺序按页阅读,每页必传图片(单图),旁白选填 200 字内。
              后续要做:对白气泡编辑器、网点 / 特效、跨页大图。
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
              background: 'linear-gradient(90deg, #FB923C 0%, #FE2C55 100%)',
              '&:hover': { filter: 'brightness(1.08)' },
              '&.Mui-disabled': {
                background: 'action.disabledBackground',
                color: 'text.disabled',
              },
            }}
          >
            {f.isPending
              ? '发布中…'
              : pages.some((p) => p.status === 'uploading')
                ? '图片上传中…'
                : '发布'}
          </Button>
        </Box>

        {/* 右:分镜列表 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'text.primary' }}>
              分镜列表
              <Box component="span" sx={{ ml: 1, fontSize: 11, color: 'text.secondary' }}>
                {pages.length} / {MAX_PAGES}
              </Box>
            </Typography>
            <Button
              size="small"
              startIcon={<AddRoundedIcon />}
              onClick={addPage}
              disabled={pages.length >= MAX_PAGES}
              sx={{ textTransform: 'none', fontSize: 12 }}
            >
              添加一页
            </Button>
          </Box>

          {pages.map((p, idx) => (
            <Box
              key={p.id}
              sx={{
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: p.status === 'failed' ? 'error.main' : 'divider',
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
                    bgcolor: '#FB923C',
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
                <Box sx={{ flex: 1, fontSize: 12, color: 'text.secondary' }}>
                  第 {idx + 1} 页
                </Box>
                {pages.length > 1 && (
                  <IconButton
                    size="small"
                    onClick={() => removePage(p.id)}
                    aria-label={`删除第 ${idx + 1} 页`}
                  >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>

              {/* 分镜图片 — 2:3 竖版预览(漫画页比例) */}
              {p.file ? (
                <Box
                  sx={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '2 / 3',
                    borderRadius: 1,
                    overflow: 'hidden',
                    bgcolor: 'action.hover',
                  }}
                >
                  <img
                    src={p.previewUrl}
                    alt={p.file.name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                  {p.status === 'uploading' && (
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
                      <LinearProgress sx={{ width: '60%' }} />
                    </Box>
                  )}
                  {p.status === 'failed' && (
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
                      上传失败
                    </Box>
                  )}
                  {p.status === 'uploaded' && (
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
                      已上传
                    </Box>
                  )}
                </Box>
              ) : (
                <Box
                  onClick={() => pageInputRefs.current[p.id]?.click()}
                  role="button"
                  tabIndex={0}
                  aria-label={`第 ${idx + 1} 页上传`}
                  sx={{
                    width: '100%',
                    aspectRatio: '2 / 3',
                    borderRadius: 1,
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
                  <AddPhotoAlternateRoundedIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                    点击上传分镜图
                  </Typography>
                </Box>
              )}
              <input
                ref={(el) => {
                  pageInputRefs.current[p.id] = el;
                }}
                type="file"
                accept="image/*"
                onChange={(e) => handlePageFile(p.id, e)}
                style={{ display: 'none' }}
              />

              {/* 旁白 */}
              <TextField
                fullWidth
                multiline
                rows={2}
                size="small"
                value={p.caption}
                onChange={(e) => updatePageCaption(p.id, e.target.value)}
                placeholder="旁白(选填,200 字内)"
                slotProps={{
                  htmlInput: { maxLength: MAX_CAPTION },
                  formHelperText: { sx: { textAlign: 'right', fontSize: 10, m: 0, mt: 0.25 } },
                }}
                helperText={`${p.caption.length} / ${MAX_CAPTION}`}
              />
            </Box>
          ))}
        </Box>
      </Box>

      {f.renderSnackbar()}
    </Box>
  );
}

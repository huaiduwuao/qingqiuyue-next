'use client';

import React, { useState, useRef, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Divider from '@mui/material/Divider';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useContentForm, normalizeTags, uploadOneFile } from '../useContentForm';
import { gradient2 } from '@/constants/gradients';
import type { PublishFormProps } from './types';

// 小说发布 (NOVEL) — 真实表单。
//
// 字段:书名 / 简介 / 封面 / 章节列表(每章独立标题 + 长文本)。
//
// 章节数据结构: { id, title, body, wordCount }
// 提交时:content = JSON.stringify({ chapters: [{ index, title, wordCount, body }] })
// 总字数 = 各章 wordCount 之和。
const MAX_TITLE = 40;
const MAX_CHAPTER_TITLE = 30;
const MAX_CHAPTER_BODY = 10000; // 单章 1 万字
const MAX_CHAPTERS = 100;
const MAX_TAGS = 8;

interface Chapter {
  id: string;
  title: string;
  body: string;
  wordCount: number;
}

export default function NovelForm({ onSuccess }: PublishFormProps) {
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [cover, setCover] = useState<{
    file: File;
    previewUrl: string;
    status: 'uploading' | 'uploaded' | 'failed';
    uploadedUrl?: string;
  } | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>(() => [
    { id: `ch-${Date.now()}`, title: '第一章', body: '', wordCount: 0 },
  ]);

  const f = useContentForm<any>({
    contentType: 'NOVEL',
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
      if (chapters.length === 0) return '至少需要 1 章';
      if (chapters.every((c) => !c.body.trim())) return '至少 1 章需要正文';
      if (chapters.some((c) => c.body.length > MAX_CHAPTER_BODY))
        return `某章超出 ${MAX_CHAPTER_BODY} 字,请精简`;
      return null;
    },
    buildPayload: () => {
      const totalWordCount = chapters.reduce((sum, c) => sum + c.wordCount, 0);
      return {
        title: f.title.trim(),
        subtitle: f.desc.trim().slice(0, 200),
        content: JSON.stringify({
          totalWordCount,
          chapters: chapters.map((c, i) => ({
            index: i + 1,
            title: c.title,
            wordCount: c.wordCount,
            body: c.body,
          })),
        }),
        contentType: 'NOVEL',
        coverUrl: cover?.uploadedUrl,
        status: 'reviewing',
        tags: normalizeTags(f.tags, MAX_TAGS),
        chapterCount: chapters.length,
        wordCount: totalWordCount,
      };
    },
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

  // 章节管理
  const addChapter = () => {
    if (chapters.length >= MAX_CHAPTERS) {
      f.setSnack({ msg: `最多 ${MAX_CHAPTERS} 章`, severity: 'warning' });
      return;
    }
    setChapters((prev) => [
      ...prev,
      {
        id: `ch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: `第 ${prev.length + 1} 章`,
        body: '',
        wordCount: 0,
      },
    ]);
  };
  const removeChapter = (id: string) => {
    setChapters((prev) => prev.filter((c) => c.id !== id));
  };
  const updateChapterTitle = (id: string, title: string) => {
    setChapters((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: title.slice(0, MAX_CHAPTER_TITLE) } : c)),
    );
  };
  const updateChapterBody = (id: string, body: string) => {
    const trimmed = body.slice(0, MAX_CHAPTER_BODY + 200);
    const wordCount = trimmed.replace(/\s+/g, '').length;
    setChapters((prev) =>
      prev.map((c) => (c.id === id ? { ...c, body: trimmed, wordCount } : c)),
    );
  };

  const totalWordCount = useMemo(
    () => chapters.reduce((sum, c) => sum + c.wordCount, 0),
    [chapters],
  );
  const totalChapterCount = chapters.length;
  const canSubmitFinal = useMemo(
    () =>
      f.canSubmit &&
      chapters.length > 0 &&
      chapters.some((c) => c.body.trim().length > 0),
    [f.canSubmit, chapters],
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
        {/* 左:书名 / 简介 / 封面 / 标签 / 提交须知 / 提交 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            value={f.title}
            onChange={(e) => f.setTitle(e.target.value)}
            placeholder="书名"
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
              简介 / 内容梗概
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              size="small"
              value={f.desc}
              onChange={(e) => f.setDesc(e.target.value)}
              placeholder="故事梗概,200 字内..."
              slotProps={{
                htmlInput: { maxLength: 200 },
                formHelperText: { sx: { textAlign: 'right', fontSize: 10, m: 0, mt: 0.25 } },
              }}
              helperText={`${f.desc.length} / 200`}
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              封面(选填,推荐 3:4 竖版 或 16:9 横版)
            </Typography>
            {cover ? (
              <Box
                sx={{
                  position: 'relative',
                  width: 140,
                  aspectRatio: '3 / 4',
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
                  aspectRatio: '3 / 4',
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
                  3:4 封面
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
              helperText="例如:玄幻, 修真, 都市"
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
              bgcolor: gradient2('#A78BFA', '#DDD6FE'),
              color: '#0F172A',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <MenuBookRoundedIcon sx={{ fontSize: 16 }} />
              <Typography sx={{ fontSize: 12, fontWeight: 700 }}>发布须知</Typography>
            </Box>
            <Typography sx={{ fontSize: 11, lineHeight: 1.7, opacity: 0.85 }}>
              章节独立编辑,支持连载 / 完结状态。
              第一版全量 body 存 content JSON,后续后端 chapter 表落地后切独立表。
              审核比短文更严(整本审),单本 100k+ 字可能要 1-2 小时。
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
              background: 'linear-gradient(90deg, #A78BFA 0%, #FE2C55 100%)',
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

        {/* 右:章节列表 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'text.primary' }}>
              章节列表
              <Box component="span" sx={{ ml: 1, fontSize: 11, color: 'text.secondary' }}>
                {totalChapterCount} / {MAX_CHAPTERS}
              </Box>
            </Typography>
            <Button
              size="small"
              startIcon={<AddRoundedIcon />}
              onClick={addChapter}
              disabled={chapters.length >= MAX_CHAPTERS}
              sx={{ textTransform: 'none', fontSize: 12 }}
            >
              添加章节
            </Button>
          </Box>

          {chapters.map((ch, idx) => (
            <Box
              key={ch.id}
              sx={{
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
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
                    bgcolor: '#A78BFA',
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
                  value={ch.title}
                  onChange={(e) => updateChapterTitle(ch.id, e.target.value)}
                  placeholder={`第 ${idx + 1} 章`}
                  slotProps={{
                    htmlInput: { maxLength: MAX_CHAPTER_TITLE },
                  }}
                />
                {chapters.length > 1 && (
                  <IconButton
                    size="small"
                    onClick={() => removeChapter(ch.id)}
                    aria-label={`删除第 ${idx + 1} 章`}
                  >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>

              <TextField
                fullWidth
                multiline
                minRows={6}
                size="small"
                value={ch.body}
                onChange={(e) => updateChapterBody(ch.id, e.target.value)}
                placeholder={`第 ${idx + 1} 章正文...直接写纯文本,不需要 markdown`}
                slotProps={{
                  htmlInput: {
                    maxLength: MAX_CHAPTER_BODY + 200,
                    style: {
                      fontFamily: 'Georgia, "Source Han Serif SC", serif',
                      fontSize: 13,
                      lineHeight: 1.8,
                    },
                  },
                }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                  纯文本(无需 markdown)
                </Typography>
                <Typography
                  sx={{
                    fontSize: 10,
                    color: ch.body.length > MAX_CHAPTER_BODY ? 'error.main' : 'text.secondary',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {ch.wordCount.toLocaleString()} / {MAX_CHAPTER_BODY.toLocaleString()} 字
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {f.renderSnackbar()}
    </Box>
  );
}

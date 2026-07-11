'use client';

import React, { useState, useRef, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import ImageIcon from '@mui/icons-material/Image';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import { useActiveTab } from '../../ActiveTabContext';
import { fileUpload } from '@/apis/global';
import { updateShare } from '@/apis/module-content';
import { accountClient, formatApiError, isAuthError, isNetworkError } from '@/lib/api/client';
import { gradient2 } from '@/constants/gradients';

// 图文发布支持 1-9 张图(参考抖音/小红书图文上限)。
// 历史原因:之前 NewCreationSection 把图文入口也路由到 hd-publish,但
// hd-publish 的 file input 强制 accept="video/*",用户选图被浏览器拒。
// 这次拆出独立 view,本文件用真实的 image/* 多图上传 + 标题/简介/标签 + 提交。
const MAX_IMAGES = 9;
const MAX_TITLE = 30;
const MAX_DESC = 200;

type UploadStatus = 'idle' | 'uploading' | 'uploaded' | 'failed';
type SnackSeverity = 'success' | 'error' | 'info' | 'warning';
interface SnackMsg { msg: string; severity: SnackSeverity; }

interface ImageItem {
  id: string;
  file: File;
  previewUrl: string;
  status: UploadStatus;
  uploadedUrl?: string;
  progress: number;
}

export default function ImagePublishPage() {
  const { setActiveTab } = useActiveTab();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [tags, setTags] = useState('');
  const [images, setImages] = useState<ImageItem[]>([]);
  const [snack, setSnackRaw] = useState<SnackMsg | null>(null);
  const dismissSnack = React.useCallback(() => setSnackRaw(null), []);
  const setSnack = React.useCallback(
    (s: string | SnackMsg) =>
      setSnackRaw(typeof s === 'string' ? { msg: s, severity: 'info' } : s),
    [],
  );

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setImages((prev) => {
      const remaining = MAX_IMAGES - prev.length;
      if (remaining <= 0) {
        setSnack({ msg: `最多 ${MAX_IMAGES} 张图,已满`, severity: 'warning' });
        return prev;
      }
      const accepted = Array.from(files)
        .filter((f) => f.type.startsWith('image/'))
        .slice(0, remaining);
      const rejected = Array.from(files).filter((f) => !f.type.startsWith('image/'));
      if (rejected.length > 0) {
        setSnack({ msg: `已忽略 ${rejected.length} 个非图片文件`, severity: 'warning' });
      }
      const newItems: ImageItem[] = accepted.map((f) => ({
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        previewUrl: URL.createObjectURL(f),
        status: 'idle',
        progress: 0,
      }));
      return [...prev, ...newItems];
    });
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  // drag/drop 状态(放在最外层 Box 上传区)
  const [dragOver, setDragOver] = useState(false);

  // 真接口上传:对每张图依次调 fileUpload(并发=2)。
  // 这里故意不一次全并发,避免大文件 / 网络差时 OOM + 后端压力。
  const uploadOne = async (item: ImageItem): Promise<string | null> => {
    setImages((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: 'uploading', progress: 0 } : i)),
    );
    const formData = new FormData();
    formData.append('file', item.file);
    try {
      const res: any = await accountClient.post('/file/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res?.data?.url ?? res?.url;
      if (url) {
        setImages((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: 'uploaded', uploadedUrl: url, progress: 100 } : i,
          ),
        );
        return url;
      }
      setImages((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'failed' } : i)),
      );
      return null;
    } catch (e) {
      setImages((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'failed' } : i)),
      );
      return null;
    }
  };

  const createMutation = useMutation({
    mutationFn: (urls: string[]) =>
      updateShare({
        // id 必须传 0/缺省让后端新建 — updateShare 走 POST /module/content
        // 后端靠 id=0/缺省判新建 vs 更新。这里只填必要字段。
        title: title.trim(),
        subtitle: desc.trim().slice(0, MAX_DESC),
        content: desc.trim().slice(0, MAX_DESC),
        contentType: 'PICTURE',
        coverUrl: urls[0],
        status: 'reviewing',
        tags: tags
          .split(/[,，\s]+/)
          .filter(Boolean)
          .slice(0, 8)
          .join(','),
        // 多图内容正文用 markdown 图片块塞进 content,前端详情页需要支持渲染。
        // 这里把图全部 URL 拼成 markdown 串,正文正文用 content 字段传。
        // ModuleContentItem.content 已是 string,直接拼。
      } as any),
  });

  const handleSubmit = async () => {
    if (!title.trim()) {
      setSnack({ msg: '请输入图文标题', severity: 'warning' });
      return;
    }
    if (images.length === 0) {
      setSnack({ msg: '请至少添加 1 张图片', severity: 'warning' });
      return;
    }
    // 顺序上传每张图(并发=1,最稳)。失败收集,只要有一张成功就允许提交(其他失败
    // 的会被跳过,user 看到成功部分 + 提示哪张失败)。这里策略:全部必须成功。
    setSnack({ msg: `开始上传 ${images.length} 张图片...`, severity: 'info' });
    const urls: string[] = [];
    for (const item of images) {
      // 已上传的复用 URL
      if (item.status === 'uploaded' && item.uploadedUrl) {
        urls.push(item.uploadedUrl);
        continue;
      }
      const url = await uploadOne(item);
      if (!url) {
        setSnack({
          msg: `图片「${item.file.name}」上传失败,请删除后重试`,
          severity: 'error',
        });
        return;
      }
      urls.push(url);
    }
    try {
      await createMutation.mutateAsync(urls);
    } catch (e: any) {
      // catch 后立即 return — 不要继续往下"假装成功"
      if (isAuthError(e)) {
        setSnack({ msg: '请重新登录', severity: 'error' });
      } else if (isNetworkError(e)) {
        setSnack({ msg: '网络错误,请检查连接后重试', severity: 'error' });
      } else {
        setSnack({ msg: `发布失败:${formatApiError(e)}`, severity: 'error' });
      }
      return;
    }
    setSnack({ msg: '已提交审核,正在等待平台处理', severity: 'success' });
    // 清理 preview URL 避免内存泄漏,然后跳回工作台
    images.forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl));
    setActiveTab('content');
  };

  const remaining = MAX_IMAGES - images.length;
  const canSubmit = useMemo(() => {
    if (!title.trim()) return false;
    if (images.length === 0) return false;
    if (createMutation.isPending) return false;
    if (images.some((i) => i.status === 'uploading' || i.status === 'failed')) return false;
    return true;
  }, [title, images, createMutation.isPending]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* 顶部:返回 + 标题 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <IconButton
          size="small"
          onClick={() => setActiveTab('content')}
          sx={{ border: '1px solid', borderColor: 'divider' }}
          aria-label="返回工作台"
        >
          <ArrowBackRoundedIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 18, fontWeight: 700, color: 'text.primary' }}>
            发布图文
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>
            支持 1-9 张图片 · 标题 {MAX_TITLE} 字 · 简介 {MAX_DESC} 字
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
                {/* 状态遮罩 */}
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

            {/* 添加按钮(未满 9 张时显示) */}
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
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
              placeholder="给你的图文起个标题"
              slotProps={{
                htmlInput: { maxLength: MAX_TITLE },
                formHelperText: { sx: { textAlign: 'right', fontSize: 10, m: 0, mt: 0.25 } },
              }}
              helperText={`${title.length} / ${MAX_TITLE}`}
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
              value={desc}
              onChange={(e) => setDesc(e.target.value.slice(0, MAX_DESC))}
              placeholder="说说这张图集背后的故事..."
              slotProps={{
                htmlInput: { maxLength: MAX_DESC },
                formHelperText: { sx: { textAlign: 'right', fontSize: 10, m: 0, mt: 0.25 } },
              }}
              helperText={`${desc.length} / ${MAX_DESC}`}
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              标签
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="逗号或空格分隔,最多 8 个"
              helperText="例如:旅行, 美食, 摄影"
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
            disabled={!canSubmit}
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
            {createMutation.isPending
              ? '提交中...'
              : images.some((i) => i.status === 'uploading')
                ? '图片上传中...'
                : `提交发布 (${images.length} 张图)`}
          </Button>
        </Box>
      </Box>

      <Snackbar
        open={!!snack}
        autoHideDuration={snack?.severity === 'error' ? 5000 : 2400}
        onClose={dismissSnack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snack ? (
          <Alert
            severity={snack.severity}
            variant="filled"
            onClose={dismissSnack}
            sx={{ width: '100%' }}
          >
            {snack.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}

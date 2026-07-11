'use client';

import React, { useState, useRef, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import LinearProgress from '@mui/material/LinearProgress';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import DescriptionIcon from '@mui/icons-material/Description';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import FormatBoldRoundedIcon from '@mui/icons-material/FormatBoldRounded';
import FormatItalicRoundedIcon from '@mui/icons-material/FormatItalicRounded';
import TitleRoundedIcon from '@mui/icons-material/TitleRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import FormatQuoteRoundedIcon from '@mui/icons-material/FormatQuoteRounded';
import FormatListBulletedRoundedIcon from '@mui/icons-material/FormatListBulletedRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useActiveTab } from '../../ActiveTabContext';
import { fileUpload } from '@/apis/global';
import { updateShare } from '@/apis/module-content';
import { accountClient, formatApiError, isAuthError, isNetworkError } from '@/lib/api/client';
import { gradient2 } from '@/constants/gradients';

// 文章发布 — 真实表单
//
// 历史上 NewCreationSection 把"发布文章"也路由到 hd-publish,但 hd-publish
// 的 file input 强制 accept="video/*",且没有富文本编辑能力,user 选不到
// 任何东西。这次拆出独立 view,提供:
//  - 标题(40 字)+ 封面单图
//  - markdown 编辑器(textarea + 工具栏在光标处插入粗体/斜体/标题/链接/
//    引用/列表/代码/图片;支持预览切换)
//  - 8000 字字数限制 + 实时计数
//  - 标签(逗号/空格分隔,8 个)
//  - 提交按钮调 updateShare(contentType: 'ARTICLE')
//
// 不引入 Tiptap/Slate 等富文本库 — markdown 简洁 + 0 依赖,跟现有
// image-publish 风格一致;后续要 WYSIWYG 升级再考虑 Tiptap。
const MAX_TITLE = 40;
const MAX_BODY = 8000;
const MAX_TAGS = 8;

type SnackSeverity = 'success' | 'error' | 'info' | 'warning';
interface SnackMsg { msg: string; severity: SnackSeverity; }

type CoverStatus = 'idle' | 'uploading' | 'uploaded' | 'failed';

export default function ArticlePublishPage() {
  const { setActiveTab } = useActiveTab();
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const inlineImageInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [cover, setCover] = useState<{
    file: File;
    previewUrl: string;
    status: CoverStatus;
    uploadedUrl?: string;
  } | null>(null);
  const [snack, setSnackRaw] = useState<SnackMsg | null>(null);
  const dismissSnack = React.useCallback(() => setSnackRaw(null), []);
  const setSnack = React.useCallback(
    (s: string | SnackMsg) =>
      setSnackRaw(typeof s === 'string' ? { msg: s, severity: 'info' } : s),
    [],
  );

  // 工具栏:在光标处插入 markdown 标记
  const wrapSelection = (before: string, after = before, placeholder = '') => {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = body.slice(start, end) || placeholder;
    const next = body.slice(0, start) + before + selected + after + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + before.length + selected.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const insertAtCursor = (text: string) => {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const next = body.slice(0, start) + text + body.slice(start);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + text.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  // 封面:单图上传
  const handleCoverPick = () => coverInputRef.current?.click();
  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setSnack({ msg: '封面必须是图片', severity: 'warning' });
      return;
    }
    if (cover?.previewUrl) URL.revokeObjectURL(cover.previewUrl);
    const previewUrl = URL.createObjectURL(file);
    setCover({ file, previewUrl, status: 'uploading' });
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res: any = await accountClient.post('/file/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res?.data?.url ?? res?.url;
      if (url) {
        setCover((c) => (c ? { ...c, status: 'uploaded', uploadedUrl: url } : c));
        setSnack({ msg: '封面上传成功', severity: 'success' });
      } else {
        setCover((c) => (c ? { ...c, status: 'failed' } : c));
        setSnack({ msg: '封面上传成功但未返回地址', severity: 'error' });
      }
    } catch (e) {
      setCover((c) => (c ? { ...c, status: 'failed' } : c));
      setSnack({ msg: `封面上传失败:${formatApiError(e)}`, severity: 'error' });
    }
  };
  const removeCover = () => {
    if (cover?.previewUrl) URL.revokeObjectURL(cover.previewUrl);
    setCover(null);
  };

  // 内嵌图:点工具栏"插入图片" → 选图 → 上传 → 在光标处插入 markdown
  const handleInlineImagePick = () => inlineImageInputRef.current?.click();
  const handleInlineImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setSnack({ msg: `开始上传 ${files.length} 张内嵌图...`, severity: 'info' });
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res: any = await accountClient.post('/file/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const url = res?.data?.url ?? res?.url;
        if (url) {
          const alt = file.name.replace(/\.[^.]+$/, '');
          insertAtCursor(`\n![${alt}](${url})\n`);
        } else {
          setSnack({ msg: `${file.name} 上传成功但未返回地址`, severity: 'error' });
        }
      } catch (err) {
        setSnack({ msg: `${file.name} 上传失败:${formatApiError(err)}`, severity: 'error' });
      }
    }
    setSnack({ msg: '内嵌图上传完成', severity: 'success' });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      updateShare({
        title: title.trim(),
        subtitle: body.replace(/\s+/g, ' ').trim().slice(0, 80),
        content: body.slice(0, MAX_BODY),
        contentType: 'ARTICLE',
        coverUrl: cover?.uploadedUrl,
        status: 'reviewing',
        tags: tags
          .split(/[,，\s]+/)
          .filter(Boolean)
          .slice(0, MAX_TAGS)
          .join(','),
      } as any),
  });

  const handleSubmit = async () => {
    if (!title.trim()) {
      setSnack({ msg: '请输入文章标题', severity: 'warning' });
      titleRef.current?.focus();
      return;
    }
    if (!body.trim()) {
      setSnack({ msg: '请输入正文内容', severity: 'warning' });
      bodyRef.current?.focus();
      return;
    }
    if (body.length > MAX_BODY) {
      setSnack({ msg: `正文超出 ${MAX_BODY - body.length} 字,请精简`, severity: 'warning' });
      return;
    }
    if (cover && cover.status !== 'uploaded') {
      setSnack({ msg: '封面上传未完成,请稍候或重新选择', severity: 'warning' });
      return;
    }
    try {
      await createMutation.mutateAsync();
    } catch (e: any) {
      if (isAuthError(e)) {
        setSnack({ msg: '请重新登录', severity: 'error' });
      } else if (isNetworkError(e)) {
        setSnack({ msg: '网络错误,请检查连接后重试', severity: 'error' });
      } else {
        setSnack({ msg: `发布失败:${formatApiError(e)}`, severity: 'error' });
      }
      return;
    }
    setSnack({ msg: '文章已提交审核', severity: 'success' });
    if (cover?.previewUrl) URL.revokeObjectURL(cover.previewUrl);
    setActiveTab('content');
  };

  const canSubmit = useMemo(() => {
    if (!title.trim() || !body.trim()) return false;
    if (body.length > MAX_BODY) return false;
    if (cover && cover.status !== 'uploaded') return false;
    if (createMutation.isPending) return false;
    return true;
  }, [title, body, cover, createMutation.isPending]);

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
            发布文章
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>
            Markdown 排版 · 标题 {MAX_TITLE} 字 · 正文 {MAX_BODY} 字 · 标签 {MAX_TAGS} 个
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '7fr 5fr' },
          gap: 2.5,
        }}
      >
        {/* 左:标题 + 编辑器(7/12) */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {/* 文章标题 */}
          <TextField
            inputRef={titleRef}
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
            placeholder="给你的文章起个标题"
            slotProps={{
              htmlInput: {
                maxLength: MAX_TITLE,
                style: { fontSize: 18, fontWeight: 600 },
              },
              formHelperText: { sx: { textAlign: 'right', fontSize: 10, m: 0, mt: 0.25 } },
            }}
            helperText={`${title.length} / ${MAX_TITLE}`}
          />

          {/* 工具栏 */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              p: 0.75,
              borderRadius: 1.5,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              flexWrap: 'wrap',
            }}
          >
            <Tooltip title="粗体 **text**">
              <IconButton size="small" onClick={() => wrapSelection('**', '**', '粗体文本')}>
                <FormatBoldRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="斜体 *text*">
              <IconButton size="small" onClick={() => wrapSelection('*', '*', '斜体')}>
                <FormatItalicRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="标题 # text">
              <IconButton size="small" onClick={() => insertAtCursor('\n## ')}>
                <TitleRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="链接 [text](url)">
              <IconButton size="small" onClick={() => wrapSelection('[', '](https://)', '链接文字')}>
                <LinkRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="引用 > text">
              <IconButton size="small" onClick={() => insertAtCursor('\n> ')}>
                <FormatQuoteRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="无序列表 - item">
              <IconButton size="small" onClick={() => insertAtCursor('\n- ')}>
                <FormatListBulletedRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="行内代码 `code`">
              <IconButton size="small" onClick={() => wrapSelection('`', '`', 'code')}>
                <CodeRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="插入图片(在光标处)">
              <IconButton size="small" onClick={handleInlineImagePick}>
                <AddPhotoAlternateRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <input
              ref={inlineImageInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleInlineImageChange}
              style={{ display: 'none' }}
            />
            <Box sx={{ flex: 1 }} />
            <Tooltip title={showPreview ? '回到编辑' : '预览效果'}>
              <IconButton size="small" onClick={() => setShowPreview((p) => !p)}>
                {showPreview ? (
                  <EditRoundedIcon fontSize="small" />
                ) : (
                  <VisibilityRoundedIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          </Box>

          {/* 编辑区 / 预览区 */}
          {showPreview ? (
            <Box
              sx={{
                p: 2,
                minHeight: 360,
                borderRadius: 1.5,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                fontSize: 14,
                lineHeight: 1.8,
                color: 'text.primary',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                '& img': { maxWidth: '100%', borderRadius: 1, my: 1 },
                '& h1, & h2, & h3': { fontWeight: 700, mt: 2, mb: 1 },
                '& h2': { fontSize: 18 },
                '& h3': { fontSize: 16 },
                '& blockquote': {
                  borderLeft: '3px solid',
                  borderColor: 'divider',
                  pl: 1.5,
                  color: 'text.secondary',
                  my: 1,
                },
                '& code': {
                  bgcolor: 'action.hover',
                  px: 0.5,
                  borderRadius: 0.5,
                  fontFamily: 'monospace',
                  fontSize: 13,
                },
                '& a': { color: 'primary.main' },
              }}
            >
              {body ? renderMarkdownPreview(body) : (
                <Typography sx={{ color: 'text.disabled', fontSize: 13 }}>
                  预览区 — 在编辑模式写完后点眼睛图标查看效果
                </Typography>
              )}
            </Box>
          ) : (
            <TextField
              inputRef={bodyRef}
              fullWidth
              multiline
              minRows={15}
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY + 200))}
              placeholder={'# 标题\n\n用 Markdown 写你的文章...\n\n- 支持 **粗体** *斜体* [链接](url)\n- 支持 ## 二级标题 / > 引用 / - 列表\n- 点工具栏图片按钮在光标处插入图片\n- 8000 字上限,超出红色提示'}
              slotProps={{
                htmlInput: {
                  maxLength: MAX_BODY + 200,
                  style: {
                    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                    fontSize: 13,
                    lineHeight: 1.7,
                  },
                },
              }}
            />
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              <Chip
                size="small"
                label="Markdown"
                sx={{ height: 20, fontSize: 10, bgcolor: 'action.hover' }}
              />
              <Chip
                size="small"
                label="自动保存草稿(开发中)"
                sx={{ height: 20, fontSize: 10, bgcolor: 'action.hover', color: 'text.disabled' }}
              />
            </Box>
            <Typography
              sx={{
                fontSize: 11,
                color: body.length > MAX_BODY ? 'error.main' : 'text.secondary',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {body.length} / {MAX_BODY}
            </Typography>
          </Box>
        </Box>

        {/* 右:封面 + 标签 + 提交(5/12) */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* 封面 */}
          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              封面图(选填,推荐 16:9)
            </Typography>
            {cover ? (
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
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
                      p: 2,
                    }}
                  >
                    <LinearProgress sx={{ width: '80%' }} />
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
                    封面上传失败
                  </Box>
                )}
                {cover.status === 'uploaded' && (
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 6,
                      left: 6,
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
                onClick={handleCoverPick}
                role="button"
                tabIndex={0}
                aria-label="上传封面图"
                sx={{
                  width: '100%',
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
                  transition: 'border-color 0.15s, bgcolor 0.15s',
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

          {/* 标签 */}
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
              helperText="例如:技术, 教程, React"
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
              bgcolor: gradient2('#8B5CF6', '#C4B5FD'),
              color: '#FFFFFF',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <DescriptionIcon sx={{ fontSize: 16 }} />
              <Typography sx={{ fontSize: 12, fontWeight: 700 }}>发布须知</Typography>
            </Box>
            <Typography sx={{ fontSize: 11, lineHeight: 1.7, opacity: 0.9 }}>
              提交后进入审核队列,通常 30 分钟内出结果。
              正文支持 Markdown 语法,内嵌图最多 30 张。
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
              background: 'linear-gradient(90deg, #8B5CF6 0%, #FE2C55 100%)',
              '&:hover': { filter: 'brightness(1.08)' },
              '&.Mui-disabled': {
                background: 'action.disabledBackground',
                color: 'text.disabled',
              },
            }}
          >
            {createMutation.isPending ? '提交中...' : '提交文章'}
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

/**
 * 简单 markdown 预览 — 只渲染粗体/斜体/标题/链接/引用/列表/代码/图片。
 * 不依赖第三方库;不解析所有 markdown,只解析文章编辑场景常用的子集。
 * 真实环境文章详情页会用后端渲染好的 HTML,这里是编辑时即时反馈。
 */
function renderMarkdownPreview(src: string) {
  const lines = src.split('\n');
  const blocks: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  const flushList = () => {
    if (listBuffer.length === 0) return;
    blocks.push(
      <Box component="ul" key={`ul-${blocks.length}`} sx={{ pl: 3, m: 0, my: 1 }}>
        {listBuffer.map((it, i) => (
          <li key={i}>{renderInline(it)}</li>
        ))}
      </Box>,
    );
    listBuffer = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^#{1,3}\s+/.test(line)) {
      flushList();
      const level = line.match(/^#+/)?.[0].length ?? 1;
      const text = line.replace(/^#+\s+/, '');
      blocks.push(
        <Box
          key={i}
          component={level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3'}
          sx={{ fontSize: level === 1 ? 20 : level === 2 ? 18 : 16, fontWeight: 700, mt: 2, mb: 1 }}
        >
          {renderInline(text)}
        </Box>,
      );
    } else if (/^>\s+/.test(line)) {
      flushList();
      blocks.push(
        <Box
          key={i}
          component="blockquote"
          sx={{
            borderLeft: '3px solid',
            borderColor: 'divider',
            pl: 1.5,
            color: 'text.secondary',
            my: 1,
          }}
        >
          {renderInline(line.replace(/^>\s+/, ''))}
        </Box>,
      );
    } else if (/^-\s+/.test(line)) {
      listBuffer.push(line.replace(/^-\s+/, ''));
    } else if (line.trim() === '') {
      flushList();
      // 空行:分段
      if (blocks.length > 0) blocks.push(<Box key={`br-${i}`} sx={{ height: 8 }} />);
    } else {
      flushList();
      blocks.push(
        <Box key={i} sx={{ my: 0.5 }}>
          {renderInline(line)}
        </Box>,
      );
    }
  }
  flushList();
  return <>{blocks}</>;
}

function renderInline(text: string): React.ReactNode {
  // 顺序: 图片 ![alt](url) → 链接 [t](url) → 粗体 **t** → 斜体 *t* → 行内代码 `t`
  const tokens: React.ReactNode[] = [];
  let rest = text;
  let key = 0;
  const patterns: Array<[RegExp, (m: RegExpMatchArray) => React.ReactNode]> = [
    [/!\[([^\]]*)\]\(([^)]+)\)/, (m) => <img key={key++} src={m[2]} alt={m[1]} />],
    [/\[([^\]]+)\]\(([^)]+)\)/, (m) => (
      <a key={key++} href={m[2]} target="_blank" rel="noreferrer">
        {m[1]}
      </a>
    )],
    [/\*\*([^*]+)\*\*/, (m) => <strong key={key++}>{m[1]}</strong>],
    [/\*([^*]+)\*/, (m) => <em key={key++}>{m[1]}</em>],
    [/`([^`]+)`/, (m) => <code key={key++}>{m[1]}</code>],
  ];
  // 简单逐字符解析(够用,文章字数 8000 内性能 OK)
  let i = 0;
  while (i < text.length) {
    let matched = false;
    for (const [pat, builder] of patterns) {
      pat.lastIndex = i;
      const m = pat.exec(text);
      if (m && m.index === i) {
        tokens.push(builder(m));
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      // 收集到下一个特殊字符之前的纯文本
      const next = text.slice(i).search(/[!*`\[]/);
      const end = next === -1 ? text.length : i + next;
      tokens.push(text.slice(i, end));
      i = end;
    }
  }
  return <>{tokens}</>;
}

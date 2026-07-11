'use client';

import React, { useState, useRef, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import LinearProgress from '@mui/material/LinearProgress';
import Divider from '@mui/material/Divider';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import FormatQuoteRoundedIcon from '@mui/icons-material/FormatQuoteRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useActiveTab } from '../../ActiveTabContext';
import { useContentForm, normalizeTags, uploadOneFile } from '../../_components/useContentForm';
import { gradient2 } from '@/constants/gradients';

// 新闻发布 (NEWS) — 真实表单。
//
// 字段设计:新闻 vs 文章(article-publish)的核心差异:
//   - 摘要 (desc, 200 字) — 必填,展示在列表页/feed 卡片上
//   - 来源 URL — 选填,放右下角信息源
//   - 正文 (body, 5000 字) — 跟 article 一样 Markdown 排版
//   - 封面 (cover) — 跟 article 一样单图
//   - 标签
// 后续可加:发布时间(定时发布)、相关推荐等
const MAX_TITLE = 40;
const MAX_BODY = 5000;
const MAX_TAGS = 6;
const MAX_SUMMARY = 200;

type CoverStatus = 'idle' | 'uploading' | 'uploaded' | 'failed';

export default function NewsPublishPage() {
  const { setActiveTab } = useActiveTab();
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const sourceRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [body, setBody] = useState('');
  const [source, setSource] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [cover, setCover] = useState<{
    file: File;
    previewUrl: string;
    status: CoverStatus;
    uploadedUrl?: string;
  } | null>(null);

  // 摘要必填(新闻特色 — 没有摘要的平台会显示一大段正文在 feed 里)
  const f = useContentForm<any>({
    contentType: 'NEWS',
    maxTitle: MAX_TITLE,
    maxDesc: 200,
    maxTags: MAX_TAGS,
    requireTitle: true,
    requireDesc: true, // 新闻摘要必填
    onSuccess: () => {
      if (cover?.previewUrl) URL.revokeObjectURL(cover.previewUrl);
      setActiveTab('content');
    },
    validate: () => {
      if (!body.trim()) return '请输入正文内容';
      if (body.length > MAX_BODY) return `正文超出 ${MAX_BODY} 字,请精简`;
      if (source && !/^https?:\/\//.test(source.trim())) {
        return '来源 URL 必须以 http:// 或 https:// 开头';
      }
      if (cover && cover.status !== 'uploaded') return '封面上传未完成,请稍候';
      return null;
    },
    buildPayload: () => ({
      title: f.title.trim(),
      subtitle: f.desc.trim().slice(0, 200),
      content: body.slice(0, MAX_BODY),
      contentType: 'NEWS',
      coverUrl: cover?.uploadedUrl,
      source: source.trim() || undefined,
      sourceLabel: source.trim() ? extractDomain(source.trim()) : undefined,
      status: 'reviewing',
      tags: normalizeTags(f.tags, MAX_TAGS),
    } as any),
  });

  // 工具栏 — 比 article 简化,只保留引用 / 链接 / 代码(新闻最常用的)
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

  const canSubmitFinal = useMemo(
    () =>
      f.canSubmit &&
      body.trim().length > 0 &&
      body.length <= MAX_BODY &&
      (!source || /^https?:\/\//.test(source.trim())) &&
      (cover === null || cover.status === 'uploaded'),
    [f.canSubmit, body, source, cover],
  );

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
            发布新闻
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>
            摘要 {MAX_SUMMARY} 字(必填) · 标题 {MAX_TITLE} 字 · 正文 {MAX_BODY} 字 · 标签 {MAX_TAGS} 个
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
        {/* 左:标题 + 摘要 + 编辑器(7/12) */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField
            inputRef={titleRef}
            fullWidth
            value={f.title}
            onChange={(e) => f.setTitle(e.target.value)}
            placeholder="新闻标题"
            slotProps={{
              htmlInput: {
                maxLength: MAX_TITLE,
                style: { fontSize: 18, fontWeight: 600 },
              },
              formHelperText: { sx: { textAlign: 'right', fontSize: 10, m: 0, mt: 0.25 } },
            }}
            helperText={`${f.title.length} / ${MAX_TITLE}`}
          />

          {/* 摘要(必填,显示在 feed 列表) */}
          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              摘要 <Box component="span" sx={{ color: 'error.main' }}>*</Box>
              <Box component="span" sx={{ color: 'text.disabled', ml: 0.5 }}>
                · 列表/feed 卡片显示这段
              </Box>
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={2}
              size="small"
              value={f.desc}
              onChange={(e) => f.setDesc(e.target.value)}
              placeholder="用 1-3 句话概括这条新闻..."
              slotProps={{
                htmlInput: { maxLength: 200 },
                formHelperText: { sx: { textAlign: 'right', fontSize: 10, m: 0, mt: 0.25 } },
              }}
              helperText={`${f.desc.length} / 200`}
            />
          </Box>

          {/* 工具栏 — 比 article 简化,只保留引用 / 链接 / 代码 */}
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
            }}
          >
            <Tooltip title="引用块(> 引文)">
              <IconButton size="small" onClick={() => insertAtCursor('\n> ')}>
                <FormatQuoteRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="外链 [text](url)">
              <IconButton size="small" onClick={() => wrapSelection('[', '](https://)', '链接文字')}>
                <LinkRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="行内代码 `code`">
              <IconButton size="small" onClick={() => wrapSelection('`', '`', 'code')}>
                <CodeRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
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

          {showPreview ? (
            <Box
              sx={{
                p: 2,
                minHeight: 320,
                borderRadius: 1.5,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                fontSize: 14,
                lineHeight: 1.8,
                color: 'text.primary',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                '& blockquote': {
                  borderLeft: '3px solid',
                  borderColor: 'primary.main',
                  pl: 1.5,
                  color: 'text.secondary',
                  my: 1,
                  bgcolor: 'action.hover',
                  py: 0.5,
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
              minRows={12}
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY + 200))}
              placeholder={'# 副标题\n\n> 引语(可选,放在第一段最有冲击力)\n\n正文段落...支持 [外链](https://) 和 `行内代码`\n\n## 二级标题\n\n更多正文...'}
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
            <Box
              sx={{
                px: 0.75,
                py: 0.25,
                borderRadius: 0.75,
                bgcolor: 'action.hover',
                fontSize: 10,
                fontWeight: 600,
                color: 'text.secondary',
              }}
            >
              Markdown
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

        {/* 右:封面 + 来源 + 标签 + 提交(5/12) */}
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
                onClick={() => coverInputRef.current?.click()}
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

          {/* 来源 URL */}
          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              来源(选填,转自外部新闻时填写)
            </Typography>
            <TextField
              inputRef={sourceRef}
              fullWidth
              size="small"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="https://example.com/article"
              helperText={
                source
                  ? `将显示为:来源 · ${extractDomain(source)}`
                  : 'http:// 或 https:// 开头'
              }
              slotProps={{
                formHelperText: { sx: { fontSize: 10, m: 0, mt: 0.25 } },
              }}
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
              value={f.tags}
              onChange={(e) => f.setTags(e.target.value)}
              placeholder="逗号或空格分隔,最多 6 个"
              helperText="例如:科技, 财经, AI"
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
              bgcolor: gradient2('#F87171', '#FCA5A5'),
              color: '#0F172A',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <ArticleRoundedIcon sx={{ fontSize: 16 }} />
              <Typography sx={{ fontSize: 12, fontWeight: 700 }}>发布须知</Typography>
            </Box>
            <Typography sx={{ fontSize: 11, lineHeight: 1.7, opacity: 0.85 }}>
              新闻审核比普通内容更严(合规性),发布后不可改。
              摘要务必客观准确;正文需有事实依据,避免主观评论。
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
              background: 'linear-gradient(90deg, #F87171 0%, #FE2C55 100%)',
              '&:hover': { filter: 'brightness(1.08)' },
              '&.Mui-disabled': {
                background: 'action.disabledBackground',
                color: 'text.disabled',
              },
            }}
          >
            {f.isPending ? '提交中...' : '提交新闻'}
          </Button>
        </Box>
      </Box>

      {f.renderSnackbar()}
    </Box>
  );
}

// 辅助:从 URL 抽 hostname
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// 极简 markdown 预览(只支持新闻场景子集:引用 / 链接 / 标题 / 代码)
function renderMarkdownPreview(src: string) {
  const lines = src.split('\n');
  const blocks: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^#{1,3}\s+/.test(line)) {
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
      blocks.push(
        <Box
          key={i}
          component="blockquote"
          sx={{
            borderLeft: '3px solid',
            borderColor: 'primary.main',
            pl: 1.5,
            color: 'text.secondary',
            my: 1,
            bgcolor: 'action.hover',
            py: 0.5,
          }}
        >
          {renderInline(line.replace(/^>\s+/, ''))}
        </Box>,
      );
    } else if (line.trim() === '') {
      if (blocks.length > 0) blocks.push(<Box key={`br-${i}`} sx={{ height: 8 }} />);
    } else {
      blocks.push(
        <Box key={i} sx={{ my: 0.5 }}>
          {renderInline(line)}
        </Box>,
      );
    }
  }
  return <>{blocks}</>;
}

function renderInline(text: string): React.ReactNode {
  const tokens: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  const patterns: Array<[RegExp, (m: RegExpMatchArray) => React.ReactNode]> = [
    [/\[([^\]]+)\]\(([^)]+)\)/, (m) => (
      <a key={key++} href={m[2]} target="_blank" rel="noreferrer">
        {m[1]}
      </a>
    )],
    [/`([^`]+)`/, (m) => <code key={key++}>{m[1]}</code>],
  ];
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
      const next = text.slice(i).search(/[`\[]/);
      const end = next === -1 ? text.length : i + next;
      tokens.push(text.slice(i, end));
      i = end;
    }
  }
  return <>{tokens}</>;
}

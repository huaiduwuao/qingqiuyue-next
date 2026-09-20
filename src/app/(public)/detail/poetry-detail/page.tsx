'use client';

// PoetryDetail —— 唐诗宋词详情页。
//
// 改造目标:把详情页拉齐到 article/news 的体验。原先只有标题+作者+正文,
// 现在补齐:头部点赞/收藏、计数行、作者卡、时间行、DetailFooter(打赏+相关推荐)、
// DetailComments。
//
// 后端字段对齐 ClientContentHandler.Detail 的通用响应(view/like/collect/comment
// 来自 Doris module_content 聚合,authorId 来自 module_content.user_id,创作者
// 用于 DetailFooter 的 creatorId)。metadata 是 JSON,前端解析后取 dynasty/rhythmic/form/lines。

import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ShareIcon from '@mui/icons-material/Share';
import ShareButtons from '@/components/share/ShareButtons';
import SettingsIcon from '@mui/icons-material/Settings';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useRouter, useSearchParams } from 'next/navigation';
import { detail as contentDetail, type PoetryDetail } from '@/apis/content-poetry';
import { useContentInteraction } from '@/hooks/useContentInteraction';
import DetailHeader from '@/components/detail/DetailHeader';
import { AsyncState } from '@/components/common/AsyncState';
import { track, recordHistory } from '@/lib/track';
import { ReadingSettings, DEFAULT_PAGE_STYLE, type PageStyle } from '@/components/detail/ReadingSettings';
import { ReadingContainer } from '@/components/detail/ReadingContainer';
import { CollectButton } from '@/components/detail/CollectButton';
import { DetailComments } from '@/components/detail/DetailComments';
import { DetailFooter } from '@/components/detail/DetailFooter';

/** 把 tags 列(逗号分隔字符串)拆成展示数组。后端 tags 有时是字符串、有时是数组,容错。 */
function tagList(raw?: string | string[]): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  const jsonIdx = raw.indexOf('__json=');
  const clean = jsonIdx > 0 ? raw.substring(0, jsonIdx) : raw;
  return clean.split(',').map((s) => s.trim()).filter(Boolean);
}

/** 解析 metadata JSON。后端详情接口的 metadata 字段有时是字符串、有时已经展开。 */
function parseMeta(raw: PoetryDetail['metadata']): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function PoetryDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const query = useQuery({
    queryKey: ['detail', 'poetry', id],
    // 响应拦截器已经把 body.data 剥出来了 —— 直接拿,不要再 .data 一层。
    queryFn: () => contentDetail({ id: id! }) as Promise<PoetryDetail>,
    enabled: !!id,
  });

  // 进入详情:行为埋点 + 观看历史。POETRY 必须大写以匹配 Doris content_type。
  React.useEffect(() => {
    if (id) {
      track(id, 'view', 'POETRY');
      recordHistory(id);
    }
  }, [id]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pageStyle, setPageStyle] = useState<PageStyle>(DEFAULT_PAGE_STYLE);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const notify = useCallback((message: string, severity: 'success' | 'error' | 'info' = 'success') => {
    setSnack({ open: true, message, severity });
  }, []);

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const title = query.data?.title || '诗词';
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        notify('链接已复制到剪贴板');
      } else {
        notify('当前环境不支持分享', 'info');
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        notify('分享失败', 'error');
      }
    }
  };

  const updateStyle = (updates: Partial<PageStyle>) =>
    setPageStyle((prev) => ({ ...prev, ...updates }));

  // 赞:真实状态从 /interaction 读,操作后以服务端为准并给出提示(见 hooks/useContentInteraction)
  const { liked, likeDelta, likeBusy, toggleLike: handleLike } = useContentInteraction(id, { notify });

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DetailHeader
        title={query.data?.title || '诗词'}
        rightActions={
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton onClick={() => setSettingsOpen(true)} sx={{ color: 'text.tertiary' }}>
              <SettingsIcon />
            </IconButton>
            <IconButton
              onClick={handleLike}
              disabled={likeBusy}
              sx={{ color: liked ? 'primary.main' : 'text.tertiary' }}
            >
              {liked ? <ThumbUpIcon /> : <ThumbUpOutlinedIcon />}
            </IconButton>
            <CollectButton contentId={id!} contentType="poetry" />
            <ShareButtons contentType="poetry" contentId={Number(id)} title={query.data?.title ?? 'poetry-detail 详情'} url={typeof window !== 'undefined' ? window.location.href : ''} />
            <IconButton onClick={handleShare} sx={{ color: 'text.tertiary' }}>
              <ShareIcon />
            </IconButton>
          </Box>
        }
      />

      <AsyncState query={query} isEmpty={(d) => !d}>
        {(data) => {
          const tags = tagList(data.tags);
          const meta = parseMeta(data.metadata);
          const dynasty = (meta.dynasty as string) || tags[0] || '';
          const rhythmic = (meta.rhythmic as string) || '';
          const form = (meta.form as string) || '';

          // 头部一行:朝代 · 词牌 · 体裁。后端 publishTime 没填(诗词没创作年份),
          // 这里自己拼一行元数据,行为保持视觉一致。
          const metaLine = [dynasty, rhythmic && `《${rhythmic}》`, form].filter(Boolean).join(' · ');

          return (
            <>
              <Container maxWidth="sm" sx={{ py: 4 }}>
                {/* 朝代标签:从 tags 首项或 metadata.dynasty 取("唐,李白,绝句,...") */}
                {dynasty && (
                  <Chip
                    label={dynasty}
                    size="small"
                    sx={{
                      bgcolor: 'rgba(254, 44, 85, 0.12)',
                      color: 'primary.main',
                      fontWeight: 600,
                      mb: 2,
                    }}
                  />
                )}

                {/* 诗题 —— 居中、突出,呼应中文诗集排版 */}
                <Typography
                  variant="h3"
                  sx={{
                    fontWeight: 800,
                    color: 'text.primary',
                    mb: 1.5,
                    lineHeight: 1.3,
                    fontSize: { xs: 26, sm: 32 },
                    textAlign: 'center',
                  }}
                >
                  {data.title}
                </Typography>

                {/* 作者卡 —— 头像占位 + 姓名(可点进诗人页)+ 简介 + "查看诗人 →" */}
                {data.author && (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      mt: 2,
                      mb: 2,
                      cursor: 'pointer',
                      '&:hover .poet-name': { color: 'primary.main' },
                    }}
                    onClick={() => router.push(`/poetry/poet?name=${encodeURIComponent(data.author!)}`)}
                  >
                    <Avatar sx={{ width: 44, height: 44, bgcolor: 'action.hover', color: 'text.secondary', fontSize: 18 }}>
                      {data.author.slice(0, 1)}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <Typography className="poet-name" sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary' }}>
                        {data.author}
                      </Typography>
                      {data.subtitle && (
                        <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.3 }} noWrap>
                          {data.subtitle}
                        </Typography>
                      )}
                    </Box>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary', display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                      查看诗人 <ChevronRightIcon sx={{ fontSize: 14 }} />
                    </Typography>
                  </Box>
                )}

                {/* 元数据行:朝代 · 词牌 · 体裁 */}
                {metaLine && (
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', textAlign: 'center', mb: 2 }}>
                    {metaLine}
                  </Typography>
                )}

                {/* 计数行:阅读 / 点赞 / 收藏 / 评论 —— 与 article/news 一致 */}
                <CountsRow data={data} likeDelta={likeDelta} onLikeClick={handleLike} />

                <Divider sx={{ my: 2 }} />

                {/* 正文 —— 段间留白,呼应诗的节律。诗词不分段,不加 textIndent */}
                <ReadingContainer style={pageStyle}>
                  <Box
                    sx={{
                      fontSize: '1.15em',
                      lineHeight: 2.2,
                      whiteSpace: 'pre-line', // 保留诗行换行(\n)
                      textAlign: 'center',
                    }}
                  >
                    {data.content}
                  </Box>
                </ReadingContainer>

                {/* 标签(词牌、体裁、行数等) */}
                {tags.length > 1 && (
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 3, mt: 3, justifyContent: 'center' }}>
                    {tags.slice(1).map((t) => (
                      <Chip
                        key={t}
                        label={`#${t}`}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(254, 44, 85, 0.12)',
                          color: 'primary.main',
                          fontWeight: 500,
                        }}
                      />
                    ))}
                  </Box>
                )}

                {/* CC-BY-SA-4.0 合规:诗词来自 chinese-poetry 开源仓,详情页底部保留署名。
                    不可省略 —— 见 internal/crawler/poetry_import.go 注释。 */}
                {data.sourceLabel && (
                  <Typography
                    sx={{
                      fontSize: 11,
                      color: 'text.disabled',
                      textAlign: 'center',
                      mt: 4,
                      pt: 2,
                      borderTop: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    内容来源:{data.sourceLabel}
                  </Typography>
                )}
              </Container>

              {/* 评论区与底部模块宽度拉到 md,正文 sm 保持中文诗的阅读节奏 */}
              <Container maxWidth="md" sx={{ pb: 6 }}>
                <DetailFooter contentId={id!} detail={data} kind="read" />
                <DetailComments contentId={id!} initialCount={data.commentCount || 0} />
              </Container>
            </>
          );
        }}
      </AsyncState>

      <ReadingSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        style={pageStyle}
        onChange={updateStyle}
      />

      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} variant="filled" sx={{ width: '100%' }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

/** 计数行 —— 阅读 / 点赞 / 收藏 / 评论,响应 article/news 的视觉。 */
function CountsRow({
  data,
  likeDelta,
  onLikeClick,
}: {
  data: PoetryDetail;
  likeDelta: number;
  onLikeClick: () => void;
}) {
  const view = data.viewCount ?? 0;
  const like = Math.max(0, (data.likeCount ?? 0) + likeDelta);
  const collect = data.collectCount ?? 0;
  const comment = data.commentCount ?? 0;
  // 全部为零时整行不渲染(数据未到位/接口抖动),避免显示「0 阅读 0 点赞 0 收藏」
  if (view === 0 && like === 0 && collect === 0 && comment === 0) return null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 1, flexWrap: 'wrap' }}>
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
        <VisibilityIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{view.toLocaleString()} 阅读</Typography>
      </Box>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>·</Typography>
      <Box
        component="button"
        onClick={onLikeClick}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          bgcolor: 'transparent',
          border: 'none',
          p: 0,
          cursor: 'pointer',
          color: 'text.secondary',
          '&:hover': { color: 'primary.main' },
        }}
      >
        <ThumbUpOutlinedIcon sx={{ fontSize: 14 }} />
        <Typography sx={{ fontSize: 12 }}>{like.toLocaleString()} 点赞</Typography>
      </Box>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>·</Typography>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{collect.toLocaleString()} 收藏</Typography>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>·</Typography>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{comment.toLocaleString()} 评论</Typography>
    </Box>
  );
}

export default function PoetryDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <PoetryDetailContent />
    </React.Suspense>
  );
}
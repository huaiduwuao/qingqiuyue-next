'use client';

import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import ShareIcon from '@mui/icons-material/Share';
import SettingsIcon from '@mui/icons-material/Settings';
import { useRouter, useSearchParams } from 'next/navigation';
import { detail as contentDetail } from '@/apis/content-poetry';
import { formatApiError } from '@/lib/api/client';
import DetailHeader from '@/components/detail/DetailHeader';
import { AsyncState } from '@/components/common/AsyncState';
import { track, recordHistory } from '@/lib/track';
import { ReadingSettings, DEFAULT_PAGE_STYLE, type PageStyle } from '@/components/detail/ReadingSettings';
import { ReadingContainer } from '@/components/detail/ReadingContainer';

// PoetryDetail —— 唐诗宋词详情数据。
//
// 后端 ClientContentHandler.Detail 返回的 JSON 字段对齐 Doris module_content 列。
// author/tags/sourceLabel 字段在通用 detail 端点都会回传;metadata 是 JSON 字符串,
// 解开后取 dynasty/rhythmic/lines。
interface PoetryDetail {
  id: number;
  title: string;
  author: string;
  content: string;
  tags?: string[];
  sourceLabel?: string;
  metadata?: string; // JSON 字符串,前端可解析
}

function PoetryDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const query = useQuery({
    queryKey: ['detail', 'poetry', id],
    // 响应拦截器已经把 body.data 剥出来了 —— 这里再取一层 .data 会拿到 undefined,
    // react-query 收到 undefined 直接判定查询失败。见 src/lib/api/client.ts 的收敛注释。
    queryFn: () => contentDetail({ id: id! }) as Promise<Partial<PoetryDetail>>,
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

  // 把 tags 列(逗号分隔字符串)拆成展示数组。
  // 后端 ClientContentHandler 有时把 tags 拆成数组,有时原样字符串 —— 容错处理。
  const tagList = (raw?: string | string[]): string[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    // tags 字段可能含 __json={...} 后缀(见 content_service.fitTags),剥掉
    const jsonIdx = raw.indexOf('__json=');
    const clean = jsonIdx > 0 ? raw.substring(0, jsonIdx) : raw;
    return clean.split(',').map((s) => s.trim()).filter(Boolean);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DetailHeader
        title={query.data?.title || '诗词'}
        rightActions={
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton onClick={() => setSettingsOpen(true)} sx={{ color: 'text.tertiary' }}>
              <SettingsIcon />
            </IconButton>
            <IconButton onClick={handleShare} sx={{ color: 'text.tertiary' }}>
              <ShareIcon />
            </IconButton>
          </Box>
        }
      />

      <AsyncState query={query} isEmpty={(d) => !d}>
        {(data) => {
          const tags = tagList(data.tags as any);
          return (
            <Container maxWidth="sm" sx={{ py: 4 }}>
              {/* 朝代标签:从 tags 首项取("唐,李白,绝句,...") */}
              {tags[0] && (
                <Chip
                  label={tags[0]}
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
                  mb: 2,
                  lineHeight: 1.3,
                  fontSize: { xs: 26, sm: 32 },
                  textAlign: 'center',
                }}
              >
                {data.title}
              </Typography>

              {/* 作者 —— 居中,点进诗人页(按名字找,诗与诗人两边用字同源) */}
              {data.author && (
                <Typography
                  onClick={() => router.push(`/poetry/poet?name=${encodeURIComponent(data.author!)}`)}
                  sx={{
                    fontSize: 15,
                    color: 'text.secondary',
                    mb: 3,
                    textAlign: 'center',
                    cursor: 'pointer',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  —— {data.author}
                </Typography>
              )}

              <Divider sx={{ my: 2 }} />

              {/* 正文 —— 段间留白,呼应诗的节律 */}
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

export default function PoetryDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <PoetryDetailContent />
    </React.Suspense>
  );
}
'use client';

// 人物详情 —— 主播(以及以后的演员/歌手/作者)的目录页。
//
// 人物和作品都是 module_content 里的条目。作品分两层:
//   - works:后端按 metadata.streamer_id 精确关联到这个人的(TA 的直播间)
//   - 相关内容:按名字全站检索的近似结果(切片、回放、提到 TA 的文章……),
//     不保证都是 TA 本人 —— 索引的目标是「找得到」,近似相关就够用。

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import ShareIcon from '@mui/icons-material/Share';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { detail as personDetail } from '@/apis/content-person';
import { searchContent } from '@/apis/search';
import DetailHeader from '@/components/detail/DetailHeader';
import { DetailComments } from '@/components/detail/DetailComments';
import { AsyncState } from '@/components/common/AsyncState';
import { CoverImage } from '@/components/common/CoverImage';
import { track, recordHistory } from '@/lib/track';
import { TYPE_LABEL, useContentNavigate } from '@/lib/contentRoute';
import { mediaUrl } from '@/lib/media';

interface PersonWork {
  id: number | string;
  title: string;
  cover?: string;
  contentType: string;
  isLive?: boolean;
}

interface PersonMeta {
  roles?: string[];
  platformLabel?: string;
  room_url?: string;
  category?: string;
  avatar?: string;
}

interface PersonDetail {
  id: number | string;
  title: string;
  cover?: string;
  content?: string;
  source?: string;
  sourceUrl?: string;
  metadata?: PersonMeta;
  works?: PersonWork[];
  commentCount?: number;
}

const ROLE_LABEL: Record<string, string> = {
  streamer: '主播',
};

function httpLink(...urls: Array<string | undefined>): string {
  return urls.find((u) => !!u && /^https?:\/\//.test(u)) || '';
}

function WorkGrid({ items, onOpen }: { items: PersonWork[]; onOpen: (w: PersonWork) => void }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 1.5 }}>
      {items.map((w) => (
        <Box
          key={String(w.id)}
          role="button"
          tabIndex={0}
          onClick={() => onOpen(w)}
          onKeyDown={(e) => e.key === 'Enter' && onOpen(w)}
          sx={{
            cursor: 'pointer',
            borderRadius: 2,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            transition: 'border-color 0.15s',
            '&:hover': { borderColor: 'primary.main' },
          }}
        >
          <Box sx={{ position: 'relative', aspectRatio: '16 / 9', bgcolor: 'action.hover' }}>
            <CoverImage src={w.cover || ''} alt={w.title} sx={{ width: '100%', height: '100%' }} />
            {w.isLive && (
              <Box
                sx={{
                  position: 'absolute', top: 6, left: 6, px: 0.75, py: 0.25, borderRadius: 0.75,
                  bgcolor: 'primary.main', color: '#fff', fontSize: 10, fontWeight: 800,
                }}
              >
                直播中
              </Box>
            )}
            <Box
              sx={{
                position: 'absolute', bottom: 6, right: 6, px: 0.75, py: 0.25, borderRadius: 0.75,
                bgcolor: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 10, fontWeight: 600,
              }}
            >
              {TYPE_LABEL[w.contentType] || w.contentType}
            </Box>
          </Box>
          <Typography sx={{ fontSize: 13, color: 'text.primary', p: 1 }} noWrap>
            {w.title}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function PersonDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const navigate = useContentNavigate();
  const [snack, setSnack] = React.useState<{ open: boolean; message: string }>({ open: false, message: '' });

  const query = useQuery({
    queryKey: ['detail', 'person', id],
    queryFn: () => personDetail({ id: id! }).then((r) => r.data as PersonDetail),
    enabled: !!id,
  });

  const name = query.data?.title?.trim() || '';
  const related = useQuery({
    queryKey: ['person-related', name],
    queryFn: () => searchContent(name, { size: 30 }).then((r) => (r?.data?.list ?? []) as PersonWork[]),
    enabled: name.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  React.useEffect(() => {
    if (id) {
      track(id, 'view', 'PERSON');
      recordHistory(id);
    }
  }, [id]);

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (navigator.share) {
        await navigator.share({ title: name || '人物', url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setSnack({ open: true, message: '链接已复制到剪贴板' });
      }
    } catch {
      // 用户取消分享,什么都不做
    }
  };

  const open = (w: PersonWork) => navigate(w.contentType, w.id);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DetailHeader
        title={name || '人物'}
        rightActions={
          <IconButton onClick={handleShare} sx={{ color: 'text.tertiary' }} aria-label="分享">
            <ShareIcon />
          </IconButton>
        }
      />

      <AsyncState query={query} isEmpty={(d) => !d}>
        {(data) => {
          const md = data.metadata || {};
          const roles = md.roles || [];
          const platform = md.platformLabel || '';
          const roomUrl = httpLink(md.room_url, data.sourceUrl, data.source);
          const works = data.works || [];
          const linked = new Set([String(data.id), ...works.map((w) => String(w.id))]);
          const relatedHits = (related.data || []).filter((h) => !linked.has(String(h.id)));
          const isStreamer = roles.includes('streamer');
          const intro = (data.content || '').trim();

          return (
            <Container maxWidth="lg" sx={{ py: 3 }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mb: 2 }}>
                <Avatar
                  src={mediaUrl(data.cover || md.avatar) || undefined}
                  slotProps={{ img: { referrerPolicy: 'no-referrer' } }}
                  sx={{ width: 72, height: 72, fontSize: 28 }}
                >
                  {name.slice(0, 1)}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 160 }}>
                  <Typography sx={{ fontSize: { xs: 22, sm: 26 }, fontWeight: 800, color: 'text.primary', lineHeight: 1.3 }}>
                    {name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
                    {roles.map((r) => (
                      <Chip
                        key={r}
                        label={ROLE_LABEL[r] || r}
                        size="small"
                        sx={{ bgcolor: 'rgba(254, 44, 85, 0.12)', color: 'primary.main', fontWeight: 600 }}
                      />
                    ))}
                    {platform && <Chip label={platform} size="small" variant="outlined" />}
                    {md.category && <Chip label={md.category} size="small" variant="outlined" />}
                  </Box>
                </Box>
                {roomUrl && (
                  <Button
                    variant="outlined"
                    href={roomUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    endIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
                    sx={{ textTransform: 'none' }}
                  >
                    {isStreamer ? `去${platform || '原站'}直播间` : '去原站'}
                  </Button>
                )}
              </Box>

              {intro && (
                <Typography sx={{ color: 'text.tertiary', fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                  {intro}
                </Typography>
              )}

              <Divider sx={{ borderColor: 'divider', my: 3 }} />

              <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 700, mb: 1.5 }}>
                {isStreamer ? '直播间' : '作品'}
                <Box component="span" sx={{ fontSize: 13, color: 'text.secondary', ml: 1, fontWeight: 400 }}>
                  {works.length}
                </Box>
              </Typography>
              {works.length > 0 ? (
                <WorkGrid items={works} onOpen={open} />
              ) : (
                <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>暂无收录</Typography>
              )}

              <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 700, mt: 4, mb: 0.5 }}>
                相关内容
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1.5 }}>
                按名字在全站检索,可能包含同名或提到 TA 的内容
              </Typography>
              {related.isLoading ? (
                <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>检索中…</Typography>
              ) : relatedHits.length > 0 ? (
                <WorkGrid items={relatedHits} onOpen={open} />
              ) : (
                <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>暂无相关内容</Typography>
              )}

              <Divider sx={{ borderColor: 'divider', my: 3 }} />
              <DetailComments contentId={id!} initialCount={data.commentCount || 0} />
            </Container>
          );
        }}
      </AsyncState>

      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" sx={{ width: '100%' }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default function PersonDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <PersonDetailContent />
    </React.Suspense>
  );
}

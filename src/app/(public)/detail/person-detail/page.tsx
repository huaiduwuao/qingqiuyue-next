'use client';

// 人物详情 —— 主播、演员、导演、歌手、作者的目录页。
//
// 人物和作品都是 module_content 里的条目。作品分三层:
//   - works:后端明确关联到这个人的 —— 主播的直播间(metadata.streamer_id),以及人物收录
//     (spider-api internal/personindex)写进 person_work 的作品(带角色、年份);
//   - filmography:维基数据作品年表,含站内还没收录的(点了去搜);
//   - 相关内容:按名字全站检索的近似结果(切片、回放、提到 TA 的文章……),
//     不保证都是 TA 本人 —— 索引的目标是「找得到」,近似相关就够用。

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
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
import ShareButtons from '@/components/share/ShareButtons';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { detail as personDetail } from '@/apis/content-person';
import { searchContent } from '@/apis/search';
import DetailHeader from '@/components/detail/DetailHeader';
import { DetailComments } from '@/components/detail/DetailComments';
import { AsyncState } from '@/components/common/AsyncState';
import { CoverImage } from '@/components/common/CoverImage';
import { PlayTag } from '@/components/common/PlayTag';
import { ListLayout, LIST_ROW } from '@/components/common/ListLayout';
import { track, recordHistory } from '@/lib/track';
import { TYPE_LABEL, useContentNavigate } from '@/lib/contentRoute';
import { mediaUrl } from '@/lib/media';

interface PersonWork {
  id: number | string;
  title: string;
  cover?: string;
  contentType: string;
  isLive?: boolean;
  /** 搜索结果(相关内容)自带的 playability 状态;直播间列表没有,PlayTag 自己去问 */
  availability?: string;
  /** 在作品里的角色(导演,演员……)与年份,来自 person_work */
  role?: string;
  year?: number;
}

/** 维基数据人物资料(后端 attachPersonProfile) */
interface PersonProfile {
  kind?: string;
  roles?: string[];
  occupations?: string[];
  aliases?: string[];
  enName?: string;
  birth?: string;
  death?: string;
  wikidataId?: string;
}

interface FilmographyItem {
  title: string;
  year?: number;
  kind: string;
  roles?: string[];
  contentId?: string;
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
  person?: PersonProfile;
  filmography?: FilmographyItem[];
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
    <ListLayout minColumnWidth={160} gap={12}>
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
            [LIST_ROW]: { display: 'flex', alignItems: 'stretch' },
          }}
        >
          <Box sx={{ position: 'relative', aspectRatio: '16 / 9', bgcolor: 'action.hover', [LIST_ROW]: { width: { xs: 120, sm: 200 }, flexShrink: 0 } }}>
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
            <PlayTag id={w.id} contentType={w.contentType} status={w.availability} variant="overlay" top={6} right={6} />
          </Box>
          <Box sx={{ minWidth: 0, [LIST_ROW]: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' } }}>
            <Typography sx={{ fontSize: 13, color: 'text.primary', p: 1, pb: w.role || w.year ? 0 : 1, [LIST_ROW]: { fontSize: 14, px: 1.5 } }} noWrap>
              {w.title}
            </Typography>
            {(w.role || w.year) && (
              <Typography sx={{ fontSize: 11.5, color: 'text.secondary', px: 1, pb: 1, [LIST_ROW]: { px: 1.5 } }} noWrap>
                {[w.year || '', w.role || ''].filter(Boolean).join(' · ')}
              </Typography>
            )}
          </Box>
        </Box>
      ))}
    </ListLayout>
  );
}

function PersonDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const navigate = useContentNavigate();
  const router = useRouter();
  const [kind, setKind] = React.useState('');
  const [showAllFilm, setShowAllFilm] = React.useState(false);
  const [snack, setSnack] = React.useState<{ open: boolean; message: string }>({ open: false, message: '' });

  const query = useQuery({
    queryKey: ['detail', 'person', id],
    queryFn: () => personDetail({ id: id! }).then((r) => r as PersonDetail),
    enabled: !!id,
  });

  const name = query.data?.title?.trim() || '';
  const related = useQuery({
    queryKey: ['person-related', name],
    queryFn: () => searchContent(name, { size: 30 }).then((r) => (r?.list ?? []) as PersonWork[]),
    enabled: name.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  React.useEffect(() => {
    if (id) {
      track(id, 'view', 'PERSON');
      recordHistory(id);
    }
  }, [id]);

  const open = (w: PersonWork) => navigate(w.contentType, w.id);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DetailHeader
        title={name || '人物'}
        rightActions={
          <>
            <ShareButtons variant="icon" contentType="person" contentId={id ?? ''} title={name || '人物'} url={typeof window !== 'undefined' ? window.location.href : ''} />
          </>
        }
      />

      <AsyncState query={query} isEmpty={(d) => !d}>
        {(data) => {
          const md = data.metadata || {};
          const roles = md.roles || [];
          const platform = md.platformLabel || '';
          const roomUrl = httpLink(md.room_url, data.sourceUrl, data.source);
          const works = data.works || [];
          const profile = data.person || {};
          const filmography = data.filmography || [];
          const kindCounts = works.reduce<Record<string, number>>((m, w) => {
            m[w.contentType] = (m[w.contentType] || 0) + 1;
            return m;
          }, {});
          const kinds = Object.entries(kindCounts).sort((a, b) => b[1] - a[1]);
          const shownWorks = kind ? works.filter((w) => w.contentType === kind) : works;
          const film = showAllFilm ? filmography : filmography.slice(0, 30);
          const facts = [
            profile.enName,
            profile.birth && (profile.death ? `${profile.birth} — ${profile.death}` : `${profile.birth} 出生`),
            profile.occupations?.slice(0, 5).join(' / '),
          ].filter(Boolean) as string[];
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

              {facts.length > 0 && (
                <Typography sx={{ color: 'text.secondary', fontSize: 13, mb: 1 }}>{facts.join(' · ')}</Typography>
              )}
              {intro && (
                <Typography sx={{ color: 'text.tertiary', fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                  {intro}
                </Typography>
              )}
              {!!profile.aliases?.length && (
                <Typography sx={{ color: 'text.secondary', fontSize: 12, mt: 1 }}>
                  又名:{profile.aliases.slice(0, 8).join('、')}
                </Typography>
              )}

              <Divider sx={{ borderColor: 'divider', my: 3 }} />

              <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 700, mb: 1.5 }}>
                {isStreamer ? '直播间' : '作品'}
                <Box component="span" sx={{ fontSize: 13, color: 'text.secondary', ml: 1, fontWeight: 400 }}>
                  {works.length}
                </Box>
              </Typography>
              {kinds.length > 1 && (
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
                  <Chip
                    label={`全部 ${works.length}`}
                    size="small"
                    color={kind ? 'default' : 'primary'}
                    variant={kind ? 'outlined' : 'filled'}
                    onClick={() => setKind('')}
                  />
                  {kinds.map(([t, n]) => (
                    <Chip
                      key={t}
                      label={`${TYPE_LABEL[t] || t} ${n}`}
                      size="small"
                      color={kind === t ? 'primary' : 'default'}
                      variant={kind === t ? 'filled' : 'outlined'}
                      onClick={() => setKind(kind === t ? '' : t)}
                    />
                  ))}
                </Box>
              )}
              {works.length > 0 ? (
                <WorkGrid items={shownWorks} onOpen={open} />
              ) : (
                <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>暂无收录</Typography>
              )}

              {filmography.length > 0 && (
                <>
                  <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 700, mt: 4, mb: 0.5 }}>
                    作品年表
                    <Box component="span" sx={{ fontSize: 13, color: 'text.secondary', ml: 1, fontWeight: 400 }}>
                      {filmography.length}
                    </Box>
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1.5 }}>
                    来自维基数据;站内还没收录的点一下去搜
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    {film.map((f, i) => (
                      <Box
                        key={`${f.title}-${f.year}-${i}`}
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          f.contentId ? navigate(f.kind, f.contentId) : router.push(`/search?q=${encodeURIComponent(f.title)}`)
                        }
                        sx={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: 1.5,
                          py: 0.75,
                          px: 0.5,
                          cursor: 'pointer',
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                      >
                        <Typography sx={{ width: 40, flexShrink: 0, fontSize: 12, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                          {f.year || '—'}
                        </Typography>
                        <Typography sx={{ flex: 1, minWidth: 0, fontSize: 14, color: 'text.primary' }} noWrap>
                          {f.title}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: 'text.secondary', flexShrink: 0, display: { xs: 'none', sm: 'block' } }} noWrap>
                          {[TYPE_LABEL[f.kind] || f.kind, ...(f.roles || []).slice(0, 2)].join(' · ')}
                        </Typography>
                        <Typography sx={{ fontSize: 11, flexShrink: 0, color: f.contentId ? 'primary.main' : 'text.disabled' }}>
                          {f.contentId ? '已收录' : '去搜'}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                  {filmography.length > film.length && (
                    <Button size="small" onClick={() => setShowAllFilm(true)} sx={{ mt: 1, textTransform: 'none' }}>
                      展开全部 {filmography.length} 部
                    </Button>
                  )}
                </>
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

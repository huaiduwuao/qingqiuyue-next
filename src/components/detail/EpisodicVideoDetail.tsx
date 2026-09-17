'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ShareIcon from '@mui/icons-material/Share';
import StarIcon from '@mui/icons-material/Star';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useContentInteraction } from '@/hooks/useContentInteraction';
import { reportContent } from '@/apis/global';
import { postShare } from '@/apis/behavior';
import { usableDirectUrl } from '@/apis/stream';
import { formatApiError } from '@/lib/api/client';
import { TYPE_LABEL } from '@/lib/contentType.gen';
import VideoPlayer from '@/components/detail/VideoPlayer';
import { PlatformLinks, UnavailablePlayer, platformsOf, linkOutNoticeOf } from '@/components/detail/ExternalPlatforms';
import DetailHeader from '@/components/detail/DetailHeader';
import { AsyncState } from '@/components/common/AsyncState';
import { track, recordHistory } from '@/lib/track';
import { DetailComments } from '@/components/detail/DetailComments';
import { DetailFooter } from '@/components/detail/DetailFooter';
import { CollectButton } from '@/components/detail/CollectButton';
import { EpisodeList } from '@/components/detail/EpisodeList';
import { episodeTitle, useContentItems, type ContentItem } from '@/hooks/useContentItems';

/** 分集类视频详情(电视剧/短剧、动漫、综艺)的接口字段;爬虫数据经常缺字段,全部可选。 */
export interface EpisodicDetail {
  id?: string | number;
  title?: string;
  cover?: string;
  source?: string;
  sourceUrl?: string;
  contentType?: string;
  director?: string | string[];
  actors?: string | string[];
  host?: string | string[];
  guests?: string | string[];
  genre?: string | string[];
  area?: string | string[];
  region?: string | string[];
  year?: string | number | string[];
  rating?: number | string;
  description?: string;
  content?: string;
  totalEpisodes?: number | string;
  status?: string;
  likeCount?: number;
  collectCount?: number;
  commentCount?: number;
  /** 全网检索收录:本站播不了的原因 + 各平台入口(见 ExternalPlatforms) */
  playNotice?: string;
  platforms?: unknown;
}

type PeopleKey = 'director' | 'actors' | 'host' | 'guests';

export interface EpisodicVideoConfig {
  kind: 'teleplay' | 'animation' | 'vshow';
  /** 行为埋点的 itemType,大写以匹配 Doris content_type */
  trackType: string;
  /** 详情接口没给 contentType 时用的类型名 */
  typeLabel: string;
  /** 计量单位:集 / 话 / 期 */
  unit: string;
  listVariant: 'grid' | 'list';
  listTitle: string;
  introTitle: string;
  people: { label: string; key: PeopleKey }[];
  initialDuration: number;
  fetchDetail: (id: string) => Promise<unknown>;
  fetchItems: (params: Record<string, unknown>) => Promise<unknown>;
}

/** 这些是后台流转状态,不是给观众看的"连载中/已完结"。 */
const INTERNAL_STATUS = new Set(['active', 'PUBLISH', 'UN_PUBLISH', 'REVIEWING', 'REJECTED', 'DRAFT']);

function toList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
  if (typeof v === 'string' || typeof v === 'number') {
    return String(v).split(/[,，、/]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function httpUrl(...candidates: (string | undefined)[]): string {
  return candidates.find((u) => !!u && /^https?:\/\//.test(u)) ?? '';
}

type Severity = 'success' | 'error' | 'info';

export function EpisodicVideoDetail({ config }: { config: EpisodicVideoConfig }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const episodeParam = searchParams.get('episodeId');

  const query = useQuery({
    queryKey: ['detail', config.kind, id],
    queryFn: () => config.fetchDetail(id!).then((r) => ((r as { data?: EpisodicDetail } | undefined)?.data ?? null)),
    enabled: !!id,
  });
  const itemsQuery = useContentItems(config.kind, id, config.fetchItems);
  const items = useMemo(() => itemsQuery.data?.items ?? [], [itemsQuery.data]);

  // 进入详情:行为埋点(供榜单/推荐)+ 写观看历史。
  useEffect(() => {
    if (id) {
      track(id, 'view', config.trackType);
      recordHistory(id);
    }
  }, [id, config.trackType]);

  const [activeId, setActiveId] = useState<string | null>(episodeParam);
  const found = items.findIndex((it) => it.id === activeId);
  const activeIndex = found >= 0 ? found : 0;
  const active: ContentItem | undefined = items[activeIndex];

  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: Severity }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const notify = useCallback((message: string, severity: Severity = 'success') => {
    setSnack({ open: true, message, severity });
  }, []);

  // 赞:真实状态从 /interaction 读,操作后以服务端为准并给出提示(见 hooks/useContentInteraction)
  const { liked, likeDelta: optimisticLikes, likeBusy, toggleLike: handleLike } = useContentInteraction(id, { notify });

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const title = query.data?.title || `${config.typeLabel}详情`;
    try {
      // 分享计数:后端记录(供排行榜/传播效果统计)
      postShare({ contentId: id ? parseInt(id) : 0 }).catch(() => {});
      if (navigator.share) {
        await navigator.share({ title, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        notify('链接已复制到剪贴板');
      } else {
        notify('当前环境不支持分享', 'info');
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') notify('分享失败', 'error');
    }
  };

  // 选集:地址栏带上 episodeId,刷新/分享后停在同一集。
  const selectEpisode = useCallback(
    (item: ContentItem, scroll = true) => {
      setActiveId(item.id);
      if (item.locked) notify(`该${config.unit}需解锁后观看`, 'info');
      if (id) {
        router.replace(`${pathname}?id=${encodeURIComponent(id)}&episodeId=${encodeURIComponent(item.id)}`, { scroll: false });
      }
      if (scroll && typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [config.unit, id, notify, pathname, router],
  );

  const handleEnded = useCallback(() => {
    const next = items[activeIndex + 1];
    if (next && !next.locked) selectEpisode(next, false);
  }, [items, activeIndex, selectEpisode]);

  // 某一集解析播放失败时自动举报,让"暂时无法播放"在后台审核队列里有真实落点;
  // 同一集在页面生命周期内只报一次。
  const reported = useRef(new Set<string>());
  const handlePlaybackError = useCallback(
    (message: string) => {
      if (!id || !active || reported.current.has(active.id)) return;
      reported.current.add(active.id);
      reportContent({
        targetId: id,
        targetType: config.trackType,
        // playback = 播放故障上报,不是违规举报:管理端「通过」它只是结单,不会下架内容。
        kind: 'playback',
        reason: `[自动] 第${activeIndex + 1}${config.unit}播放解析失败: ${message}`,
      }).catch(() => {});
    },
    [id, active, activeIndex, config.trackType, config.unit],
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DetailHeader
        title={query.data?.title || `${config.typeLabel}详情`}
        rightActions={
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton onClick={handleLike} disabled={likeBusy} sx={{ color: liked ? 'primary.main' : 'text.tertiary' }}>
              {liked ? <ThumbUpIcon /> : <ThumbUpOutlinedIcon />}
            </IconButton>
            <CollectButton contentId={id!} contentType={config.kind} />
            <IconButton onClick={handleShare} sx={{ color: 'text.tertiary' }}>
              <ShareIcon />
            </IconButton>
          </Box>
        }
      />

      <AsyncState query={query} isEmpty={(d) => !d}>
        {(loaded) => {
          // isEmpty 已经把 null 挡在外面,这里一定有数据。
          const data = loaded as EpisodicDetail;
          const typeLabel = (data.contentType && TYPE_LABEL[data.contentType]) || config.typeLabel;
          const sourceLink = httpUrl(data.sourceUrl, data.source);
          const genres = toList(data.genre);
          const rating = Number(data.rating);
          const total = Number(data.totalEpisodes) || items.length;
          const meta = [
            toList(data.area ?? data.region).join(' / '),
            toList(data.year)[0],
            total > 0 ? `共${total}${config.unit}` : '',
          ].filter(Boolean);
          const people = config.people
            .map((p) => ({ label: p.label, value: toList(data[p.key]).join(' / ') }))
            .filter((p) => p.value);
          const intro = (data.description || data.content || '').trim();
          // 还没有分集时退回整部内容的来源地址,能解析就先放着(比如单集番剧页)。
          const fallbackSource = items.length === 0 ? sourceLink : '';
          // 分集页面地址:既是没有可用直链时的解析源,也是直链失效后重新解析的依据。
          const episodePage = active?.url || fallbackSource;
          const direct = usableDirectUrl(active?.playUrl, active?.url);
          const platforms = platformsOf(data);
          // 没有分集、只有会员/付费平台:不交给播放器硬解析,直接说明原因。
          const unavailable = items.length === 0 ? linkOutNoticeOf(data, fallbackSource) : '';

          return (
            <>
              <Box sx={{ bgcolor: '#000' }}>
                <Container maxWidth="lg" sx={{ py: 0 }}>
                  {unavailable ? (
                    <UnavailablePlayer notice={unavailable} platforms={platforms} poster={data.cover} />
                  ) : (
                  <VideoPlayer
                    key={active?.id ?? 'source'}
                    src={direct}
                    sourceUrl={direct ? undefined : episodePage}
                    refreshSource={episodePage}
                    poster={active?.cover || data.cover}
                    initialDuration={config.initialDuration}
                    autoPlay={false}
                    onEnded={handleEnded}
                    onPlaybackError={handlePlaybackError}
                    dockTitle={active ? `${data.title || ''} · 第${activeIndex + 1}${config.unit}` : data.title || '视频'}
                  />
                  )}
                </Container>
              </Box>

              <Container maxWidth="lg" sx={{ py: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: { xs: 20, sm: 24, md: 32 }, color: 'text.primary', mb: 1, lineHeight: 1.3 }}>
                      {data.title}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Chip label={typeLabel} size="small" sx={{ bgcolor: 'rgba(254, 44, 85, 0.12)', color: 'primary.main', fontWeight: 600 }} />
                      {genres.filter((g) => g !== typeLabel).map((g) => (
                        <Chip key={g} label={g} size="small" variant="outlined" />
                      ))}
                      {data.status && !INTERNAL_STATUS.has(data.status) && (
                        <Chip label={data.status} size="small" sx={{ bgcolor: 'rgba(93,219,150,0.15)', color: 'success.main', fontWeight: 600 }} />
                      )}
                      {meta.length > 0 && (
                        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{meta.join(' · ')}</Typography>
                      )}
                    </Box>
                    {active && (
                      <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 1.5 }} noWrap>
                        正在播放:第{activeIndex + 1}{config.unit}
                        {episodeTitle(active, activeIndex) ? ` · ${episodeTitle(active, activeIndex)}` : ''}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ textAlign: 'center', flexShrink: 0 }}>
                    {rating > 0 && (
                      <>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'warning.main' }}>
                          <StarIcon sx={{ fontSize: 20 }} />
                          <Typography sx={{ fontSize: 28, fontWeight: 800, color: 'warning.main' }}>{rating.toFixed(1)}</Typography>
                        </Box>
                        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>评分</Typography>
                      </>
                    )}
                    <Box
                      onClick={handleLike}
                      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mt: 1, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
                    >
                      {liked ? <ThumbUpIcon sx={{ fontSize: 14, color: 'primary.main' }} /> : <ThumbUpOutlinedIcon sx={{ fontSize: 14 }} />}
                      <Typography sx={{ fontSize: 12, color: liked ? 'primary.main' : 'text.secondary' }}>
                        {Math.max(0, (data.likeCount || 0) + optimisticLikes).toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                <PlatformLinks platforms={platforms} dense />

                {people.length > 0 && (
                  <>
                    <Divider sx={{ borderColor: 'divider', my: 2 }} />
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1.5, mb: 1 }}>
                      {people.map((p) => (
                        <Box key={p.label}>
                          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{p.label}</Typography>
                          <Typography sx={{ fontSize: 14, color: 'text.primary', mt: 0.5 }}>{p.value}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </>
                )}

                {intro && (
                  <>
                    <Typography variant="h6" sx={{ color: 'text.primary', mt: 2, mb: 1.5, fontWeight: 700 }}>
                      {config.introTitle}
                    </Typography>
                    <Typography sx={{ color: 'text.tertiary', fontSize: 14, lineHeight: 1.8, mb: 1, textIndent: '2em', whiteSpace: 'pre-line' }}>
                      {intro}
                    </Typography>
                  </>
                )}

                <Divider sx={{ borderColor: 'divider', my: 3 }} />

                <EpisodeList
                  title={config.listTitle}
                  items={items}
                  activeId={active?.id}
                  onSelect={(item) => selectEpisode(item)}
                  unit={config.unit}
                  variant={config.listVariant}
                  loading={itemsQuery.isLoading}
                  backfilling={itemsQuery.data?.backfilling}
                  empty={
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      暂无{config.unit}列表
                      {!unavailable && sourceLink && platforms.length === 0 && (
                        <Button size="small" href={sourceLink} target="_blank" rel="noopener noreferrer" endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}>
                          去原站观看
                        </Button>
                      )}
                    </Box>
                  }
                />

                <DetailFooter contentId={id!} detail={data} kind="watch" />
                <DetailComments contentId={id!} initialCount={data.commentCount || 0} />

                <Divider sx={{ borderColor: 'divider', my: 3 }} />
              </Container>
            </>
          );
        }}
      </AsyncState>

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

export default EpisodicVideoDetail;

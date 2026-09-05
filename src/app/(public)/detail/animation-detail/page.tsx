'use client';

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
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ShareIcon from '@mui/icons-material/Share';
import StarIcon from '@mui/icons-material/Star';
import LockIcon from '@mui/icons-material/Lock';
import { useSearchParams } from 'next/navigation';
import { detail as contentDetail } from '@/apis/content-animation';
import { page as itemPage } from '@/apis/content-animation-item';
import { moduleContentAction } from '@/apis/home';
import { reportContent } from '@/apis/global';
import { formatApiError } from '@/lib/api/client';
import VideoPlayer from '@/components/detail/VideoPlayer';
import DetailHeader from '@/components/detail/DetailHeader';
import { AsyncState } from '@/components/common/AsyncState';
import { track, recordHistory } from '@/lib/track';
import { DetailComments } from '@/components/detail/DetailComments';
import { CollectButton } from '@/components/detail/CollectButton';

interface AnimeItem {
  id: string | number;
  title: string;
  num: string;
  url?: string;
  collected?: boolean;
}

interface Animation {
  id: number;
  title: string;
  cover: string;
  source?: string;
  director: string;
  actors: string[];
  genre: string[];
  area: string;
  year: number;
  rating: number;
  description: string;
  totalEpisodes: number;
  status: string;
  likeCount?: number;
  collectCount?: number;
  commentCount?: number;
}

function AnimationDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const query = useQuery({
    queryKey: ['detail', 'animation', id],
    queryFn: () => contentDetail('animation', { id: id! }).then((r) => r.data as Partial<Animation>),
    enabled: !!id,
  });

  const itemsQuery = useQuery({
    queryKey: ['detail', 'animation', id, 'items'],
    queryFn: () =>
      itemPage({ moduleContentId: String(id), page: 1, pageSize: 100 }).then((r) => {
        const list = r?.data?.records || r?.data?.list || [];
        return list as AnimeItem[];
      }),
    enabled: !!id,
  });

  // 进入详情:行为埋点(供榜单/推荐)+ 写观看历史。itemType 大写以匹配 Doris content_type。
  React.useEffect(() => {
    if (id) {
      track(id, 'view', 'ANIMATION');
      recordHistory(id);
    }
  }, [id]);

  const [activeEp, setActiveEp] = useState<string | number>(1);
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [optimisticLikes, setOptimisticLikes] = useState(0);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const notify = useCallback((message: string, severity: 'success' | 'error' | 'info' = 'success') => {
    setSnack({ open: true, message, severity });
  }, []);

  const handleLike = async () => {
    if (!id) {
      notify('内容 ID 缺失', 'error');
      return;
    }
    if (likeBusy) return;
    setLikeBusy(true);
    const next = !liked;
    setLiked(next);
    setOptimisticLikes((prev) => Math.max(0, prev + (next ? 1 : -1)));
    try {
      await moduleContentAction({ contentId: id, action: next ? 'agree' : 'cancel_agree' });
    } catch (err) {
      setLiked(!next);
      setOptimisticLikes((prev) => Math.max(0, prev + (next ? -1 : 1)));
      notify(formatApiError(err), 'error');
    } finally {
      setLikeBusy(false);
    }
  };

  // 之前这里先打一个后端根本没实现的 /detail/animation/play(必 404),
  // 404 分支又把 videoSrc 清空——而不是空 catch 之外还有兜底可用:所选那一集
  // 的真实播放地址其实已经在 itemsQuery.data 里(module_content_item.url,
  // crawl-episodes 抓的时候就写好了)。videoSrc 一旦被清空,VideoPlayer 会
  // 退回用父内容的 sourceUrl(整季的 bangumi/play/ss{id} 页面)去解析,
  // 拿不到任何分集,页面上直接显示"不支持的URL平台"——选哪一集播的都是
  // 同一个(解析不出来的)链接。直接从已加载的分集列表里取,不用等一个
  // 不存在的接口先失败一次。
  const loadEpisode = useCallback(
    (epId: string | number) => {
      const url =
        itemsQuery.data?.find((item) => String(item.id) === String(epId))?.url ||
        itemsQuery.data?.[0]?.url ||
        '';
      setVideoSrc(url);
      if (!url) {
        notify('该集暂无可播放地址', 'info');
      }
    },
    [itemsQuery.data, notify],
  );

  // 某一集解析播放失败时自动举报,给"暂时无法播放"一个真实落点(后台审核队列
  // 能看到、能处理),不只是前端提示一下就完事。用 ref 去重,同一集这个页面
  // 生命周期内只报一次,避免用户来回切集/重试时反复提交。
  const reportedEpisodes = React.useRef(new Set<string | number>());
  const handlePlaybackError = useCallback(
    (message: string) => {
      if (!id || reportedEpisodes.current.has(activeEp)) return;
      reportedEpisodes.current.add(activeEp);
      reportContent({
        targetId: id,
        targetType: 'ANIMATION',
        reason: `[自动] 第${activeEp}集播放解析失败: ${message}`,
      }).catch(() => {});
    },
    [id, activeEp],
  );

  React.useEffect(() => {
    void loadEpisode(activeEp);
  }, [loadEpisode, activeEp]);

  // activeEp 初始值是字面量 1,真实分集 id 是雪花 ID,永远不会等于 1——
  // 播放本身没问题(loadEpisode 找不到匹配时会退到第一集),但选集格子的
  // "当前选中"高亮永远对不上任何一集。数据到了之后把 activeEp 对齐到真正
  // 的第一集 id。
  React.useEffect(() => {
    if (itemsQuery.data && itemsQuery.data.length > 0 && activeEp === 1) {
      setActiveEp(itemsQuery.data[0].id);
    }
  }, [itemsQuery.data, activeEp]);

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const title = query.data?.title || '动漫详情';
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

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DetailHeader
        title={query.data?.title || '动漫详情'}
        rightActions={
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton
              onClick={handleLike}
              disabled={likeBusy}
              sx={{ color: liked ? 'primary.main' : 'text.tertiary' }}
            >
              {liked ? <ThumbUpIcon /> : <ThumbUpOutlinedIcon />}
            </IconButton>
            <CollectButton contentId={id!} contentType="animation" />
            <IconButton onClick={handleShare} sx={{ color: 'text.tertiary' }}>
              <ShareIcon />
            </IconButton>
          </Box>
        }
      />

      <AsyncState query={query} isEmpty={(d) => !d}>
        {(data) => (
          <>
            <Box sx={{ bgcolor: '#000' }}>
              <Container maxWidth="lg" sx={{ py: 0 }}>
                {/* videoSrc 是分集自己的 bilibili 页面 URL(module_content_item.url),
                    不是已经解析好的直链——要走 sourceUrl 触发 VideoPlayer 内部的
                    parseStream 解析,不能塞进 src(src 是"这就是能播的地址,直接
                    喂给 <video>"那条路径,拿一个网页 URL 当直链用,播放器会真的
                    去请求这个网页当视频流,自然播不出来)。 */}
                <VideoPlayer
                  key={videoSrc}
                  sourceUrl={videoSrc || data.source || ''}
                  poster={data.cover}
                  initialDuration={24 * 60}
                  autoPlay={false}
                  onPlaybackError={handlePlaybackError}
                />
              </Container>
            </Box>

            <Container maxWidth="lg" sx={{ py: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: { xs: 20, sm: 24, md: 32 }, color: 'text.primary', mb: 1, lineHeight: 1.3 }}>
                    {data.title}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                    {(data.genre || []).map((g) => (
                      <Chip key={g} label={g} size="small" sx={{ bgcolor: 'rgba(254, 44, 85, 0.12)', color: 'primary.main', fontWeight: 600 }} />
                    ))}
                    {data.status && (
                      <Chip label={data.status} size="small" sx={{ bgcolor: 'rgba(93,219,150,0.15)', color: 'success.main', fontWeight: 600 }} />
                    )}
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                      {data.area} · {data.year} · 全{data.totalEpisodes}话
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'warning.main' }}>
                    <StarIcon sx={{ fontSize: 20 }} />
                    <Typography sx={{ fontSize: 28, fontWeight: 800, color: 'warning.main' }}>{data.rating}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>豆瓣评分</Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 1, justifyContent: 'center' }}>
                    <Box
                      onClick={handleLike}
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.25, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
                    >
                      {liked ? <ThumbUpIcon sx={{ fontSize: 14, color: 'primary.main' }} /> : <ThumbUpOutlinedIcon sx={{ fontSize: 14 }} />}
                      <Typography sx={{ fontSize: 12, color: liked ? 'primary.main' : 'text.secondary' }}>
                        {Math.max(0, (data.likeCount || 0) + optimisticLikes).toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                        {data.collectCount || 0}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>

              <Divider sx={{ borderColor: 'divider', my: 2 }} />

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1.5, mb: 3 }}>
                <Box>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>导演</Typography>
                  <Typography sx={{ fontSize: 14, color: 'text.primary', mt: 0.5 }}>{data.director}</Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>声优</Typography>
                  <Typography sx={{ fontSize: 14, color: 'text.primary', mt: 0.5 }}>{(data.actors || []).join(' / ')}</Typography>
                </Box>
              </Box>

              <Typography variant="h6" sx={{ color: 'text.primary', mb: 1.5, fontWeight: 700 }}>
                剧情简介
              </Typography>
              <Typography sx={{ color: 'text.tertiary', fontSize: 14, lineHeight: 1.8, mb: 3, textIndent: '2em' }}>
                {data.description}
              </Typography>

              <Divider sx={{ borderColor: 'divider', my: 3 }} />

              <Typography variant="h6" sx={{ color: 'text.primary', mb: 2, fontWeight: 700 }}>
                选集播放 ({(itemsQuery.data || []).length})
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                {(itemsQuery.data || []).map((ep) => (
                  <Box
                    key={ep.id}
                    onClick={() => setActiveEp(ep.id)}
                    sx={{
                      py: 1.2,
                      px: 1,
                      textAlign: 'center',
                      borderRadius: 1.5,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 500,
                      border: '1px solid',
                      borderColor: activeEp === ep.id ? 'primary.main' : 'divider',
                      bgcolor: activeEp === ep.id ? 'rgba(254, 44, 85, 0.12)' : 'background.paper',
                      color: activeEp === ep.id ? 'primary.main' : 'text.tertiary',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 0.3,
                      transition: 'all 0.15s',
                    }}
                  >
                    {!ep.collected && <LockIcon sx={{ fontSize: 12, color: 'text.secondary' }} />}
                    {ep.title}
                  </Box>
                ))}
              </Box>

              <DetailComments contentId={id!} initialCount={data.commentCount || 0} />

              <Divider sx={{ borderColor: 'divider', my: 3 }} />
            </Container>
          </>
        )}
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

export default function AnimationDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <AnimationDetailContent />
    </React.Suspense>
  );
}

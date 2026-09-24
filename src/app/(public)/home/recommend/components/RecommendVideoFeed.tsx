'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useInfiniteQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Avatar from '@mui/material/Avatar';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import BookmarkRoundedIcon from '@mui/icons-material/BookmarkRounded';
import BookmarkBorderRoundedIcon from '@mui/icons-material/BookmarkBorderRounded';
import ModeCommentOutlinedIcon from '@mui/icons-material/ModeCommentOutlined';
import ReplyRoundedIcon from '@mui/icons-material/ReplyRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import QueueMusicRoundedIcon from '@mui/icons-material/QueueMusicRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import BedtimeRoundedIcon from '@mui/icons-material/BedtimeRounded';
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded';
import { fetchRecommend } from '@/apis/home-discover';
import { reportContent } from '@/apis/global';
import DetailComments from '@/components/detail/DetailComments';
import { useContentInteraction } from '@/hooks/useContentInteraction';
import { parseStream, BANDWIDTH_NOTICE } from '@/apis/stream';
import { resolveEmbedPlayer, originOnlyPlatform, sourcePageOf, ORIGIN_ONLY_NOTICE } from '@/lib/embedPlayer';
import { homeClient } from '@/lib/api/client';
import { getDetailRoute } from '@/lib/contentRoute';
import { mediaUrl } from '@/lib/media';
import { TYPE_LABEL } from '@/lib/contentRoute';
import { TYPE_GRADIENT } from '@/constants/gradients';
import { track } from '@/lib/track';
import { useResponsive } from '@/hooks/useResponsive';
import VideoPlayer, { type VideoPlayerHandle } from '@/components/detail/VideoPlayer';

interface VideoItem {
  id: number;
  idString?: string; // 字符串形 id,避免 JS 2^53 精度损失,后端 home/recommend 返回)
  title: string;
  contentType: string;
  cover: string;
  author: string;
  authorAvatar: string;
  durationSec: number;
  views: number;
  likes: number;
  comments: number;
  collects: number;
  shares: number;
  caption: string;
  verified?: boolean;
  brand?: string;
  authorId?: number;
  sourceUrl?: string; // 源页面 URL,供播放器解析真实视频流
  // ── 播放性(后端 internal/playability 判定后随 feed 一起下发)──
  // 后端以前在解析不出播放流时会塞一条写死的 B 站演示视频当兜底,用户点开
  // 看到的是跟标题封面完全对不上的无关内容 —— 那不是兜底,是把故障伪装成
  // 正常。现在后端明确告诉前端"这条播不了、原因是什么、该怎么跟用户说",
  // sourceUrl 在这种情况下是空的。
  playable?: boolean;
  // embeddable:不走本站播放器,嵌源站官方外链播放器(见 lib/embedPlayer)。
  playbackStatus?: 'playable' | 'pending_repair' | 'live_offline' | 'bandwidth_limited' | 'embeddable' | 'not_applicable' | 'unknown';
  repairNotice?: string; // 面向用户的中文提示。pending_repair 是故障文案,live_offline 是"主播未开播"
}

function formatCount(n?: number): string {
  if (n == null || isNaN(n)) return '0';
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  return n.toString();
}


function hashId(s: string): number {
	let h = 0x811c9dc5 >>> 0; // FNV-1a 32-bit basis
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 0x01000193) >>> 0;
	}
	return h | 0;
}

function getContentTypeColor(type: string) {
  return TYPE_GRADIENT[type] || TYPE_GRADIENT.NOVEL;
}

// 播放解析失败时自动举报,给"暂时无法播放"这句话一个真实的落点——不只是
// 前端提示一下就完了,而是真的进了内容举报/审核队列,后台能看到、能处理。
// 模块级 Set 去重:同一条内容这个会话里只报一次,不会因为用户来回划/组件
// 重新挂载就反复提交重复举报。
const reportedBrokenIds = new Set<string>();
function reportBrokenContent(video: { id: number; idString?: string; contentType: string }, reason: string) {
  const key = video.idString || String(video.id);
  if (reportedBrokenIds.has(key)) return;
  reportedBrokenIds.add(key);
  reportContent({
    // id 必须用字符串:内容 id 是雪花 int64,超过 2^53,用 number 发出去会被截成另一条内容。
    targetId: video.idString || String(video.id),
    targetType: video.contentType || 'VIDEO',
    // playback = 播放故障上报,不是违规举报:管理端「通过」它只是结单,不会下架内容。
    kind: 'playback',
    reason: `[自动] 播放解析失败: ${reason}`,
  }).catch(() => {
    // 举报本身失败不影响播放体验,静默即可;下次这条内容再触发解析失败时,
    // reportedBrokenIds 已经标记过,不会重试——但这只是同一会话内的最佳努力,
    // 不是强保证,可以接受。
  });
}

export function RecommendVideoFeed() {
  const router = useRouter();
  // 桌面端评论从右滑入,移动端维持底部抽屉(参考抖音 PC/移动端差异)。
  const { isMobile } = useResponsive();
  // 初始自动播放意图,真正的播放/暂停状态由 VideoPlayer 内部的 <video> 元素持有,
  // 这里只通过 videoPlayerRef 转发操作(切换/快进快退),不再维护一份平行的假状态。
  const [playing, setPlaying] = useState(true);
  const videoPlayerRef = useRef<VideoPlayerHandle>(null);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false, message: '', severity: 'success',
  });
  // 评论抽屉 —— 取代原先只放输入框的弹窗。打开后会拉取评论列表、支持点赞/回复
  const [commentDrawerOpen, setCommentDrawerOpen] = useState(false);
  // 点赞时,从按钮飞起一个"+1"小气泡(无障碍、视觉反馈,800ms 后自动消失)
  const [likeBurst, setLikeBurst] = useState<{ id: number; key: number } | null>(null);
  const [moreDialogOpen, setMoreDialogOpen] = useState(false);
  // 短视频播放状态:sourceUrl 解析出的视频地址
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamError, setStreamError] = useState<string>('');

  // 分页:useInfiniteQuery 管页码。以前手写的页码/锁在挂载时就先跳到第 2 页,
  // 第 1 页的结果被丢掉;某页过滤后一条不剩时预加载也不再触发。
  const PAGE_SIZE = 10;
  const {
    data: feedPages,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['home-recommend', 'recommend-feed'],
    initialPageParam: 1,
    getNextPageParam: (last: { hasMore: boolean; page: number }) => (last.hasMore ? last.page + 1 : undefined),
    // 登录用户的翻页靠服务端曝光去重,重新拉会换一批内容、当前这条跟着跳走
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: async ({ pageParam }) => {
      const page = pageParam;
      const resp = await fetchRecommend({
        types: 'VIDEO,TELEPLAY',
        size: PAGE_SIZE,
        page: page,
        // 沉浸式流每一屏就是一个播放器:只要站内能看到画面的(后端 recommendengine WatchableOnly)
        watchable: 1,
      }) as any;
      const list = (resp?.list ?? []) as any[];
      const items = list.map((it): VideoItem => ({
        id: Number(it.id) || 0,
        idString: typeof it.idString === 'string' && it.idString ? it.idString : String(it.id ?? ''),
        title: it.title || '',
        contentType: (it.contentType || 'VIDEO').toUpperCase(),
        // 封面统一过一遍网关改写:库里存量是 MinIO 内网直链
        // (http://10.9.1.2:10000/qq-media/...,外网超时),抓来的又多是
        // 外站图(混合内容 + 防盗链 403)。改写后 poster / background-url
        // 两处引用都跟着变。
        cover: mediaUrl(it.cover),
        author: it.author || '未知作者',
        authorAvatar: mediaUrl(it.authorAvatar),
        authorId: Number(it.authorId) || 0,
        durationSec: 30 + (hashId(it.idString ?? String(it.id)) % 60),
        views: Number(it.views) || 0,
        likes: Number(it.likes) || 0,
        comments: Number(it.comments) || 0,
        collects: Number(it.collects) || 0,
        shares: Number(it.shares) || 0,
        caption: it.title || '',
        verified: false,
        brand: TYPE_LABEL[(it.contentType || 'VIDEO').toUpperCase()] || '推荐',
        // 旧的播放性结论会把 sourceUrl 换成过期的 CDN 直链;源站页面从 metadata 里找回来。
        sourceUrl: sourcePageOf(it.sourceUrl, it.metadata),
        playable: Boolean(it.playable),
        // 正版长视频平台的页面(B 站番剧 / 爱奇艺 / 腾讯 / 优酷 / 芒果):本站放不了也嵌不了,
        // 解析的结局毫无悬念。不管后端判没判过,一律按"去原站看"处理 —— 不解析、不报故障。
        playbackStatus: originOnlyPlatform(sourcePageOf(it.sourceUrl, it.metadata)) ? 'bandwidth_limited' : it.playbackStatus || 'unknown',
        repairNotice: it.repairNotice || (originOnlyPlatform(sourcePageOf(it.sourceUrl, it.metadata)) ? ORIGIN_ONLY_NOTICE : ''),
      }));
      const hasMore = resp?.hasMore ?? false;
      // 后端还没按 watchable 过滤时(旧版本)前端兜一层:只留能嵌外链播放器或判定可播的。
      // 「去原站看」「修复中」的卡片放在推荐流里就是一屏划不掉的废内容。
      const watchable = items.filter((v) =>
        resolveEmbedPlayer(v.sourceUrl) != null || (v.playbackStatus === 'playable' && !!v.sourceUrl));
      return { items: watchable, hasMore, page };
    },
  });

  // 各页拼起来去重(不同页可能召回同一条)
  const allItems = useMemo(() => {
    const seen = new Set<string>();
    const out: VideoItem[] = [];
    for (const p of feedPages?.pages ?? []) {
      for (const v of p.items) {
        const k = v.idString || String(v.id);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(v);
      }
    }
    return out;
  }, [feedPages]);
  const hasMore = !!hasNextPage;

  // 追踪已加载的页码
  const uniqueVideos = allItems;

  // 视频导航状态
  const [index, setIndex] = useState(0);
  const [slideDir, setSlideDir] = useState<1 | -1>(1);
  const navLock = useRef(false);
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indexRef = useRef(0);
  indexRef.current = index;
  const video = uniqueVideos[index];

  // 临近末尾几条时预加载下一页。过滤后整页为空时 allItems 不变,但 isFetchingNextPage
  // 回落会让这里再跑一次,继续往后拉。
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && allItems.length - index <= 3) {
      void fetchNextPage();
    }
  }, [allItems.length, index, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const lockNav = useCallback((ms = 380) => {
    navLock.current = true;
    if (unlockTimer.current) clearTimeout(unlockTimer.current);
    unlockTimer.current = setTimeout(() => { navLock.current = false; }, ms);
  }, []);

  const endToastCooldown = useRef(0);
  const go = useCallback(
    (dir: 1 | -1) => {
      if (navLock.current) return;
      const next = indexRef.current + dir;
      if (next < 0 || next >= uniqueVideos.length) {
        // 划到底了:要么下一页还没加载完(hasMore 为真,prefetch 正在路上,
        // 用户划得比网络快),要么是真的没有更多了。两种情况都给个提示,
        // 不要让滑动手势悄无声息地"什么也没发生"。
        if (dir === 1 && next >= uniqueVideos.length) {
          const now = Date.now();
          if (now - endToastCooldown.current > 1500) {
            endToastCooldown.current = now;
            setSnack({
              open: true,
              message: hasMore ? '正在加载更多…' : '已经到底啦，稍后再来看看',
              severity: 'info',
            });
          }
        }
        return;
      }
      setSlideDir(dir);
      setIndex(next);
      lockNav();
    },
    [uniqueVideos.length, lockNav, hasMore],
  );

  useEffect(() => {
    setPlaying(true);
    setVideoSrc('');
    setStreamError('');
    if (!video) return;

    // 源站有官方外链播放器:不解析流(解析出来的直链校验 Referer,本站又不中转),
    // 下面渲染时 VideoPlayer 自己会换成 iframe。
    if (resolveEmbedPlayer(video.sourceUrl)) return;

    // 后端已经判定这条播不了 —— 直接把它的提示语显示出来,不要再去解析一遍。
    // 后端的判定用的就是同一个解析器(internal/playability 走 StreamResolver),
    // 前端再试一次只会得到同一个结果,代价是用户白等 8 秒超时。
    // 也不用 reportBrokenContent 再报一次:这条不是"前端发现的新故障",
    // 后端早已知道并写进了 content_playability。
    if (video.playbackStatus === 'pending_repair') {
      setStreamError(video.repairNotice || '内容修复中,暂时无法播放');
      return;
    }
    // 直播间没人开播。跟上面那条分开处理:那是故障,这是正常状态 ——
    // 同样不用再解析一次,但文案不能带"修复"。
    if (video.playbackStatus === 'live_offline') {
      setStreamError(video.repairNotice || '主播当前未开播');
      return;
    }
    // 视频不经本站带宽:源站校验 Referer、本站不中转的内容,后端已判定 ——
    // 不解析、不举报(不是故障),直接给带宽提示和去原站的入口。
    if (video.playbackStatus === 'bandwidth_limited') {
      setStreamError(video.repairNotice || BANDWIDTH_NOTICE);
      return;
    }
    if (!video.sourceUrl) return;

    // 有 sourceUrl 时解析真实视频流。cancelled 防止划走之后一个慢响应才回来,
    // 把结果错设到已经不是它的那个 videoSrc/streamError 上。
    let cancelled = false;
    setStreamLoading(true);

    // parseStream 内部对后端主解析用的是 30s 超时,加上失败后还有一整套本地
    // 降级解析器要跑一遍,最坏情况用户能等上一分钟都不一定等到结果——"划不动、
    // 也不知道是卡住还是真没有"。这里用一个更短的客户端超时抢跑:8s 内没结果
    // 就直接判定成"暂时无法播放",没必要让用户为了一条内容干等那么久;
    // 真正的请求仍在后台跑完(不 abort),只是不再等它决定 UI 该显示什么。
    const TIMEOUT_MS = 8000;
    const timeoutPromise = new Promise<{ timedOut: true }>((resolve) => {
      setTimeout(() => resolve({ timedOut: true }), TIMEOUT_MS);
    });

    Promise.race([parseStream(video.sourceUrl), timeoutPromise])
      .then((data: any) => {
        if (cancelled) return;
        if (data?.timedOut) {
          setStreamError('解析超时');
          reportBrokenContent(video, '解析超时,长时间未返回可播放流');
          return;
        }
        // 后端 /api/content/stream/resolve 成功时 code=200,本地降级解析器
        // (parseStream 的 fallback 分支)成功时 code=0——两套约定不一致。
        // 之前这里只认 code===0,导致走后端(真正播放绝大多数抖音/B站/快手等
        // 条目)那条路径时永远被判定为"解析失败",只有极少数命中本地
        // MGTV 专用兜底解析器的条目才能真正播放。是否有可播放流,看
        // streams 数组本身就够了,不该再关心 code 具体是哪个约定的"成功"。
        if (data.data?.streams?.length > 0) {
          setVideoSrc(data.data.streams[0].url || '');
        } else {
          const msg = data.msg || '解析失败';
          setStreamError(msg);
          reportBrokenContent(video, msg);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setStreamError('解析失败');
        reportBrokenContent(video, '解析请求异常');
      })
      .finally(() => {
        if (!cancelled) setStreamLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [index, video]);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      // 必须吃掉滚轮事件,否则浏览器仍会把它当页面滚动处理——在到达内容边界时
      // 持续的滚轮输入可能被浏览器/系统识别为下拉刷新手势,导致整页重新加载,
      // 白白丢掉已加载的 allItems/index 状态,体验上像"刷着刷着突然从头开始"。
      e.preventDefault();
      if (Math.abs(e.deltaY) < 8) return;
      if (navLock.current) {
        lockNav(220);
        return;
      }
      go(e.deltaY > 0 ? 1 : -1);
    },
    [go, lockNav],
  );

  const notify = (message: string, severity: 'success' | 'error' | 'info' = 'success') => {
    setSnack({ open: true, message, severity });
  };

  // 赞 / 收藏:当前这条视频的真实状态从 /interaction 读,操作后以服务端为准并给出提示
  // (见 hooks/useContentInteraction)。id 用无损的 idString —— video.id 已被 Number() 截断,
  // 以前赞和收藏都记到了另一条内容上。
  const interaction = useContentInteraction(video ? video.idString || video.id : null, {
    notify,
    baseLikes: video?.likes,
    baseCollects: video?.collects,
  });
  const liked = interaction.liked;
  const collected = interaction.collected;
  const likedCount = interaction.likeCount;
  const collectedCount = interaction.collectCount;
  const handleLike = () => {
    // 触发一次"+1"飞起动画:无论点赞还是取消都给反馈,用户才知道刚才那一下点中了
    setLikeBurst({ id: video?.id ?? 0, key: Date.now() });
    setTimeout(() => setLikeBurst(null), 800);
    interaction.toggleLike();
  };
  const handleCollect = () => interaction.toggleCollect();

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!video?.authorId || followBusy) {
      if (!video?.authorId) notify('暂无法关注该作者', 'info');
      return;
    }
    setFollowBusy(true);
    const wasFollowing = following;
    setFollowing(!wasFollowing);
    try {
      if (wasFollowing) {
        await homeClient.delete(`/follow/${video.authorId}`);
        notify('已取消关注');
      } else {
        await homeClient.post(`/follow/${video.authorId}`);
        notify('关注成功');
      }
    } catch {
      setFollowing(wasFollowing);
      notify('操作失败,请稍后再试', 'error');
    } finally {
      setFollowBusy(false);
    }
  };

  const handleCommentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCommentDrawerOpen(true);
  };

  const handleReport = async () => {
    if (!video?.id) return;
    try {
      await reportContent({ targetId: video.idString || String(video.id), targetType: video.contentType || 'VIDEO', reason: '违规/低俗内容' });
      notify('举报已提交,我们会尽快处理');
      setMoreDialogOpen(false);
    } catch (e) {
      // 后端会说明原因(人工举报要求登录:"请先登录后再举报"),照实转告,别让用户白白重试。
      const msg = e instanceof Error && e.message ? e.message : '';
      notify(msg || '举报提交失败,请重试', 'error');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(typeof window !== 'undefined' ? window.location.href : '');
      notify('链接已复制到剪贴板');
      setMoreDialogOpen(false);
    } catch {
      notify('复制失败', 'error');
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator.share) {
        await navigator.share({ title: video?.title || '推荐', url: typeof window !== 'undefined' ? window.location.href : '' });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(typeof window !== 'undefined' ? window.location.href : '');
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

  const handleMore = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMoreDialogOpen(true);
  };

  const handleCardClick = (item: VideoItem) => {
    // item.id 已被 Number() 截断,跳详情 / 埋点用无损的 idString,否则打开的是另一条内容
    const id = item.idString || item.id;
    track(id, 'click', item.contentType || 'novel');
    const route = getDetailRoute(item.contentType, id);
    if (route) router.push(route);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        videoPlayerRef.current?.togglePlay();
      } else if (e.key === 'ArrowRight') {
        videoPlayerRef.current?.seek(5);
      } else if (e.key === 'ArrowLeft') {
        videoPlayerRef.current?.seek(-5);
      } else if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'j') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  // 滚轮用原生非被动监听:React 的 onWheel 是 passive 的,里面的 preventDefault 不生效,
  // 页面照样跟着滚。
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!rootEl) return;
    rootEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => rootEl.removeEventListener('wheel', handleWheel);
  }, [rootEl, handleWheel]);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const [vh, setVh] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragState = useRef({ active: false, startY: 0, moved: 0 });

  const setViewportRef = useCallback((node: HTMLDivElement | null) => {
    viewportRef.current = node;
    roRef.current?.disconnect();
    if (node) {
      setVh(node.clientHeight);
      const ro = new ResizeObserver(() => setVh(node.clientHeight));
      ro.observe(node);
      roRef.current = ro;
    }
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
    dragState.current = { active: true, startY: e.clientY, moved: 0 };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = dragState.current;
    if (!s.active) return;
    let d = e.clientY - s.startY;
    s.moved = Math.max(s.moved, Math.abs(d));
    if ((d > 0 && index === 0) || (d < 0 && index === uniqueVideos.length - 1)) d *= 0.32;
    setDragY(d);
  };
  const endDrag = () => {
    const s = dragState.current;
    if (!s.active) return;
    s.active = false;
    setDragging(false);
    const d = dragY;
    if (s.moved < 6) {
      setDragY(0);
      // 单击(非拖拽)= 切换真实 <video> 的播放/暂停,而不是一份脱节的界面假状态。
      videoPlayerRef.current?.togglePlay();
      return;
    }
    const threshold = (vh || 600) * 0.2;
    if (!navLock.current && d <= -threshold && index < uniqueVideos.length - 1) {
      setSlideDir(1);
      setIndex((i) => i + 1);
      setDragY(0);
      lockNav();
    } else if (!navLock.current && d >= threshold && index > 0) {
      setSlideDir(-1);
      setIndex((i) => i - 1);
      setDragY(0);
      lockNav();
    } else {
      setDragY(0);
    }
  };

  if (isLoading) {
    return (
      <Box data-fill-main sx={{ width: '100%', height: '100%', minHeight: 240, bgcolor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>加载推荐中…</Typography>
      </Box>
    );
  }

  if (!video && (hasNextPage || isFetchingNextPage)) {
    return (
      <Box data-fill-main sx={{ width: '100%', height: '100%', minHeight: 240, bgcolor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>加载推荐中…</Typography>
      </Box>
    );
  }

  if (!video) {
    return (
      <Box data-fill-main sx={{ width: '100%', height: '100%', minHeight: 240, bgcolor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>暂无推荐内容</Typography>
      </Box>
    );
  }

  return (
    <Box
      // 首页 main 是列向 flex,带这个标记的直接子元素 flex:1 铺满剩余高度。
      // 之前只靠 height:100%,在不支持 dvh 的 WebView 里父级没有确定高度 → 整个视频流 0 高。
      data-fill-main
      ref={setRootEl}
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 0,
        bgcolor: '#000000',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        // 双保险:即便某个滚轮/触摸事件漏掉了 preventDefault,也不让浏览器把
        // 溢出滚动/回弹链传到父级或触发原生下拉刷新。
        overscrollBehavior: 'contain',
      }}
    >
      <Box
        ref={setViewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        sx={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          bgcolor: '#000',
          touchAction: 'none',
          cursor: dragging ? 'grabbing' : 'grab',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: vh ? vh * uniqueVideos.length : '100%',
            transform: `translateY(${-index * (vh || 0) + dragY}px)`,
            transition: dragging ? 'none' : 'transform 0.34s cubic-bezier(0.22, 0.61, 0.36, 1)',
            willChange: 'transform',
          }}
        >
          {uniqueVideos.map((v, i) => (
            <Box
              // Use the lossless string id (idString) for stable identity on reorder.
              // Falls back to composite `${i}-${v.id}` if the backend omits it.
              key={`video-${v.idString ? `s-${v.idString}` : `${i}-${v.id}`}`}
              sx={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: vh ? i * vh : 0,
                height: vh || '100%',
                opacity: vh > 0 || i === index ? 1 : 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                // 纯黑背景:之前这里叠了一层按内容类型着色的渐变(::after,
                // opacity 0.35),把整个未被视频覆盖的区域染成对应色调,而不是
                // TikTok 那种沉浸式纯黑。视频本身通过 VideoPlayer 的 fill 模式
                // 居中撑满、黑底信封边(letterbox),不再需要这层色块打底。
                bgcolor: '#000',
              }}
            >
              {/* 视频播放器或封面 */}
              {i === index && (videoSrc || resolveEmbedPlayer(v.sourceUrl)) ? (
                <VideoPlayer
                  ref={videoPlayerRef}
                  fill
                  src={videoSrc}
                  refreshSource={v.sourceUrl}
                  poster={v.cover}
                  initialDuration={video?.durationSec || 60}
                  autoPlay={playing}
                  onPlaybackError={(message) => reportBrokenContent(v, message)}
                />
              ) : (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    /* CSS url() 里的字符串必须包引号,否则含 ? & 空格等会断;
                       外站/MinIO 内网直链必须过 mediaUrl 走代理改写。 */
                    background: `url("${mediaUrl(v.cover)}") center/cover no-repeat`,
                  }}
                />
              )}

              {/* 之前 streamLoading/streamError 两个状态只写进 state,JSX 里从没渲染过——
                  解析失败时用户看到的就是静止封面图,和"正常但没有视频只是一张图"的内容
                  长得一模一样,分不清是坏的还是就该这样,只能干等或者不明所以地划走。
                  这里补上明确反馈:解析中给个不遮挡滑动的小转圈,解析失败给一个显眼的
                  "暂时无法播放"标记,让用户立刻知道这条不是卡住了,划走就行,不用等。 */}
              {i === index && !videoSrc && streamLoading && (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    zIndex: 2,
                  }}
                >
                  <CircularProgress size={32} sx={{ color: 'rgba(255,255,255,0.75)' }} />
                </Box>
              )}
              {i === index && !videoSrc && !streamLoading && streamError && (
                <Box
                  data-no-drag
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 1,
                    px: 3,
                    py: 2,
                    borderRadius: 2,
                    bgcolor: 'rgba(0, 0, 0, 0.55)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    zIndex: 2,
                    textAlign: 'center',
                    maxWidth: 260,
                  }}
                >
                  {/* 图标也分故障和非故障:直播间没开播用中性的"休息中",
                      不能用警告色 —— 那会让用户以为我们坏了。 */}
                  {v.playbackStatus === 'live_offline' ? (
                    <BedtimeRoundedIcon sx={{ fontSize: 32, color: 'rgba(255,255,255,0.55)' }} />
                  ) : v.playbackStatus === 'bandwidth_limited' ? (
                    <CloudOffRoundedIcon sx={{ fontSize: 32, color: 'rgba(255,255,255,0.55)' }} />
                  ) : (
                    <ErrorOutlineRoundedIcon sx={{ fontSize: 32, color: 'warning.main' }} />
                  )}
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary' }}>
                    {v.playbackStatus === 'live_offline'
                      ? '主播未开播'
                      : v.playbackStatus === 'bandwidth_limited'
                        ? '暂不支持站内播放'
                      : v.playbackStatus === 'pending_repair'
                        ? '内容修复中'
                        : '该内容暂时无法播放'}
                  </Typography>
                  {/* 后端判定为待修复时,直接显示它给出的具体原因("该内容只存了
                      剧集总览页,正在补齐分集播放地址"之类),比一句笼统的
                      "已记录,尽快修复"有用得多 —— 用户知道这不是自己网络的问题,
                      运营也能从用户反馈里对上是哪一类故障。
                      直播未开播则完全不提"修复":没有任何东西坏了。 */}
                  <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                    {v.playbackStatus === 'live_offline'
                      ? '上滑看下一个'
                      : v.playbackStatus === 'bandwidth_limited'
                        ? `${v.repairNotice || BANDWIDTH_NOTICE} · 上滑看下一个`
                      : v.playbackStatus === 'pending_repair' && v.repairNotice
                        ? `${v.repairNotice} · 上滑看下一个`
                        : `${streamError} · 已记录,尽快修复 · 上滑看下一个`}
                  </Typography>
                  {v.playbackStatus === 'bandwidth_limited' && v.sourceUrl && (
                    <Box
                      component="a"
                      href={v.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-no-drag
                      sx={{
                        mt: 0.5,
                        px: 2,
                        py: 0.5,
                        borderRadius: 1,
                        fontSize: 12,
                        color: '#fff',
                        textDecoration: 'none',
                        border: '1px solid rgba(255,255,255,0.35)',
                        bgcolor: 'rgba(255,255,255,0.08)',
                      }}
                    >
                      {originOnlyPlatform(v.sourceUrl) ? `去${originOnlyPlatform(v.sourceUrl)}观看` : '去原站观看'}
                    </Box>
                  )}
                </Box>
              )}

              {i === index && (
                <>
                  <Box
                    data-no-drag
                    sx={{
                      position: 'absolute',
                      right: { xs: 8, sm: 16, md: 20 },
                      top: '50%',
                      transform: 'translateY(-50%)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.25,
                      zIndex: 4,
                    }}
                  >
                  </Box>


                  <Box
                    sx={{
                      position: 'absolute',
                      top: 16,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.75,
                      px: 1.5,
                      py: 0.5,
                      borderRadius: 999,
                      bgcolor: 'rgba(0, 0, 0, 0.4)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      zIndex: 3,
                    }}
                  >
                    <Box
                      sx={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: getContentTypeColor(video.contentType),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                      }}
                    >
                      <StarRoundedIcon sx={{ fontSize: 12, color: '#fff' }} />
                    </Box>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary' }}>{video.brand}</Typography>
                  </Box>

                  {/* 播放/暂停状态由 VideoPlayer 自己的中心播放按钮体现(那是真实
                      播放状态,不是这里另一份脱节的模拟状态),标题已经在下方
                      左下角的作者信息区展示,这里不再重复一份铺满屏幕的大标题。 */}

                  <Box
                    data-no-drag
                    sx={{
                      position: 'absolute',
                      right: { xs: 8, sm: 14, md: 18 },
                      bottom: 110,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.75,
                      alignItems: 'center',
                      zIndex: 3,
                    }}
                  >
                    <Box sx={{ position: 'relative', mb: 0.5 }}>
                      <Avatar
                        src={video.authorAvatar}
                        sx={{
                          width: 48,
                          height: 48,
                          border: '2px solid #FFFFFF',
                          background: getContentTypeColor(video.contentType),
                        }}
                      >
                        {video.author?.[0]}
                      </Avatar>
                      {!following && (
                        <Box
                          onClick={handleFollow}
                          sx={{
                            position: 'absolute',
                            bottom: -6,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            bgcolor: 'primary.main',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '2px solid #000000',
                            cursor: 'pointer',
                            opacity: followBusy ? 0.6 : 1,
                          }}
                        >
                          <AddRoundedIcon sx={{ fontSize: 14, color: 'text.primary' }} />
                        </Box>
                      )}
                    </Box>

                    <SideAction
                      active={liked}
                      onClick={(e) => { e.stopPropagation(); handleLike(); }}
                      icon={liked ? <FavoriteRoundedIcon sx={{ fontSize: 30 }} /> : <FavoriteBorderRoundedIcon sx={{ fontSize: 30 }} />}
                      value={formatCount(likedCount)}
                      activeColor="primary.main"
                      badge={likeBurst && likeBurst.id === video.id ? String(likeBurst.key) : null}
                    />
                    <SideAction
                      icon={<ModeCommentOutlinedIcon sx={{ fontSize: 28 }} />}
                      value={formatCount(video.comments)}
                      onClick={handleCommentClick}
                    />
                    <SideAction
                      active={collected}
                      onClick={(e) => { e.stopPropagation(); handleCollect(); }}
                      icon={collected ? <BookmarkRoundedIcon sx={{ fontSize: 28 }} /> : <BookmarkBorderRoundedIcon sx={{ fontSize: 28 }} />}
                      value={formatCount(collectedCount)}
                      activeColor="warning.main"
                    />
                    <SideAction
                      icon={<ReplyRoundedIcon sx={{ fontSize: 28, transform: 'scaleX(-1)' }} />}
                      value={formatCount(video.shares)}
                      onClick={handleShare}
                    />
                    <SideAction icon={<MoreHorizRoundedIcon sx={{ fontSize: 28 }} />} value="" onClick={handleMore} />
                  </Box>

                  <Box
                    sx={{
                      position: 'absolute',
                      left: 20,
                      right: 88,
                      bottom: 92,
                      zIndex: 3,
                      color: 'text.primary',
                      textShadow: '0 1px 3px rgba(0, 0, 0, 0.6)',
                      pointerEvents: 'auto',
                    }}
                    onClick={() => handleCardClick(video)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                      <Typography sx={{ fontSize: 15, fontWeight: 700 }}>@{video.author}</Typography>
                      {video.verified && (
                        <VerifiedRoundedIcon sx={{ fontSize: 14, color: 'secondary.main' }} />
                      )}
                      <Box
                        sx={{
                          ml: 0.5,
                          px: 0.75,
                          py: 0.05,
                          borderRadius: 0.5,
                          bgcolor: 'rgba(255, 255, 255, 0.15)',
                          fontSize: 10,
                          fontWeight: 600,
                          backdropFilter: 'blur(4px)',
                        }}
                      >
                        {video.brand}
                      </Box>
                    </Box>
                    <Typography
                      sx={{
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: 'rgba(255, 255, 255, 0.95)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        maxWidth: 540,
                      }}
                    >
                      {video.caption}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75, color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>
                      <QueueMusicRoundedIcon sx={{ fontSize: 12 }} />
                      <Typography sx={{ fontSize: 11 }}>{formatCount(video.views)} 次浏览</Typography>
                    </Box>
                  </Box>
                </>
              )}
            </Box>
          ))}
        </Box>
      </Box>

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

      {/* 评论抽屉 —— 响应式:
          · 桌面端 (>= md) 从右侧滑入,宽 420/480px,左侧视频区不被整屏遮罩覆盖,
            用户可以同时看着视频翻评论,符合参考的 PC 端体验。
          · 移动端 (< md) 维持从底部弹出,占视口约 75% 高度,顶部圆角 —— 移动端
            视频区本来就窄,底部抽屉遮住下半屏是抖音/快手的标准做法。
          DetailComments 用展开模式(!compact):评论列表 + 输入框 + 表情 + 楼中楼回复
          + 顶/踩/收藏 + 加载更多,全套直接铺在抽屉里,不用再套一层 Dialog。
          关键原因:DetailComments 的 compact 模式只在用户点中图标时把内部 Dialog 打开,
          而 Drawer 的 contents 没法触发那次内部 click —— compact 模式在 Drawer 容器里
          只会渲染出一个评论数小条,内容不会显示。展开模式是整块直接渲染。 */}
      <Drawer
        anchor={isMobile ? 'bottom' : 'right'}
        open={commentDrawerOpen}
        onClose={() => setCommentDrawerOpen(false)}
        transitionDuration={{ enter: 280, exit: 220 }}
        slotProps={{
          paper: {
            sx: isMobile
              ? {
                  height: { xs: '85vh', sm: '75vh' },
                  maxHeight: '85vh',
                  borderTopLeftRadius: 16,
                  borderTopRightRadius: 16,
                  bgcolor: 'background.paper',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }
              : {
                  width: { md: 420, lg: 480 },
                  maxWidth: '100%',
                  height: '100%',
                  borderTopLeftRadius: 0,
                  borderTopRightRadius: 0,
                  bgcolor: 'background.paper',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                },
          },
        }}
      >
        {video && (
          <DetailComments
            contentId={video.idString || video.id}
            initialCount={video.comments}
          />
        )}
      </Drawer>

      <Dialog open={moreDialogOpen} onClose={() => setMoreDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 600 }}>更多</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              onClick={handleReport}
              sx={{ textTransform: 'none', justifyContent: 'flex-start', borderColor: 'rgba(255,255,255,0.12)', color: 'text.primary' }}
            >
              举报内容
            </Button>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              onClick={() => { notify('已减少此类推荐', 'info'); setMoreDialogOpen(false); }}
              sx={{ textTransform: 'none', justifyContent: 'flex-start', borderColor: 'rgba(255,255,255,0.12)', color: 'text.primary' }}
            >
              不感兴趣
            </Button>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              onClick={handleCopyLink}
              sx={{ textTransform: 'none', justifyContent: 'flex-start', borderColor: 'rgba(255,255,255,0.12)', color: 'text.primary' }}
            >
              复制链接
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setMoreDialogOpen(false)} size="small" sx={{ textTransform: 'none' }}>关闭</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// 右侧单个按钮:圆形毛玻璃图标 + 下方数字。点击有缩放反馈,点赞时数字上方飞起 "+1"。
// 关键改进:
// 1. 圆形毛玻璃背景 —— 没有底色时,白图标在亮色封面/视频上完全看不清,这是视频流最常见的可用性坑。
// 2. 数字加文字投影 —— 视频画面颜色不确定,单靠 color: '#fff' 会让数字在白底画面里"消失"。
// 3. 按下 active 缩到 0.9,松手回弹到 1,带 transform transition;hover 时 1.1。物理感更强。
// 4. badge="+1" 时从图标中心冒出气泡,800ms 内向上飞 24px 并淡出 —— 告诉用户"刚才那一下点中了"。
function SideAction({
  icon,
  value,
  active,
  activeColor,
  onClick,
  badge,
}: {
  icon: React.ReactNode;
  value: string;
  active?: boolean;
  activeColor?: string;
  onClick?: (e: React.MouseEvent) => void;
  badge?: string | null;
}) {
  return (
    <Box
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
        cursor: onClick ? 'pointer' : 'default',
        outline: 'none',
        '&:focus-visible': { outline: '2px solid rgba(254, 44, 85, 0.6)', borderRadius: '50%' },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: 44,
          height: 44,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'rgba(20, 22, 32, 0.45)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          color: active && activeColor ? activeColor : 'rgba(255, 255, 255, 0.95)',
          transition: 'transform 0.18s cubic-bezier(0.22, 0.61, 0.36, 1), background-color 0.18s, color 0.18s',
          '&:hover': { transform: 'scale(1.1)', bgcolor: 'rgba(20, 22, 32, 0.6)' },
          '&:active': { transform: 'scale(0.9)' },
        }}
      >
        {icon}
        {badge && (
          // 用 badge 字符串作 key 已经足够:同一次点赞只会进入 React 一次 render,
          // 后续再次点击由父组件 setLikeBurst 重新挂载一个新的 badge 子节点。
          // 不要再调 Date.now() —— 在渲染期调用 pure 函数会被 React 警告。
          <Box
            key={badge}
            sx={{
              position: 'absolute',
              top: 6,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 14,
              fontWeight: 800,
              color: 'primary.main',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.6)',
              pointerEvents: 'none',
              animation: 'likeBurstFade 0.8s ease-out forwards',
              '@keyframes likeBurstFade': {
                '0%': { opacity: 0, transform: 'translateX(-50%) translateY(0) scale(0.7)' },
                '20%': { opacity: 1, transform: 'translateX(-50%) translateY(-4px) scale(1.1)' },
                '100%': { opacity: 0, transform: 'translateX(-50%) translateY(-32px) scale(1)' },
              },
            }}
          >
            {badge}
          </Box>
        )}
      </Box>
      {value !== '' && (
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 600,
            color: '#fff',
            textShadow: '0 1px 3px rgba(0, 0, 0, 0.75), 0 0 6px rgba(0, 0, 0, 0.4)',
            lineHeight: 1.1,
            minWidth: 20,
            textAlign: 'center',
          }}
        >
          {value}
        </Typography>
      )}
    </Box>
  );
}

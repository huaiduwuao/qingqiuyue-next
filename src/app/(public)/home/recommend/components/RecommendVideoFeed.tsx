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
import IconButton from '@mui/material/IconButton';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import BookmarkRoundedIcon from '@mui/icons-material/BookmarkRounded';
import BookmarkBorderRoundedIcon from '@mui/icons-material/BookmarkBorderRounded';
import ModeCommentRoundedIcon from '@mui/icons-material/ModeCommentRounded';
import ReplyRoundedIcon from '@mui/icons-material/ReplyRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import BedtimeRoundedIcon from '@mui/icons-material/BedtimeRounded';
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { fetchRecommend } from '@/apis/home-discover';
import { reportContent } from '@/apis/global';
import { reportRecommendFeedback } from '@/apis/recommend';
import DetailComments from '@/components/detail/DetailComments';
import { useContentInteraction } from '@/hooks/useContentInteraction';
import { parseStream, BANDWIDTH_NOTICE } from '@/apis/stream';
import { originOnlyPlatform, sourcePageOf, ORIGIN_ONLY_NOTICE } from '@/lib/sourcePage';
import { canResolveLocally, resolveStream } from '@/lib/localStream/engine';
import { homeClient } from '@/lib/api/client';
import { getDetailRoute } from '@/lib/contentRoute';
import { mediaUrl } from '@/lib/media';
import { TYPE_LABEL } from '@/lib/contentRoute';
import { TYPE_GRADIENT } from '@/constants/gradients';
import { track } from '@/lib/track';
import VideoPlayer, { type VideoPlayerHandle } from '@/components/detail/VideoPlayer';
import { useFeedDanmaku, DanmakuLayer } from './FeedDanmaku';

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
  // resolvable:源站页面有流解析规则,本站播放器按规则解析播放(见 lib/localStream)。embeddable 是旧值。
  playbackStatus?: 'playable' | 'pending_repair' | 'live_offline' | 'bandwidth_limited' | 'resolvable' | 'embeddable' | 'not_applicable' | 'unknown';
  repairNotice?: string; // 面向用户的中文提示。pending_repair 是故障文案,live_offline 是"主播未开播"
  portrait?: boolean; // 竖屏(爬虫从源站 og:video:width/height 记下的 orientation)
}

// metadata 是爬虫落库的 JSON 串;og_pages 源会写 orientation=portrait|landscape。
function isPortrait(metadata?: unknown): boolean {
  if (!metadata) return false;
  try {
    const m = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
    return (m as { orientation?: string })?.orientation === 'portrait';
  } catch {
    return false;
  }
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

// ── 沉浸式视觉的统一口径 ──
// 画面上的浮层只用这几种材质:纯白字 + 投影、深色毛玻璃圆钮、底部黑色渐隐。
// 以前每个浮层各写一套 rgba,有的发灰有的发蓝,叠在视频上显得碎。
const TEXT_SHADOW = '0 1px 2px rgba(0,0,0,0.55), 0 0 8px rgba(0,0,0,0.25)';
const GLASS = {
  bgcolor: 'rgba(0, 0, 0, 0.32)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.10)',
} as const;
const ACCENT = '#FE2C55';
/** 移动端打开评论后视频区占的高度 */
const MOBILE_STAGE_WITH_COMMENTS = '34%';
/** 桌面端评论栏宽度 */
const DESKTOP_COMMENTS_W = 400;

/**
 * 舞台各层用 clip 而不是 hidden:hidden 的盒子仍可被程序滚动,封面糊底(inset -40px)
 * 和飘出右边的弹幕撑出了可滚动溢出,焦点一落进外链 iframe 浏览器就把整屏横向滚了
 * 28px,画面和标题左边被切掉一截。clip 不产生滚动容器,不会被滚。
 */
const CLIP = { overflow: 'hidden', '@supports (overflow: clip)': { overflow: 'clip' } } as const;

const DANMAKU_PREF_KEY = 'qq.feed.danmaku';
function readDanmakuPref(): boolean {
  try {
    return localStorage.getItem(DANMAKU_PREF_KEY) !== '0';
  } catch {
    return true;
  }
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
  const theme = useTheme();
  // 桌面:评论从右侧滑入、把视频往左挤;移动:评论从下方升起、把视频往上推。
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true });
  // 初始自动播放意图,真正的播放/暂停状态由 VideoPlayer 内部的 <video> 元素持有,
  // 这里只通过 videoPlayerRef 转发操作(切换/快进快退),不再维护一份平行的假状态。
  const [playing, setPlaying] = useState(true);
  const videoPlayerRef = useRef<VideoPlayerHandle>(null);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false, message: '', severity: 'success',
  });
  // 评论栏(桌面右栏 / 移动下半屏)。打开后拉取评论列表、支持点赞/回复
  const [commentsOpen, setCommentsOpen] = useState(false);
  // 点赞时,从按钮飞起一个"+1"小气泡(无障碍、视觉反馈,800ms 后自动消失)
  const [likeBurst, setLikeBurst] = useState<{ id: number; key: number } | null>(null);
  const [moreDialogOpen, setMoreDialogOpen] = useState(false);
  // 短视频播放状态:sourceUrl 解析出的视频地址
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamError, setStreamError] = useState<string>('');
  // 弹幕:开关记在本机
  const [danmakuOn, setDanmakuOn] = useState(true);
  useEffect(() => setDanmakuOn(readDanmakuPref()), []);
  const toggleDanmaku = () => {
    setDanmakuOn((on) => {
      try { localStorage.setItem(DANMAKU_PREF_KEY, on ? '0' : '1'); } catch { /* 隐私模式 */ }
      return !on;
    });
  };
  // 评论栏里加载/发出评论后的真实条数,按内容 id 记;推荐接口给的 comments 只是入库时的快照
  const [commentTotals, setCommentTotals] = useState<Record<string, number>>({});

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
    // 每次从第一页拉起都换一个 shuffle(刷新 / 重新进入),后续页沿用同一个:
    // 游客的列表才会每次不同,而同一次浏览里翻页又不会跳条或重复。
    initialPageParam: { page: 1, shuffle: 0 },
    getNextPageParam: (last: { hasMore: boolean; page: number; shuffle: number }) =>
      (last.hasMore ? { page: last.page + 1, shuffle: last.shuffle } : undefined),
    // 登录用户的翻页靠服务端曝光去重,重新拉会换一批内容、当前这条跟着跳走
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: async ({ pageParam }) => {
      const page = pageParam.page;
      const shuffle = pageParam.shuffle || Math.floor(Math.random() * 2 ** 31) + 1;
      const resp = await fetchRecommend({
        // 短剧也进来:能嵌外链播放器 / 站内直链可播的才会被后端留下(watchable)
        types: 'VIDEO,TELEPLAY,SHORT_DRAMA',
        size: PAGE_SIZE,
        page: page,
        // 沉浸式流每一屏就是一个播放器:只要站内能看到画面的(后端 recommendengine WatchableOnly)
        watchable: 1,
        shuffle,
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
        portrait: isPortrait(it.metadata),
      }));
      const hasMore = resp?.hasMore ?? false;
      // 后端还没按 watchable 过滤时(旧版本)前端兜一层:只留有解析规则或判定可播的。
      // 「去原站看」「修复中」的卡片放在推荐流里就是一屏划不掉的废内容。
      const watchable = items.filter((v) =>
        canResolveLocally(v.sourceUrl || '') || (v.playbackStatus === 'playable' && !!v.sourceUrl));
      return { items: watchable, hasMore, page, shuffle };
    },
  });

  // 各页拼起来去重(不同页可能召回同一条)
  const uniqueVideos = useMemo(() => {
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

  // 视频导航状态
  const [index, setIndex] = useState(0);
  const navLock = useRef(false);
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indexRef = useRef(0);
  indexRef.current = index;
  const video = uniqueVideos[index];
  const videoKey = video ? video.idString || String(video.id) : null;

  // 临近末尾几条时预加载下一页。过滤后整页为空时列表不变,但 isFetchingNextPage
  // 回落会让这里再跑一次,继续往后拉。
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && uniqueVideos.length - index <= 3) {
      void fetchNextPage();
    }
  }, [uniqueVideos.length, index, hasNextPage, isFetchingNextPage, fetchNextPage]);

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

    // 有解析规则的源站(B 站投稿 / AcFun):VideoPlayer 自己按规则解析(客户端本机、网页端服务端)、本站播放器播放。
    if (canResolveLocally(video.sourceUrl || '')) return;

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
        // 是否有可播放流,看 streams 数组本身就够了。
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

  // 预解析接下来两条(有规则的源站):划过去时地址已经在手,起播不用等接口。结果进 lib/localStream 的缓存,
  // 失败静默 —— 真轮到它播时 VideoPlayer 会再试并给出界面。
  useEffect(() => {
    const ctrl = new AbortController();
    for (const next of uniqueVideos.slice(index + 1, index + 3)) {
      if (next.sourceUrl && canResolveLocally(next.sourceUrl)) resolveStream(next.sourceUrl, { signal: ctrl.signal }).catch(() => {});
    }
    return () => ctrl.abort();
  }, [index, uniqueVideos]);

  // 移动端评论打开时视频区只剩上面一小块:滚轮/拖动都不该再翻页
  const navBlocked = commentsOpen && !isDesktop;
  // 滚轮手势状态(见 handleWheel)
  const lastWheelAt = useRef(0);
  const lastWheelNavAt = useRef(0);
  const wheelNavigated = useRef(false);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      // 评论栏自己要滚:落在里面的滚轮不归视频流管
      if ((e.target as HTMLElement)?.closest?.('[data-feed-comments]')) return;
      // 必须吃掉滚轮事件,否则浏览器仍会把它当页面滚动处理——在到达内容边界时
      // 持续的滚轮输入可能被浏览器/系统识别为下拉刷新手势,导致整页重新加载,
      // 白白丢掉已加载的列表/index 状态,体验上像"刷着刷着突然从头开始"。
      e.preventDefault();
      if (navBlocked) return;
      // 一次滑动手势只翻一条。Mac 触控板一次轻扫会连续发上百个滚轮事件(先是手指、再是惯性),
      // 以前只靠「锁 380ms、期间每来一个事件续 220ms」挡,事件间隔稍大就被当成新手势,一扫跳好几条,
      // 看起来就像没有滑动动画、直接跳过去。现在:两次事件间隔超过 200ms 才算新手势;
      // 同一手势(含惯性)里最多翻一条,且距上次翻页至少 450ms(让 0.34s 的滑动动画放完)。
      const now = performance.now();
      const gap = now - lastWheelAt.current;
      lastWheelAt.current = now;
      if (Math.abs(e.deltaY) < 8) return;
      const newGesture = gap > 200;
      if (newGesture) wheelNavigated.current = false;
      if (!newGesture && wheelNavigated.current) return;
      if (now - lastWheelNavAt.current < 450) return;
      wheelNavigated.current = true;
      lastWheelNavAt.current = now;
      go(e.deltaY > 0 ? 1 : -1);
    },
    [go, navBlocked],
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

  // 双击点赞(抖音手势):只点亮不取消,在点击处冒一颗心
  const [hearts, setHearts] = useState<Array<{ key: number; x: number; y: number }>>([]);
  const lastTap = useRef(0);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 划走时丢掉还没触发的单击:否则它会在 260ms 后 togglePlay 刚划到的那一条,把它暂停
  useEffect(() => {
    if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
    singleTapTimer.current = null;
  }, [index]);

  // 换条视频:关注态重置
  useEffect(() => {
    setFollowing(false);
  }, [videoKey]);

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
    setCommentsOpen((o) => !o);
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

  const handleNotInterested = async () => {
    setMoreDialogOpen(false);
    if (video) {
      // 真的记一次负反馈(累计到阈值后不再推给这个用户);未登录时接口直接跳过
      reportRecommendFeedback({ contentId: video.idString || String(video.id) }).catch(() => {});
    }
    notify('已减少此类推荐', 'info');
    go(1);
  };

  const shareUrl = () => {
    if (typeof window === 'undefined' || !video) return '';
    const route = getDetailRoute(video.contentType, video.idString || video.id);
    return route ? new URL(route, window.location.origin).toString() : window.location.href;
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl());
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
        await navigator.share({ title: video?.title || '推荐', url: shareUrl() });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl());
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

  // ── 弹幕 ──
  // 弹幕只读:内容是站内评论,发评论走评论栏(以前底部另有一条弹幕输入框,和评论栏的输入框、
  // B 站播放器自带的弹幕条叠成三处"说点什么",已去掉)。开关在「更多」里,快捷键 d。
  const danmaku = useFeedDanmaku(videoKey, danmakuOn);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.key === 'Escape') {
        setCommentsOpen(false);
      } else if (e.key === ' ' || e.key === 'k') {
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
      } else if (e.key === 'x') {
        setCommentsOpen((o) => !o);
      } else if (e.key === 'd') {
        toggleDanmaku();
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

  // 视口高度只给拖动阈值用;翻页位移用百分比,评论栏开合时视口变高变矮不用跟着重算。
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  // d:当前位移(已含边界阻尼);vy:最近一段的速度(px/ms),用来认「轻扫」。
  // 位移记在 ref 里 —— 以前松手时读的是 state 里的 dragY,最后一个 move 还没渲染就被当成更短的位移。
  const dragState = useRef({ active: false, startY: 0, moved: 0, d: 0, lastY: 0, lastT: 0, vy: 0 });

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
    if (navBlocked) return;
    const now = performance.now();
    dragState.current = { active: true, startY: e.clientY, moved: 0, d: 0, lastY: e.clientY, lastT: now, vy: 0 };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = dragState.current;
    if (!s.active) return;
    const now = performance.now();
    const dt = now - s.lastT;
    if (dt > 0) {
      // 指数平滑,单个抖动的 move 不至于把速度带偏
      const v = (e.clientY - s.lastY) / dt;
      s.vy = s.vy * 0.4 + v * 0.6;
      s.lastY = e.clientY;
      s.lastT = now;
    }
    let d = e.clientY - s.startY;
    s.moved = Math.max(s.moved, Math.abs(d));
    if ((d > 0 && index === 0) || (d < 0 && index === uniqueVideos.length - 1)) d *= 0.32;
    s.d = d;
    setDragY(d);
  };
  const onTap = (e: React.PointerEvent) => {
    const now = Date.now();
    const rect = viewportRef.current?.getBoundingClientRect();
    if (now - lastTap.current < 300) {
      // 双击:取消掉挂起的单击,点亮红心
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
      lastTap.current = 0;
      if (rect) {
        const key = now;
        setHearts((h) => [...h, { key, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
        setTimeout(() => setHearts((h) => h.filter((x) => x.key !== key)), 900);
      }
      if (!liked) handleLike();
      return;
    }
    lastTap.current = now;
    // 单击 = 切换真实 <video> 的播放/暂停(外链播放器则是放行下一次点击)。
    // 等一下看是不是双击,免得双击点赞时视频先停了。
    if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
    singleTapTimer.current = setTimeout(() => videoPlayerRef.current?.togglePlay(), 260);
  };
  const endDrag = (e: React.PointerEvent) => {
    const s = dragState.current;
    if (!s.active) {
      // 移动端评论打开时,点一下视频区 = 收起评论
      if (navBlocked && !(e.target as HTMLElement).closest('[data-no-drag]')) setCommentsOpen(false);
      return;
    }
    s.active = false;
    setDragging(false);
    const d = s.d;
    if (s.moved < 6) {
      setDragY(0);
      // pointercancel 是浏览器/系统把手势收走了,不是一次点击 —— 以前也走 onTap,
      // 260ms 后 togglePlay 把刚划到的视频暂停。
      if (e.type !== 'pointercancel') onTap(e);
      return;
    }
    // 翻页判定(手机上「滑不动」的来源):以前要拖满视口 18%(手机上一百多像素)、不看速度,
    // 而且翻页后 380ms 的 navLock 把紧跟着的下一划也吞了。现在和抖音一样:
    //  - 拖过 10% 视口(至少 48px)就翻;
    //  - 或者是一次轻扫:松手前速度 > 0.3px/ms 且方向一致、位移过 16px。
    // 手指拖动是明确的意图,不受 navLock 限制(那是给滚轮/键盘连发用的)。
    // 停了一会儿才松手(>120ms 没有 move)不算轻扫,速度作废。
    const h = viewportRef.current?.clientHeight || 600;
    const threshold = Math.max(48, h * 0.1);
    const vy = performance.now() - s.lastT > 120 ? 0 : s.vy;
    const flickUp = vy < -0.3 && d < -16;
    const flickDown = vy > 0.3 && d > 16;
    if (d <= -threshold || flickUp) {
      if (index < uniqueVideos.length - 1) {
        setIndex((i) => i + 1);
        lockNav();
      } else {
        navLock.current = false;
        go(1); // 最后一条:给"加载中 / 到底了"的提示
      }
    } else if ((d >= threshold || flickDown) && index > 0) {
      setIndex((i) => i - 1);
      lockNav();
    }
    setDragY(0);
  };

  if (isLoading || (!video && (hasNextPage || isFetchingNextPage))) {
    return (
      <Box data-fill-main sx={{ width: '100%', height: '100%', minHeight: 240, bgcolor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={28} sx={{ color: 'rgba(255,255,255,0.6)' }} />
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

  const compactStage = navBlocked; // 移动端评论打开:视频区缩到上方,浮层全收起
  // 桌面端右侧留一条给操作栏,视频在剩下的区域里居中,操作按钮不压在外链播放器的控件上
  const actionRail = isDesktop ? 84 : 0;

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
        bgcolor: '#000',
        display: 'flex',
        flexDirection: isDesktop ? 'row' : 'column',
        ...CLIP,
        // 音乐底栏出现时首页 main 会在底部让出它的高度;推荐流不跟着缩(缩了 iframe 要重排、
        // 画面跳一下),而是伸到底栏下面,只把底部浮层往上抬 --player-inset。
        mb: 'calc(-1 * var(--player-inset, 0px))',
        // 双保险:即便某个滚轮/触摸事件漏掉了 preventDefault,也不让浏览器把
        // 溢出滚动/回弹链传到父级或触发原生下拉刷新。
        overscrollBehavior: 'contain',
      }}
    >
      {/* ── 舞台:视频 + 浮层 ── */}
      <Box
        sx={{
          position: 'relative',
          flex: isDesktop ? '1 1 auto' : '0 0 auto',
          minWidth: 0,
          minHeight: 0,
          height: isDesktop ? '100%' : compactStage ? MOBILE_STAGE_WITH_COMMENTS : '100%',
          transition: 'height 0.3s cubic-bezier(0.22, 0.61, 0.36, 1)',
          ...CLIP,
          // 桌面端做成圆角画布,和评论栏之间留条缝
          ...(isDesktop ? { m: 1, mr: commentsOpen ? 0 : 1, borderRadius: 3, bgcolor: '#0a0a0a' } : {}),
        }}
      >
        <Box
          ref={viewportRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          sx={{
            position: 'absolute',
            inset: 0,
            ...CLIP,
            touchAction: 'none',
            cursor: dragging ? 'grabbing' : 'default',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              // 百分比位移:translateY 的 % 相对自身高度,也就是一屏
              transform: `translateY(calc(${-index * 100}% + ${dragY}px))`,
              transition: dragging ? 'none' : 'transform 0.34s cubic-bezier(0.22, 0.61, 0.36, 1)',
              willChange: 'transform',
            }}
          >
            {uniqueVideos.map((v, i) => {
              // 只渲染当前和上下相邻的一屏:拖动时露得出来,其余不占 DOM
              if (Math.abs(i - index) > 1) return null;
              const active = i === index;
              return (
                <Box
                  // Use the lossless string id (idString) for stable identity on reorder.
                  key={`video-${v.idString ? `s-${v.idString}` : `${i}-${v.id}`}`}
                  sx={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: `${i * 100}%`,
                    height: '100%',
                    ...CLIP,
                    bgcolor: '#000',
                  }}
                >
                  {/* 封面糊底:横屏视频上下的黑边换成同一画面的虚化,和抖音一样不显得空 */}
                  <Box
                    aria-hidden
                    sx={{
                      position: 'absolute',
                      inset: '-40px',
                      background: v.cover ? `url("${mediaUrl(v.cover)}") center/cover no-repeat` : getContentTypeColor(v.contentType),
                      filter: 'blur(36px) brightness(0.45) saturate(1.2)',
                      transform: 'scale(1.1)',
                    }}
                  />
                  <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: actionRail }}>
                    {active && (videoSrc || canResolveLocally(v.sourceUrl || '')) ? (
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
                          background: `url("${mediaUrl(v.cover)}") center/contain no-repeat`,
                        }}
                      />
                    )}
                  </Box>

                  {/* 解析中:不挡滑动的小转圈;解析失败:明确的"暂时无法播放"卡片,划走就行 */}
                  {active && !videoSrc && streamLoading && (
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 2 }}>
                      <CircularProgress size={32} sx={{ color: 'rgba(255,255,255,0.75)' }} />
                    </Box>
                  )}
                  {active && !videoSrc && !streamLoading && streamError && (
                    <UnplayableCard video={v} streamError={streamError} />
                  )}

                  {/* 底部渐隐:让白字在任何画面上都读得清 */}
                  {!compactStage && (
                    <Box
                      aria-hidden
                      sx={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        height: '42%',
                        background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.22) 45%, rgba(0,0,0,0.62) 100%)',
                        pointerEvents: 'none',
                        zIndex: 1,
                      }}
                    />
                  )}

                  {active && !compactStage && (
                    <>
                      {/* 右侧操作栏 */}
                      <Box
                        data-no-drag
                        sx={{
                          position: 'absolute',
                          right: { xs: 8, md: 14 },
                          bottom: { xs: 'calc(34px + var(--player-inset, 0px))', md: 'calc(38px + var(--player-inset, 0px))' },
                          display: 'flex',
                          flexDirection: 'column',
                          gap: { xs: 1.5, md: 2 },
                          alignItems: 'center',
                          zIndex: 3,
                        }}
                      >
                        <Box sx={{ position: 'relative', mb: 1 }}>
                          <Avatar
                            src={video.authorAvatar}
                            onClick={() => handleCardClick(video)}
                            sx={{
                              width: 46,
                              height: 46,
                              border: '2px solid #fff',
                              background: getContentTypeColor(video.contentType),
                              cursor: 'pointer',
                            }}
                          >
                            {video.author?.[0]}
                          </Avatar>
                          <Box
                            onClick={handleFollow}
                            role="button"
                            aria-label={following ? '取消关注' : '关注'}
                            sx={{
                              position: 'absolute',
                              bottom: -9,
                              left: '50%',
                              transform: 'translateX(-50%)',
                              width: 20,
                              height: 20,
                              borderRadius: '50%',
                              bgcolor: following ? '#fff' : ACCENT,
                              color: following ? ACCENT : '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              opacity: followBusy ? 0.6 : 1,
                              transition: 'background-color .2s, color .2s',
                            }}
                          >
                            {following ? <CheckRoundedIcon sx={{ fontSize: 14 }} /> : <AddRoundedIcon sx={{ fontSize: 14 }} />}
                          </Box>
                        </Box>

                        <SideAction
                          active={liked}
                          label="点赞"
                          onClick={(e) => { e.stopPropagation(); handleLike(); }}
                          icon={liked ? <FavoriteRoundedIcon sx={{ fontSize: 32 }} /> : <FavoriteBorderRoundedIcon sx={{ fontSize: 32 }} />}
                          value={formatCount(likedCount)}
                          activeColor={ACCENT}
                          badge={likeBurst && likeBurst.id === video.id ? String(likeBurst.key) : null}
                        />
                        <SideAction
                          active={commentsOpen}
                          label="评论"
                          icon={<ModeCommentRoundedIcon sx={{ fontSize: 29 }} />}
                          value={formatCount(commentTotals[videoKey ?? ''] ?? video.comments)}
                          onClick={handleCommentClick}
                          activeColor="#fff"
                        />
                        <SideAction
                          active={collected}
                          label="收藏"
                          onClick={(e) => { e.stopPropagation(); handleCollect(); }}
                          icon={collected ? <BookmarkRoundedIcon sx={{ fontSize: 30 }} /> : <BookmarkBorderRoundedIcon sx={{ fontSize: 30 }} />}
                          value={formatCount(collectedCount)}
                          activeColor="#FFC300"
                        />
                        <SideAction
                          label="分享"
                          icon={<ReplyRoundedIcon sx={{ fontSize: 30, transform: 'scaleX(-1)' }} />}
                          value={formatCount(video.shares)}
                          onClick={handleShare}
                        />
                        <SideAction label="更多" icon={<MoreHorizRoundedIcon sx={{ fontSize: 28 }} />} value="" onClick={handleMore} />
                      </Box>

                      {/* 左下:作者 / 标题 / 来源 */}
                      <Box
                        sx={{
                          position: 'absolute',
                          left: { xs: 14, md: 22 },
                          right: { xs: 76, md: 110 },
                          bottom: { xs: 'calc(30px + var(--player-inset, 0px))', md: 'calc(34px + var(--player-inset, 0px))' }, // 让出底边的进度条
                          zIndex: 3,
                          color: '#fff',
                          textShadow: TEXT_SHADOW,
                        }}
                      >
                        <Box
                          data-no-drag
                          onClick={() => handleCardClick(video)}
                          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mb: 0.5, cursor: 'pointer' }}
                        >
                          <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>@{video.author}</Typography>
                          {video.verified && <VerifiedRoundedIcon sx={{ fontSize: 15, color: '#20D5EC' }} />}
                        </Box>
                        <Typography
                          sx={{
                            fontSize: 14,
                            lineHeight: 1.5,
                            color: 'rgba(255,255,255,0.95)',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            maxWidth: 560,
                          }}
                        >
                          {video.caption}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75, fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
                          <Box component="span" sx={{ px: 0.75, borderRadius: 0.75, bgcolor: 'rgba(255,255,255,0.16)', lineHeight: '18px' }}>
                            {video.brand}
                          </Box>
                          <span>{formatCount(video.views)} 次播放</span>
                          <Box
                            component="span"
                            data-no-drag
                            onClick={() => handleCardClick(video)}
                            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, cursor: 'pointer', '&:hover': { color: '#fff' } }}
                          >
                            详情 <OpenInNewRoundedIcon sx={{ fontSize: 12 }} />
                          </Box>
                        </Box>
                      </Box>
                    </>
                  )}
                </Box>
              );
            })}
          </Box>

          {/* 双击红心 */}
          {hearts.map((h) => (
            <FavoriteRoundedIcon
              key={h.key}
              sx={{
                position: 'absolute',
                left: h.x - 40,
                top: h.y - 40,
                fontSize: 80,
                color: ACCENT,
                pointerEvents: 'none',
                zIndex: 5,
                filter: 'drop-shadow(0 4px 12px rgba(254,44,85,0.45))',
                animation: 'feedHeartPop 0.9s ease-out forwards',
                '@keyframes feedHeartPop': {
                  '0%': { opacity: 0, transform: 'scale(0.4) rotate(-12deg)' },
                  '18%': { opacity: 1, transform: 'scale(1.15) rotate(-6deg)' },
                  '35%': { transform: 'scale(1) rotate(-6deg)' },
                  '100%': { opacity: 0, transform: 'translateY(-90px) scale(1.4) rotate(-6deg)' },
                },
              }}
            />
          ))}
        </Box>

        {/* 弹幕层:站内评论滚动飘过 */}
        {!compactStage && <DanmakuLayer items={danmaku.flying} onLand={danmaku.land} />}

        {/* 桌面端:上下翻页按钮(抖音网页版同款) */}
        {isDesktop && (
          <Box data-no-drag sx={{ position: 'absolute', right: 20, top: 20, display: 'flex', flexDirection: 'column', gap: 1, zIndex: 4 }}>
            <IconButton aria-label="上一个" onClick={() => go(-1)} disabled={index === 0} sx={{ ...GLASS, color: '#fff', '&.Mui-disabled': { color: 'rgba(255,255,255,0.25)' }, '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' } }}>
              <KeyboardArrowUpRoundedIcon />
            </IconButton>
            <IconButton aria-label="下一个" onClick={() => go(1)} sx={{ ...GLASS, color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' } }}>
              <KeyboardArrowDownRoundedIcon />
            </IconButton>
          </Box>
        )}
      </Box>

      {/* ── 评论栏:桌面右侧挤压视频,移动端从下方升起把视频推上去 ── */}
      <Box
        data-feed-comments
        data-no-drag
        aria-hidden={!commentsOpen}
        sx={{
          position: 'relative',
          flexShrink: 0,
          overflow: 'hidden',
          bgcolor: 'background.paper',
          color: 'text.primary',
          transition: isDesktop
            ? 'width 0.3s cubic-bezier(0.22, 0.61, 0.36, 1)'
            : 'height 0.3s cubic-bezier(0.22, 0.61, 0.36, 1)',
          ...(isDesktop
            ? { width: commentsOpen ? DESKTOP_COMMENTS_W : 0, height: '100%' }
            : {
                width: '100%',
                height: commentsOpen ? `calc(100% - ${MOBILE_STAGE_WITH_COMMENTS})` : 0,
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
              }),
        }}
      >
        {commentsOpen && video && (
          <Box sx={{ position: 'absolute', inset: 0, width: isDesktop ? DESKTOP_COMMENTS_W : '100%', display: 'flex', flexDirection: 'column' }}>
            {!isDesktop && (
              <Box aria-hidden sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'divider', mx: 'auto', mt: 1, flexShrink: 0 }} />
            )}
            <IconButton
              aria-label="收起评论"
              onClick={() => setCommentsOpen(false)}
              size="small"
              sx={{ position: 'absolute', top: isDesktop ? 14 : 14, right: 12, zIndex: 1 }}
            >
              <CloseRoundedIcon sx={{ fontSize: 20 }} />
            </IconButton>
            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                px: 2,
                pt: isDesktop ? 1.5 : 0.5,
                pb: 'calc(16px + var(--player-inset, 0px))',
                // DetailComments 的展开模式开头带一条分隔线(详情页用),栏里不要
                '& > .MuiBox-root > .MuiDivider-root:first-of-type': { display: 'none' },
              }}
            >
              <DetailComments
                key={videoKey ?? ''}
                contentId={video.idString || video.id}
                initialCount={commentTotals[videoKey ?? ''] ?? video.comments}
                onTotalChange={(n) => videoKey && setCommentTotals((m) => (m[videoKey] === n ? m : { ...m, [videoKey]: n }))}
              />
            </Box>
          </Box>
        )}
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

      {/* 更多:和画面同一套深色毛玻璃,不跳出一个白色系统弹窗 */}
      <Dialog
        open={moreDialogOpen}
        onClose={() => setMoreDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              ...GLASS,
              bgcolor: 'rgba(22, 22, 26, 0.92)',
              color: '#fff',
              borderRadius: 3,
              backgroundImage: 'none',
              ...(isDesktop ? {} : { position: 'fixed', bottom: 0, m: 0, width: '100%', maxWidth: '100%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }),
            },
          },
        }}
      >
        <Box sx={{ p: 1 }}>
          {[
            { label: '不感兴趣', onClick: handleNotInterested },
            { label: danmakuOn ? '关闭弹幕' : '开启弹幕', onClick: () => { toggleDanmaku(); setMoreDialogOpen(false); } },
            { label: '复制链接', onClick: handleCopyLink },
            { label: '查看详情', onClick: () => { setMoreDialogOpen(false); handleCardClick(video); } },
            { label: '举报', onClick: handleReport, danger: true },
          ].map((it) => (
            <Box
              key={it.label}
              role="button"
              tabIndex={0}
              onClick={it.onClick}
              onKeyDown={(e) => { if (e.key === 'Enter') it.onClick(); }}
              sx={{
                px: 2,
                py: 1.5,
                borderRadius: 2,
                fontSize: 15,
                cursor: 'pointer',
                color: it.danger ? ACCENT : '#fff',
                '&:hover, &:focus-visible': { bgcolor: 'rgba(255,255,255,0.08)', outline: 'none' },
              }}
            >
              {it.label}
            </Box>
          ))}
          <Box
            role="button"
            tabIndex={0}
            onClick={() => setMoreDialogOpen(false)}
            sx={{ mt: 0.5, px: 2, py: 1.5, borderRadius: 2, fontSize: 15, textAlign: 'center', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', borderTop: '1px solid rgba(255,255,255,0.08)' }}
          >
            取消
          </Box>
        </Box>
      </Dialog>
    </Box>
  );
}

/**
 * 这条放不了时的说明卡片。图标、标题分故障和非故障:直播间没开播用中性的"休息中",
 * 不能用警告色 —— 那会让用户以为我们坏了。
 */
function UnplayableCard({ video: v, streamError }: { video: VideoItem; streamError: string }) {
  return (
    <Box
      data-no-drag
      sx={{
        ...GLASS,
        bgcolor: 'rgba(0, 0, 0, 0.55)',
        position: 'absolute',
        top: '45%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        px: 3,
        py: 2,
        borderRadius: 3,
        zIndex: 2,
        textAlign: 'center',
        maxWidth: 280,
        color: '#fff',
      }}
    >
      {v.playbackStatus === 'live_offline' ? (
        <BedtimeRoundedIcon sx={{ fontSize: 32, color: 'rgba(255,255,255,0.6)' }} />
      ) : v.playbackStatus === 'bandwidth_limited' ? (
        <CloudOffRoundedIcon sx={{ fontSize: 32, color: 'rgba(255,255,255,0.6)' }} />
      ) : (
        <ErrorOutlineRoundedIcon sx={{ fontSize: 32, color: '#FFB020' }} />
      )}
      <Typography sx={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>
        {v.playbackStatus === 'live_offline'
          ? '主播未开播'
          : v.playbackStatus === 'bandwidth_limited'
            ? '暂不支持站内播放'
            : v.playbackStatus === 'pending_repair'
              ? '内容修复中'
              : '该内容暂时无法播放'}
      </Typography>
      <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
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
          sx={{
            mt: 0.5,
            px: 2,
            py: 0.5,
            borderRadius: 999,
            fontSize: 12,
            color: '#fff',
            textDecoration: 'none',
            bgcolor: ACCENT,
          }}
        >
          {originOnlyPlatform(v.sourceUrl) ? `去${originOnlyPlatform(v.sourceUrl)}观看` : '去原站观看'}
        </Box>
      )}
    </Box>
  );
}

// 右侧单个按钮:抖音式的"裸图标 + 数字",图标和数字都带投影,在亮画面上也看得清。
// 按下缩到 0.88 再回弹;点赞时从图标中心冒出 "+1" 气泡,800ms 内向上飞并淡出。
function SideAction({
  icon,
  value,
  label,
  active,
  activeColor,
  onClick,
  badge,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  active?: boolean;
  activeColor?: string;
  onClick?: (e: React.MouseEvent) => void;
  badge?: string | null;
}) {
  return (
    <Box
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={label}
      aria-pressed={active}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => { if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(e as unknown as React.MouseEvent); } }}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.25,
        cursor: onClick ? 'pointer' : 'default',
        outline: 'none',
        '&:focus-visible > .side-icon': { outline: '2px solid rgba(255,255,255,0.7)', outlineOffset: 2 },
      }}
    >
      <Box
        className="side-icon"
        sx={{
          position: 'relative',
          width: 44,
          height: 44,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: active && activeColor ? activeColor : '#fff',
          filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.45))',
          transition: 'transform 0.18s cubic-bezier(0.22, 0.61, 0.36, 1), color 0.18s',
          '&:hover': { transform: 'scale(1.08)' },
          '&:active': { transform: 'scale(0.88)' },
        }}
      >
        {icon}
        {badge && (
          // 用 badge 字符串作 key 已经足够:同一次点赞只会进入 React 一次 render,
          // 后续再次点击由父组件 setLikeBurst 重新挂载一个新的 badge 子节点。
          <Box
            key={badge}
            sx={{
              position: 'absolute',
              top: 6,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 14,
              fontWeight: 800,
              color: ACCENT,
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
            +1
          </Box>
        )}
      </Box>
      {value !== '' && (
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 600,
            color: '#fff',
            textShadow: TEXT_SHADOW,
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

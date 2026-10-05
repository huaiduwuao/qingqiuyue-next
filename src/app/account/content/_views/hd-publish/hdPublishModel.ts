// 高清发布页的类型、常量与纯函数(从 page.tsx 拆出,无 React 依赖)。
import type { getReviewerList, Reviewer as ApiReviewer } from '@/apis/dashboard';
import type { ModuleContentItem } from '@/apis/module-content';
import { gradient2 } from '@/constants/gradients';
import { FAST_CHANNEL_MONTHLY, type HdResolution, type HdStatus, type HdVideo, type Reviewer } from './data';

export type SnackSeverity = 'success' | 'error' | 'info' | 'warning';
export interface SnackMsg {
  msg: string;
  severity: SnackSeverity;
}

export const QUALITY_PRESETS: { id: HdResolution; label: string; bitrate: string; size: string; popular?: boolean }[] = [
  { id: '4K', label: '4K 超清', bitrate: '60 Mbps', size: '适合 ≤ 20 min', popular: true },
  { id: '2K', label: '2K 高清', bitrate: '30 Mbps', size: '适合 ≤ 30 min' },
  { id: '1080P', label: '1080P 高清', bitrate: '12 Mbps', size: '适合 ≤ 60 min' },
  { id: '720P', label: '720P 标清', bitrate: '6 Mbps', size: '适合长视频' },
];

export const RESOLUTION_META: Record<HdResolution, { color: string; bg: string; label: string }> = {
  '4K': { color: '#FE2C55', bg: 'rgba(254, 44, 85, 0.12)', label: '4K' },
  '2K': { color: 'var(--fg-amber)', bg: 'rgba(255, 180, 0, 0.12)', label: '2K' },
  '1080P': { color: 'var(--fg-cyan)', bg: 'rgba(37, 244, 238, 0.12)', label: '1080P' },
  '720P': { color: 'var(--fg-green)', bg: 'rgba(93, 219, 150, 0.12)', label: '720P' },
};

export function formatSize(mb: number): string {
  if (mb < 1024) return `${mb} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

// relativeTime() 已废弃:直接调用 Date.now() 在 SSR/CSR 阶段值不同,会引发 hydration mismatch。
// 改用 <RelativeTime ts={...} /> 组件,在 client mount 后才计算显示。

export function mapContentStatusToHd(status?: string): HdStatus {
  const s = status?.toLowerCase() || '';
  if (s === 'reviewing' || s === 'review') return 'reviewing';
  if (s === 'publish' || s === 'published' || s === 'online') return 'published';
  if (s === 'un_publish' || s === 'offline' || s === 'reject' || s === 'rejected' || s === 'review_failed') return 'review_failed';
  if (s === 'failed' || s === 'error') return 'failed';
  if (s === 'scheduled' || s === 'schedule') return 'scheduled';
  if (s === 'transcoding') return 'transcoding';
  // 默认放在转码中,符合 HD 发布流程
  return 'transcoding';
}

/**
 * 后端 /creator/hd/videos 的 list → HdVideo[]。按 id 去重:后端在 stale cache 命中或测试数据偶发会
 * 返回两条同 id 的记录,触发 React duplicate key 警告,严重时导致 fiber 错位渲染
 * (用户反馈「界面下部分黑色遮罩 + 点哪都出现视频详情」)。Map 去重即可消除该现象。
 */
export function dedupeHdVideos(list: any[] | undefined): HdVideo[] {
  return Array.from(
    new Map(
      (list ?? [])
        .filter((v: any) => v && v.id !== undefined && v.id !== null)
        .map((v: any) => [String(v.id), v] as const),
    ).values(),
  ).map((v: any) => ({
    id: String(v.id), title: v.title, cover: v.cover,
    resolution: v.resolution, fps: v.fps, hdr: v.hdr, duration: v.duration, sizeMB: v.sizeMB,
    // 后端给的是库里的原始状态(REVIEWING / REJECTED / 历史小写值),归到 HD 流程状态,
    // 否则「转码中」统计和状态标签都对不上
    status: mapContentStatusToHd(v.status), progress: v.progress, uploadedAt: v.uploadedAt,
    views: v.views, likes: v.likes, hasCover: v.hasCover,
    subtitles: [], audioTracks: [],
  }));
}

/** http(s) 地址或站内路径(封面图片、视频文件都用它判);渐变色占位、data:/javascript: 等都不算。 */
export function isUrlLike(s: string | undefined): s is string {
  return !!s && (/^https?:\/\/[^/]/i.test(s) || (s.startsWith('/') && !s.startsWith('//')));
}

/**
 * 封面的 CSS background:图片地址包成 url(),渐变色占位原样用。
 * 此前直接把 cover 塞进 background,真封面(图片地址)是无效的 CSS,一律显示成空白。
 */
export function coverBackground(cover: string | undefined): string | undefined {
  if (!cover) return undefined;
  if (isUrlLike(cover)) return `center / cover no-repeat url("${encodeURI(decodeURISafe(cover)).replace(/"/g, '%22')}")`;
  return cover;
}

function decodeURISafe(s: string): string {
  try {
    return decodeURI(s);
  } catch {
    return s;
  }
}

// 只认视频文件地址;source_url 之类多半是外站播放页,截不了帧
const VIDEO_URL_KEYS = ['videoUrl', 'video_url', 'mp4Url', 'playUrl'];

function pickVideoUrl(raw: string | undefined): string | undefined {
  if (!raw || raw[0] !== '{') return undefined;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    for (const k of VIDEO_URL_KEYS) {
      const v = obj[k];
      if (typeof v === 'string' && isUrlLike(v.trim())) return v.trim();
    }
  } catch {
    // 不是 JSON:没有可截帧的视频地址
  }
  return undefined;
}

/** 管理列表行里的视频文件地址:上传器写在正文 JSON 的 videoUrl,其余表单可能写在 metadata。 */
export function extractVideoUrl(item: Pick<ModuleContentItem, 'content' | 'metadata'>): string | undefined {
  return pickVideoUrl(item.content?.trim()) ?? pickVideoUrl(item.metadata?.trim());
}

/** 管理列表里的 VIDEO 内容(module_content)→ HdVideo,用于并进本地列表。 */
export function moduleContentToHdVideo(item: ModuleContentItem): HdVideo {
  return {
    id: String(item.id),
    title: item.title || '(无标题)',
    cover: item.coverUrl || item.cover || gradient2('#FE2C55', '#FFB400'),
    resolution: '1080P',
    fps: 30,
    hdr: false,
    duration: '00:00',
    sizeMB: 0,
    status: mapContentStatusToHd(item.status),
    uploadedAt: item.createTime ? new Date(item.createTime).getTime() : Date.now(),
    hasCover: !!(item.coverUrl || item.cover),
    subtitles: [],
    audioTracks: [{ id: 'a1', label: '原声', codec: 'AAC 320kbps', isDefault: true }],
    views: item.readNum ?? 0,
    likes: item.agreeNum ?? 0,
    videoUrl: extractVideoUrl(item),
  };
}

/**
 * 两路服务端数据合成一份列表:HD 视频接口(/creator/hd/videos,未上线的视频,带分辨率等)为主,
 * 管理列表里的 VIDEO 内容(含已上线的)补上 HD 接口里没有的 id,排在前面。
 */
export function mergeServerHdVideos(hdVideos: HdVideo[], manageItems: ModuleContentItem[] | undefined): HdVideo[] {
  const ids = new Set(hdVideos.map((v) => v.id));
  const extra: HdVideo[] = [];
  // HD 接口不带视频地址,同一条在管理列表里有就借过来(换封面截帧用)
  const videoUrls = new Map<string, string>();
  for (const item of manageItems ?? []) {
    if (!item || item.id === undefined || item.id === null) continue;
    const id = String(item.id);
    if (ids.has(id)) {
      const url = extractVideoUrl(item);
      if (url && !videoUrls.has(id)) videoUrls.set(id, url);
      continue;
    }
    ids.add(id);
    extra.push(moduleContentToHdVideo(item));
  }
  const main = videoUrls.size
    ? hdVideos.map((v) => (!v.videoUrl && videoUrls.has(v.id) ? { ...v, videoUrl: videoUrls.get(v.id) } : v))
    : hdVideos;
  return [...extra, ...main];
}

/**
 * 还没被服务端数据覆盖到的本地乐观改动。列表 = 服务端数据 + 这些改动按顺序叠上去:
 * - remove:删除 / 立即发布,先从列表拿掉;
 * - update:重新转码 / 送审 / 极速通道 / 换封面,先改界面;
 * - add:刚上传、服务端已建好但列表还没拉到的视频。
 * 请求失败就把这条改动撤掉(露出服务端的真实状态 = 回滚);请求成功记下当时各路服务端数据
 * 各自落定过几次(confirmedAt),等各路都在这之后再落定一次(拿到新数据或拉取失败)才撤掉,
 * 此后以服务端为准。用次数不用时间戳:请求和重拉落在同一毫秒时时间戳分不出先后。
 * 机制见 useOptimisticOverlay(高清发布、审核员工作台共用)。
 */
/** 各路服务端数据(按来源名)落定过的次数 */
export type HdSyncMark = Record<string, number>;
export type HdPendingOp =
  | { opId: number; kind: 'remove'; videoId: string; confirmedAt?: HdSyncMark }
  | { opId: number; kind: 'update'; videoId: string; apply: (v: HdVideo) => HdVideo; confirmedAt?: HdSyncMark }
  | { opId: number; kind: 'add'; videoId: string; video: HdVideo; confirmedAt?: HdSyncMark };

/** 还要叠在服务端数据上的改动:未确认的,或确认后还有哪一路数据没再刷新过的。 */
export function liveHdOps(ops: HdPendingOp[], synced: HdSyncMark): HdPendingOp[] {
  return ops.filter((op) => {
    const mark = op.confirmedAt;
    return !mark || Object.keys(mark).some((k) => (synced[k] ?? 0) <= mark[k]);
  });
}

export function applyHdOps(server: HdVideo[], ops: HdPendingOp[]): HdVideo[] {
  let list = server;
  for (const op of ops) {
    if (op.kind === 'remove') {
      list = list.filter((v) => v.id !== op.videoId);
    } else if (op.kind === 'update') {
      list = list.map((v) => (v.id === op.videoId ? op.apply(v) : v));
    } else if (!list.some((v) => v.id === op.videoId)) {
      list = [op.video, ...list];
    }
  }
  return list;
}

/** 审核员接口 → 页面用的 Reviewer(平均审核时长后端没给,固定 300 秒)。 */
export function mapApiReviewers(resp: Awaited<ReturnType<typeof getReviewerList>> | undefined): Reviewer[] {
  return (resp?.records ?? resp?.list ?? []).map((r: ApiReviewer) => ({
    id: r.id, name: r.name, initials: r.initials, avatarColor: r.avatarColor,
    team: r.team, level: r.level as 1 | 2 | 3, title: r.title,
    reviewCount: r.reviewCount, avgReviewSec: 300, passRate: r.passRate,
    online: r.online, currentLoad: r.currentLoad, maxLoad: r.maxLoad, specialties: r.specialties,
  }));
}

/** 顶部统计:今日上传、高清数、极速通道余量、转码中、今日审核数 / 通过率 / 平均审核时长。 */
export function computeHdStats(videos: HdVideo[], fastChannelQuota: number, now: number = Date.now()) {
  const today = now - 86400000;
  const todayReviewed = videos.filter(
    (v) => v.review?.completedAt && v.review.completedAt >= today,
  );
  const passed = todayReviewed.filter((v) => v.review?.result === 'pass').length;
  const rejected = todayReviewed.filter((v) => v.review?.result === 'reject').length;
  const totalReviewed = passed + rejected;
  const avgReviewMs = todayReviewed
    .filter((v) => v.review?.startedAt && v.review?.completedAt)
    .map((v) => (v.review!.completedAt! - v.review!.startedAt!))
    .reduce((a, b, _, arr) => a + b / arr.length, 0);
  return {
    todayUploads: videos.filter((v) => v.uploadedAt >= today).length,
    hdCount: videos.filter((v) => v.resolution === '4K' || v.resolution === '2K').length,
    fastChannelQuota,
    fastChannelMonthly: FAST_CHANNEL_MONTHLY,
    transcoding: videos.filter((v) => v.status === 'transcoding').length,
    todayReviewed: totalReviewed,
    passRate: totalReviewed > 0 ? (passed / totalReviewed) * 100 : 0,
    avgReviewMin: avgReviewMs > 0 ? Math.max(1, Math.round(avgReviewMs / 60000)) : 0,
  };
}
export type HdStats = ReturnType<typeof computeHdStats>;

/** 审核历史:有审核信息的视频,按完成(或开始)时间倒序。 */
export function buildReviewHistory(videos: HdVideo[]) {
  return videos
    .filter((v) => v.review)
    .map((v) => ({
      videoId: v.id,
      title: v.title,
      cover: v.cover,
      resolution: v.resolution,
      review: v.review!,
      status: v.status,
    }))
    .sort((a, b) => (b.review.completedAt ?? b.review.startedAt ?? 0) - (a.review.completedAt ?? a.review.startedAt ?? 0));
}

/** 上传文件状态机(用于提交按钮 disabled + 失败保护)。 */
export type UploadStatus = 'idle' | 'uploading' | 'uploaded' | 'failed';

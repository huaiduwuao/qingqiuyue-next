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
    status: v.status, progress: v.progress, uploadedAt: v.uploadedAt,
    views: v.views, likes: v.likes, hasCover: v.hasCover,
    subtitles: [], audioTracks: [],
  }));
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
  };
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

// HD 发布/审核页面的共享常量与类型。
// 注意:这里只放"类型 + 不属于业务数据的常量(颜色映射、状态枚举等)",不再放 SEED。
// 业务数据全部从后端 /api/core/creator/hd/* 拉,见 ../hd-publish/page.tsx 与 ../hd-review/page.tsx。

export type HdResolution = '4K' | '2K' | '1080P' | '720P';
export type HdStatus = 'transcoding' | 'reviewing' | 'review_failed' | 'published' | 'failed' | 'scheduled';
export type HdFilter = 'all' | 'transcoding' | 'reviewing' | 'review_failed' | 'published' | 'failed';

export type ReviewCheckId =
  | 'ai_content'
  | 'sensitive_words'
  | 'copyright'
  | 'cover_check'
  | 'subtitle_check'
  | 'manual_review';
export type ReviewCheckStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

export interface SubtitleTrack {
  id: string;
  lang: string;
  label: string;
  isDefault: boolean;
}

export interface AudioTrack {
  id: string;
  label: string;
  codec: string;
  isDefault: boolean;
}

export interface ReviewCheck {
  id: ReviewCheckId;
  label: string;
  desc: string;
  status: ReviewCheckStatus;
  duration?: number;
  message?: string;
}

export interface ReviewRejection {
  checkId: ReviewCheckId;
  category: string;
  detail: string;
  timestamp: number;
  frameAt?: string;
}

export type ReviewerLevel = 1 | 2 | 3;

export interface Reviewer {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  team: string;
  level: ReviewerLevel;
  title: string;
  reviewCount: number;
  avgReviewSec: number;
  passRate: number;
  online: boolean;
  currentLoad: number;
  maxLoad: number;
  specialties: string[];
}

export type ReviewerDecision = 'pass' | 'reject' | 'request_changes';

export interface ReviewerVerdict {
  decision: ReviewerDecision;
  note: string;
  reviewerId: string;
  timestamp: number;
  appealable: boolean;
  appealDeadline?: number;
}

export interface ReviewInfo {
  checks: ReviewCheck[];
  startedAt?: number;
  completedAt?: number;
  result?: 'pass' | 'reject';
  rejections?: ReviewRejection[];
  useFastChannel?: boolean;
  fastChannelChargedAt?: number;
  assignedReviewerId?: string;
  queuePosition?: number;
  estimatedWaitMin?: number;
  reviewerVerdict?: ReviewerVerdict;
}

export interface HdVideo {
  id: string;
  title: string;
  cover: string;
  resolution: HdResolution;
  fps: number;
  hdr: boolean;
  duration: string;
  sizeMB: number;
  status: HdStatus;
  progress?: number;
  uploadedAt: number;
  publishedAt?: number;
  views?: number;
  likes?: number;
  failedReason?: string;
  failedStage?: 'transcode' | 'review';
  scheduledAt?: number;
  subtitles: SubtitleTrack[];
  audioTracks: AudioTrack[];
  hasCover: boolean;
  review?: ReviewInfo;
}

export const REVIEW_CHECK_TEMPLATE: Pick<ReviewCheck, 'id' | 'label' | 'desc'>[] = [
  { id: 'ai_content', label: 'AI 内容初审', desc: '画面/语音多模态识别违规内容' },
  { id: 'sensitive_words', label: '敏感词扫描', desc: '标题/简介/字幕敏感词命中检测' },
  { id: 'copyright', label: '版权指纹比对', desc: '与全网版权库指纹碰撞' },
  { id: 'cover_check', label: '封面合规', desc: '封面图像合规 + 文字 OCR 检测' },
  { id: 'subtitle_check', label: '字幕审查', desc: '多语言字幕违规内容复检' },
  { id: 'manual_review', label: '人工复审', desc: 'AI 标记存疑内容由人工二次确认' },
];

export const FAST_CHANNEL_MONTHLY = 10;

export const REVIEWER_LEVEL_META: Record<ReviewerLevel, { label: string; color: string; bg: string }> = {
  1: { label: '初级', color: '#5B8DEF', bg: 'rgba(91, 141, 239, 0.12)' },
  2: { label: '中级', color: '#FFB400', bg: 'rgba(255, 180, 0, 0.12)' },
  3: { label: '高级', color: '#FE2C55', bg: 'rgba(254, 44, 85, 0.12)' },
};
// 网络异常时的兜底数据。正常情况 UI 全部走 useQuery 拉后端 /api/core/creator/hd/*,
// 此处仅在 API 失败 / 暂无数据时显示。
import { gradient3, gradient2 } from '@/constants/gradients';

export const SEED_REVIEWERS: Reviewer[] = [
  { id: 'r-001', name: '林梓涵', initials: '梓', avatarColor: 'linear-gradient(135deg, #FE2C55 0%, #8B5CF6 100%)', team: 'A 班', level: 3, title: '高级审核员 · 审核组长', reviewCount: 12840, avgReviewSec: 280, passRate: 96.4, online: true, currentLoad: 4, maxLoad: 6, specialties: ['游戏', '科技', '开箱'] },
  { id: 'r-002', name: '陈逸飞', initials: '逸', avatarColor: 'linear-gradient(135deg, #FFB400 0%, #FE2C55 100%)', team: 'A 班', level: 2, title: '中级审核员', reviewCount: 6291, avgReviewSec: 412, passRate: 92.1, online: true, currentLoad: 3, maxLoad: 5, specialties: ['vlog', '美食', '旅行'] },
  { id: 'r-003', name: '苏婉清', initials: '婉', avatarColor: 'linear-gradient(135deg, #25F4EE 0%, #5B8DEF 100%)', team: 'B 班', level: 3, title: '高级审核员', reviewCount: 9842, avgReviewSec: 198, passRate: 97.8, online: true, currentLoad: 2, maxLoad: 6, specialties: ['影视', '综艺', '音乐'] },
  { id: 'r-004', name: '赵明哲', initials: '哲', avatarColor: 'linear-gradient(135deg, #8B5CF6 0%, #25F4EE 100%)', team: 'B 班', level: 2, title: '中级审核员', reviewCount: 4823, avgReviewSec: 360, passRate: 90.5, online: true, currentLoad: 1, maxLoad: 5, specialties: ['教育', '知识', '财经'] },
  { id: 'r-005', name: '周雨桐', initials: '桐', avatarColor: 'linear-gradient(135deg, #5DDB96 0%, #25F4EE 100%)', team: 'C 班', level: 1, title: '初级审核员', reviewCount: 1287, avgReviewSec: 520, passRate: 88.2, online: false, currentLoad: 0, maxLoad: 4, specialties: ['生活', '萌宠', '亲子'] },
  { id: 'r-006', name: '吴彦霖', initials: '霖', avatarColor: 'linear-gradient(135deg, #FE2C55 0%, #FFB400 100%)', team: 'C 班', level: 2, title: '中级审核员', reviewCount: 5621, avgReviewSec: 388, passRate: 93.6, online: false, currentLoad: 0, maxLoad: 5, specialties: ['汽车', '体育', '户外'] },
];

export const SEED: HdVideo[] = [
  { id: 'hd-001', title: '【4K HDR】2026 跨年夜烟花盛典', cover: gradient3('#FE2C55', '#FF6B8A', '#FFB400'), resolution: '4K', fps: 60, hdr: true, duration: '12:34', sizeMB: 2840, status: 'published', uploadedAt: Date.now() - 86400000 * 2, views: 482931, likes: 38291, hasCover: true, subtitles: [], audioTracks: [] },
  { id: 'hd-002', title: '4K 风景纪录片｜阿尔卑斯山脉航拍', cover: gradient3('#5B8DEF', '#8B5CF6', '#25F4EE'), resolution: '4K', fps: 30, hdr: true, duration: '24:18', sizeMB: 5820, status: 'published', uploadedAt: Date.now() - 86400000 * 5, views: 1284932, likes: 89432, hasCover: true, subtitles: [], audioTracks: [] },
  { id: 'hd-003', title: '【游戏】赛博朋克 2077 实机 4K 60fps', cover: gradient3('#FE2C55', '#8B5CF6', '#25F4EE'), resolution: '4K', fps: 60, hdr: false, duration: '38:42', sizeMB: 7240, status: 'transcoding', progress: 67, uploadedAt: Date.now() - 3600000 * 2, hasCover: true, subtitles: [], audioTracks: [] },
  { id: 'hd-004', title: '1080P 美食教程｜深夜食堂合集', cover: gradient3('#FFB400', '#FE2C55', '#8B5CF6'), resolution: '1080P', fps: 30, hdr: false, duration: '15:42', sizeMB: 1840, status: 'reviewing', progress: 100, uploadedAt: Date.now() - 3600000 * 1, hasCover: true, subtitles: [], audioTracks: [] },
  { id: 'hd-005', title: '【4K】Sony A7M4 开箱 + 镜头测试', cover: gradient3('#8B5CF6', '#FE2C55', '#FFB400'), resolution: '4K', fps: 30, hdr: true, duration: '18:21', sizeMB: 3920, status: 'failed', uploadedAt: Date.now() - 86400000 * 1, hasCover: false, subtitles: [], audioTracks: [], failedReason: '视频编码不兼容 (H.265 10bit)' },
];

export function getReviewerById(id: string): Reviewer | undefined {
  return SEED_REVIEWERS.find((r) => r.id === id);
}

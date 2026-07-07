// HD 发布/审核页面的共享常量与类型。
// 这里只放"类型 + UI 元数据(颜色/标签等)",不放任何业务数据(SEED 已彻底删除)。
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
// Shared types + seed data for the HD publish + reviewer console pages.
// Anything the reviewer console needs lives here so both pages stay in sync.

import { gradient3 } from '@/constants/gradients';

// ========== Types ==========

export type HdResolution = '4K' | '2K' | '1080P' | '720P';
export type HdStatus = 'transcoding' | 'reviewing' | 'review_failed' | 'published' | 'failed' | 'scheduled';
export type HdFilter = 'all' | 'transcoding' | 'reviewing' | 'review_failed' | 'published' | 'failed';

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

export type ReviewCheckId =
  | 'ai_content'
  | 'sensitive_words'
  | 'copyright'
  | 'cover_check'
  | 'subtitle_check'
  | 'manual_review';
export type ReviewCheckStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

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

// ========== Constants ==========

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

// ========== SEED: Reviewers ==========

export const SEED_REVIEWERS: Reviewer[] = [
  {
    id: 'r-001',
    name: '林梓涵',
    initials: '梓',
    avatarColor: 'linear-gradient(135deg, #FE2C55 0%, #8B5CF6 100%)',
    team: 'A 班',
    level: 3,
    title: '高级审核员 · 审核组长',
    reviewCount: 12840,
    avgReviewSec: 280,
    passRate: 96.4,
    online: true,
    currentLoad: 4,
    maxLoad: 6,
    specialties: ['游戏', '科技', '开箱'],
  },
  {
    id: 'r-002',
    name: '陈逸飞',
    initials: '逸',
    avatarColor: 'linear-gradient(135deg, #FFB400 0%, #FE2C55 100%)',
    team: 'A 班',
    level: 2,
    title: '中级审核员',
    reviewCount: 6291,
    avgReviewSec: 412,
    passRate: 92.1,
    online: true,
    currentLoad: 3,
    maxLoad: 5,
    specialties: ['vlog', '美食', '旅行'],
  },
  {
    id: 'r-003',
    name: '苏婉清',
    initials: '婉',
    avatarColor: 'linear-gradient(135deg, #25F4EE 0%, #5B8DEF 100%)',
    team: 'B 班',
    level: 3,
    title: '高级审核员',
    reviewCount: 9842,
    avgReviewSec: 198,
    passRate: 97.8,
    online: true,
    currentLoad: 2,
    maxLoad: 6,
    specialties: ['影视', '综艺', '音乐'],
  },
  {
    id: 'r-004',
    name: '赵明哲',
    initials: '哲',
    avatarColor: 'linear-gradient(135deg, #8B5CF6 0%, #25F4EE 100%)',
    team: 'B 班',
    level: 2,
    title: '中级审核员',
    reviewCount: 4823,
    avgReviewSec: 360,
    passRate: 90.5,
    online: true,
    currentLoad: 1,
    maxLoad: 5,
    specialties: ['教育', '知识', '财经'],
  },
  {
    id: 'r-005',
    name: '周雨桐',
    initials: '桐',
    avatarColor: 'linear-gradient(135deg, #5DDB96 0%, #25F4EE 100%)',
    team: 'C 班',
    level: 1,
    title: '初级审核员',
    reviewCount: 1287,
    avgReviewSec: 520,
    passRate: 88.2,
    online: false,
    currentLoad: 0,
    maxLoad: 4,
    specialties: ['生活', '萌宠', '亲子'],
  },
  {
    id: 'r-006',
    name: '吴彦霖',
    initials: '霖',
    avatarColor: 'linear-gradient(135deg, #FE2C55 0%, #FFB400 100%)',
    team: 'C 班',
    level: 2,
    title: '中级审核员',
    reviewCount: 5621,
    avgReviewSec: 388,
    passRate: 93.6,
    online: false,
    currentLoad: 0,
    maxLoad: 5,
    specialties: ['汽车', '体育', '户外'],
  },
];

// ========== SEED: Videos ==========

export const SEED: HdVideo[] = [
  {
    id: 'hd-001',
    title: '【4K HDR】2026 跨年夜烟花盛典',
    cover: gradient3('#FE2C55', '#FF6B8A', '#FFB400'),
    resolution: '4K',
    fps: 60,
    hdr: true,
    duration: '12:34',
    sizeMB: 2840,
    status: 'published',
    uploadedAt: Date.now() - 86400000 * 2,
    publishedAt: Date.now() - 86400000 * 2 + 3600000 * 3,
    views: 482931,
    likes: 38291,
    hasCover: true,
    subtitles: [
      { id: 's1', lang: 'zh-CN', label: '简体中文', isDefault: true },
      { id: 's2', lang: 'en', label: 'English', isDefault: false },
    ],
    audioTracks: [
      { id: 'a1', label: '杜比全景声', codec: 'Dolby Atmos', isDefault: true },
      { id: 'a2', label: '原声', codec: 'AAC', isDefault: false },
    ],
  },
  {
    id: 'hd-002',
    title: '4K 风景纪录片｜阿尔卑斯山脉航拍',
    cover: gradient3('#5B8DEF', '#8B5CF6', '#25F4EE'),
    resolution: '4K',
    fps: 30,
    hdr: true,
    duration: '24:18',
    sizeMB: 5820,
    status: 'published',
    uploadedAt: Date.now() - 86400000 * 5,
    publishedAt: Date.now() - 86400000 * 5 + 3600000 * 4,
    views: 1284932,
    likes: 89432,
    hasCover: true,
    subtitles: [
      { id: 's1', lang: 'zh-CN', label: '简体中文', isDefault: true },
    ],
    audioTracks: [
      { id: 'a1', label: '原声', codec: 'AAC 320kbps', isDefault: true },
    ],
  },
  {
    id: 'hd-003',
    title: '【游戏】赛博朋克 2077 实机 4K 60fps',
    cover: gradient3('#FE2C55', '#8B5CF6', '#25F4EE'),
    resolution: '4K',
    fps: 60,
    hdr: false,
    duration: '38:42',
    sizeMB: 7240,
    status: 'transcoding',
    progress: 67,
    uploadedAt: Date.now() - 3600000 * 2,
    hasCover: true,
    subtitles: [],
    audioTracks: [
      { id: 'a1', label: '主播麦克风', codec: 'AAC', isDefault: true },
      { id: 'a2', label: '游戏原声', codec: 'AAC', isDefault: false },
    ],
  },
  {
    id: 'hd-004',
    title: '1080P 美食教程｜深夜食堂合集',
    cover: gradient3('#FFB400', '#FE2C55', '#8B5CF6'),
    resolution: '1080P',
    fps: 30,
    hdr: false,
    duration: '15:42',
    sizeMB: 1840,
    status: 'reviewing',
    progress: 100,
    uploadedAt: Date.now() - 3600000 * 1,
    hasCover: true,
    subtitles: [
      { id: 's1', lang: 'zh-CN', label: '简体中文', isDefault: true },
    ],
    audioTracks: [
      { id: 'a1', label: '原声', codec: 'AAC', isDefault: true },
    ],
    review: {
      startedAt: Date.now() - 3600000 * 1 + 600000,
      assignedReviewerId: 'r-002',
      queuePosition: 2,
      estimatedWaitMin: 8,
      checks: [
        { id: 'ai_content', label: 'AI 内容初审', desc: '', status: 'passed', duration: 42 },
        { id: 'sensitive_words', label: '敏感词扫描', desc: '', status: 'passed', duration: 6 },
        { id: 'copyright', label: '版权指纹比对', desc: '', status: 'running' },
        { id: 'cover_check', label: '封面合规', desc: '', status: 'pending' },
        { id: 'subtitle_check', label: '字幕审查', desc: '', status: 'pending' },
        { id: 'manual_review', label: '人工复审', desc: '', status: 'pending' },
      ],
    },
  },
  {
    id: 'hd-005',
    title: '【4K】Sony A7M4 开箱 + 镜头测试',
    cover: gradient3('#8B5CF6', '#FE2C55', '#FFB400'),
    resolution: '4K',
    fps: 30,
    hdr: true,
    duration: '18:21',
    sizeMB: 3920,
    status: 'failed',
    failedStage: 'transcode',
    uploadedAt: Date.now() - 86400000 * 1,
    failedReason: '视频编码不兼容 (H.265 10bit),请使用 H.264 或 H.265 8bit 重新上传',
    hasCover: false,
    subtitles: [],
    audioTracks: [],
  },
  {
    id: 'hd-007',
    title: '【4K】深夜 Vlog｜北京三里屯夜生活',
    cover: gradient3('#FE2C55', '#8B5CF6', '#25F4EE'),
    resolution: '4K',
    fps: 30,
    hdr: false,
    duration: '09:18',
    sizeMB: 1820,
    status: 'review_failed',
    failedStage: 'review',
    uploadedAt: Date.now() - 86400000 * 1 - 3600000 * 4,
    hasCover: true,
    subtitles: [],
    audioTracks: [
      { id: 'a1', label: '原声', codec: 'AAC', isDefault: true },
    ],
    review: {
      startedAt: Date.now() - 86400000 * 1 - 3600000 * 2,
      completedAt: Date.now() - 86400000 * 1 - 3600000 * 1,
      result: 'reject',
      assignedReviewerId: 'r-001',
      reviewerVerdict: {
        decision: 'reject',
        note: '画面 03:24 出现的品牌 logo 未提供授权材料,封面图涉及低俗边缘内容。已截图标注,请补充品牌授权或裁剪后重新提交。',
        reviewerId: 'r-001',
        timestamp: Date.now() - 86400000 * 1 - 3600000 * 1,
        appealable: true,
        appealDeadline: Date.now() + 86400000 * 6,
      },
      checks: [
        { id: 'ai_content', label: 'AI 内容初审', desc: '', status: 'passed', duration: 38 },
        { id: 'sensitive_words', label: '敏感词扫描', desc: '', status: 'passed', duration: 5 },
        { id: 'copyright', label: '版权指纹比对', desc: '', status: 'passed', duration: 124 },
        { id: 'cover_check', label: '封面合规', desc: '', status: 'failed', duration: 8, message: '封面图像涉嫌低俗内容' },
        { id: 'manual_review', label: '人工复审', desc: '', status: 'failed', duration: 412, message: '画面出现未授权品牌 logo,需补充授权' },
      ],
      rejections: [
        { checkId: 'cover_check', category: '封面违规', detail: '封面图像识别为低俗内容,涉及敏感身体部位', timestamp: Date.now() - 86400000 * 1 - 3600000 * 1 - 600000, frameAt: '00:00' },
        { checkId: 'manual_review', category: '品牌侵权', detail: '视频 03:24 出现未授权品牌 logo,需提供品牌使用授权或裁剪处理', timestamp: Date.now() - 86400000 * 1 - 3600000 * 1, frameAt: '03:24' },
      ],
    },
  },
  {
    id: 'hd-008',
    title: '2K 实测｜iPhone 17 Pro Max 影像系统',
    cover: gradient3('#25F4EE', '#5B8DEF', '#8B5CF6'),
    resolution: '2K',
    fps: 60,
    hdr: true,
    duration: '11:42',
    sizeMB: 1980,
    status: 'published',
    uploadedAt: Date.now() - 86400000 * 7,
    publishedAt: Date.now() - 86400000 * 7 + 3600000 * 2,
    views: 238491,
    likes: 18923,
    hasCover: true,
    subtitles: [
      { id: 's1', lang: 'zh-CN', label: '简体中文', isDefault: true },
      { id: 's2', lang: 'en', label: 'English', isDefault: false },
    ],
    audioTracks: [
      { id: 'a1', label: '原声', codec: 'AAC', isDefault: true },
    ],
    review: {
      startedAt: Date.now() - 86400000 * 7 + 600000,
      completedAt: Date.now() - 86400000 * 7 + 3600000 * 1,
      result: 'pass',
      useFastChannel: true,
      fastChannelChargedAt: Date.now() - 86400000 * 7 + 600000,
      assignedReviewerId: 'r-003',
      reviewerVerdict: {
        decision: 'pass',
        note: '极速通道加签,内容符合社区规范,无违规点。',
        reviewerId: 'r-003',
        timestamp: Date.now() - 86400000 * 7 + 3600000 * 1,
        appealable: false,
      },
      checks: [
        { id: 'ai_content', label: 'AI 内容初审', desc: '', status: 'passed', duration: 24 },
        { id: 'sensitive_words', label: '敏感词扫描', desc: '', status: 'passed', duration: 4 },
        { id: 'copyright', label: '版权指纹比对', desc: '', status: 'passed', duration: 88 },
        { id: 'cover_check', label: '封面合规', desc: '', status: 'passed', duration: 6 },
        { id: 'subtitle_check', label: '字幕审查', desc: '', status: 'skipped' },
      ],
    },
  },
  {
    id: 'hd-006',
    title: '1080P 旅行 vlog｜京都樱花季',
    cover: gradient3('#FF6B8A', '#FFB400', '#5DDB96'),
    resolution: '1080P',
    fps: 60,
    hdr: false,
    duration: '08:34',
    sizeMB: 920,
    status: 'scheduled',
    scheduledAt: Date.now() + 3600000 * 6,
    uploadedAt: Date.now() - 3600000 * 3,
    hasCover: true,
    subtitles: [],
    audioTracks: [
      { id: 'a1', label: '原声', codec: 'AAC', isDefault: true },
    ],
  },
  {
    id: 'hd-009',
    title: '【4K HDR】广州早茶 4K 60fps',
    cover: gradient3('#FE2C55', '#FFB400', '#5DDB96'),
    resolution: '4K',
    fps: 60,
    hdr: true,
    duration: '12:08',
    sizeMB: 2640,
    status: 'reviewing',
    progress: 100,
    uploadedAt: Date.now() - 3600000 * 2,
    hasCover: true,
    subtitles: [
      { id: 's1', lang: 'zh-CN', label: '简体中文', isDefault: true },
    ],
    audioTracks: [
      { id: 'a1', label: '原声', codec: 'AAC 320kbps', isDefault: true },
    ],
    review: {
      startedAt: Date.now() - 3600000 * 2 + 600000,
      useFastChannel: true,
      fastChannelChargedAt: Date.now() - 3600000 * 2 + 600000,
      assignedReviewerId: 'r-001',
      queuePosition: 1,
      estimatedWaitMin: 3,
      checks: [
        { id: 'ai_content', label: 'AI 内容初审', desc: '', status: 'passed', duration: 32 },
        { id: 'sensitive_words', label: '敏感词扫描', desc: '', status: 'passed', duration: 4 },
        { id: 'copyright', label: '版权指纹比对', desc: '', status: 'passed', duration: 96 },
        { id: 'cover_check', label: '封面合规', desc: '', status: 'passed', duration: 6 },
        { id: 'subtitle_check', label: '字幕审查', desc: '', status: 'skipped' },
      ],
    },
  },
  {
    id: 'hd-010',
    title: '【1080P】独居生活 vlog｜下班后的 3 小时',
    cover: gradient3('#8B5CF6', '#FE2C55', '#FFB400'),
    resolution: '1080P',
    fps: 30,
    hdr: false,
    duration: '06:42',
    sizeMB: 720,
    status: 'reviewing',
    progress: 100,
    uploadedAt: Date.now() - 3600000 * 4,
    hasCover: true,
    subtitles: [],
    audioTracks: [
      { id: 'a1', label: '原声', codec: 'AAC', isDefault: true },
    ],
    review: {
      startedAt: Date.now() - 3600000 * 4 + 1200000,
      assignedReviewerId: 'r-002',
      queuePosition: 1,
      estimatedWaitMin: 12,
      checks: [
        { id: 'ai_content', label: 'AI 内容初审', desc: '', status: 'passed', duration: 28 },
        { id: 'sensitive_words', label: '敏感词扫描', desc: '', status: 'passed', duration: 3 },
        { id: 'copyright', label: '版权指纹比对', desc: '', status: 'passed', duration: 64 },
        { id: 'cover_check', label: '封面合规', desc: '', status: 'failed', duration: 7, message: '封面图疑似含未授权品牌元素' },
        { id: 'subtitle_check', label: '字幕审查', desc: '', status: 'skipped' },
        { id: 'manual_review', label: '人工复审', desc: '', status: 'pending' },
      ],
      rejections: [
        { checkId: 'cover_check', category: '封面侵权嫌疑', detail: '封面右下角出现疑似 Nike 品牌元素,需人工确认为否构成侵权', timestamp: Date.now() - 3600000 * 3, frameAt: '00:00' },
      ],
    },
  },
  {
    id: 'hd-011',
    title: '【4K】NASA Artemis 登月计划纪录片',
    cover: gradient3('#25F4EE', '#5B8DEF', '#8B5CF6'),
    resolution: '4K',
    fps: 30,
    hdr: true,
    duration: '28:14',
    sizeMB: 6420,
    status: 'reviewing',
    progress: 100,
    uploadedAt: Date.now() - 3600000 * 6,
    hasCover: true,
    subtitles: [
      { id: 's1', lang: 'zh-CN', label: '简体中文', isDefault: true },
      { id: 's2', lang: 'en', label: 'English', isDefault: false },
    ],
    audioTracks: [
      { id: 'a1', label: '杜比环绕声', codec: 'Dolby 5.1', isDefault: true },
      { id: 'a2', label: '解说', codec: 'AAC', isDefault: false },
    ],
    review: {
      startedAt: Date.now() - 3600000 * 6 + 800000,
      assignedReviewerId: 'r-003',
      queuePosition: 1,
      estimatedWaitMin: 5,
      checks: [
        { id: 'ai_content', label: 'AI 内容初审', desc: '', status: 'passed', duration: 52 },
        { id: 'sensitive_words', label: '敏感词扫描', desc: '', status: 'passed', duration: 7 },
        { id: 'copyright', label: '版权指纹比对', desc: '', status: 'passed', duration: 184 },
        { id: 'cover_check', label: '封面合规', desc: '', status: 'passed', duration: 8 },
        { id: 'subtitle_check', label: '字幕审查', desc: '', status: 'passed', duration: 22 },
      ],
    },
  },
  {
    id: 'hd-012',
    title: '【2K】科普｜量子纠缠到底是什么',
    cover: gradient3('#FFB400', '#8B5CF6', '#25F4EE'),
    resolution: '2K',
    fps: 30,
    hdr: false,
    duration: '14:38',
    sizeMB: 1840,
    status: 'reviewing',
    progress: 100,
    uploadedAt: Date.now() - 3600000 * 5,
    hasCover: true,
    subtitles: [
      { id: 's1', lang: 'zh-CN', label: '简体中文', isDefault: true },
    ],
    audioTracks: [
      { id: 'a1', label: '原声', codec: 'AAC', isDefault: true },
    ],
    review: {
      startedAt: Date.now() - 3600000 * 5 + 1500000,
      assignedReviewerId: 'r-004',
      queuePosition: 1,
      estimatedWaitMin: 6,
      checks: [
        { id: 'ai_content', label: 'AI 内容初审', desc: '', status: 'passed', duration: 36 },
        { id: 'sensitive_words', label: '敏感词扫描', desc: '', status: 'passed', duration: 5 },
        { id: 'copyright', label: '版权指纹比对', desc: '', status: 'passed', duration: 78 },
        { id: 'cover_check', label: '封面合规', desc: '', status: 'failed', duration: 6, message: '封面图含争议性物理示意图,疑似引用未授权论文' },
        { id: 'subtitle_check', label: '字幕审查', desc: '', status: 'pending' },
        { id: 'manual_review', label: '人工复审', desc: '', status: 'pending' },
      ],
      rejections: [
        { checkId: 'cover_check', category: '封面学术引用', detail: '封面图疑似引用某学术期刊示意图,未注明出处', timestamp: Date.now() - 3600000 * 4, frameAt: '00:00' },
      ],
    },
  },
];

// ========== Helpers ==========

export function getReviewer(id: string | undefined): Reviewer | undefined {
  if (!id) return undefined;
  return SEED_REVIEWERS.find((r) => r.id === id);
}

export function getReviewerById(id: string): Reviewer | undefined {
  return SEED_REVIEWERS.find((r) => r.id === id);
}

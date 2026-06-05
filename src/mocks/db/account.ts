/**
 * Account module seed data — content 子页(works/data/monetize/interaction/activity/...)
 */

import { dateOffset, range } from '../utils/seed';

const T0 = dateOffset(0);
const T1 = dateOffset(1);
const T2 = dateOffset(2);
const T3 = dateOffset(3);
const T4 = dateOffset(5);
const T5 = dateOffset(7);
const T6 = dateOffset(14);
const T7 = dateOffset(30);

export const CREATOR_STATS = {
  totalWorks: 28,
  totalViews: 187432,
  totalLikes: 12480,
  totalComments: 1832,
  totalShares: 614,
  followers: 23,
  following: 131,
  daysActive: 64,
  level: 'Lv.2 创作者新星',
  nextLevel: 'Lv.3 内容达人',
  progressPct: 42,
  badges: ['首发之星', '勤奋创作', '互动达人'],
};

export const WORKS = {
  records: range(8).map((i) => ({
    id: 4000 + i,
    title: ['银杏树下', '雨后清秋', '月下独酌', '青衫客', '夜泊秦淮', '长安雪', '江南春', '故园'][i],
    cover: `https://picsum.photos/seed/work-${i}/400/600`,
    type: ['video', 'image', 'image', 'video', 'video', 'image', 'video', 'image'][i],
    views: 5000 + i * 1830,
    likes: 100 + i * 47,
    comments: 5 + i * 6,
    shares: 2 + i * 3,
    publishedAt: [T0, T1, T2, T3, T4, T5, T6, T7][i],
  })),
  totalRow: 8,
};

export const DATA_OVERVIEW = {
  totalViews: 187432,
  totalLikes: 12480,
  totalComments: 1832,
  totalShares: 614,
  avgWatchTime: 47,
  completionRate: 0.62,
  todayViews: 3210,
  weekViews: 18420,
  monthViews: 76210,
  trend: range(7).map((i) => ({
    date: dateOffset(6 - i, 12).slice(5, 10),
    views: 1500 + Math.round(Math.sin(i * 0.8) * 800) + i * 200,
    likes: 80 + Math.round(Math.cos(i * 0.6) * 40) + i * 8,
  })),
};

export const MONETIZE_SUMMARY = {
  totalIncome: 18420.5,
  monthIncome: 3870.2,
  pendingIncome: 1240.8,
  withdrawnIncome: 13309.5,
  items: range(5).map((i) => ({
    id: 5000 + i,
    date: ['06/01', '05/25', '05/18', '05/11', '05/04'][i],
    amount: [1200, 850, 640, 1200, 980][i],
    status: ['已到账', '已到账', '处理中', '已到账', '已到账'][i],
    channel: '支付宝',
  })),
};

export const COMMENTS = {
  records: range(15).map((i) => ({
    id: 1000 + i,
    userId: 2000 + i,
    nickname: ['小桥流水', '海的尽头', '南风知我意', '青衫客', '杏花微雨'][i % 5],
    avatar: `https://picsum.photos/seed/comment-${i}/60/60`,
    content: ['太精彩了!', '支持一下!', '关注了~', '这作品用心了', '求更新!'][i % 5],
    workTitle: `作品 ${i + 1}`,
    postedAt: [T0, T1, T2, T3, T4, T5, T6, T7][i % 8],
    likes: (i * 7) % 50,
    replies: (i * 3) % 8,
  })),
  totalRow: 15,
};

export const ACTIVITIES = range(12).map((i) => ({
  id: 3000 + i,
  type: ['like', 'comment', 'follow', 'share', 'collect'][i % 5],
  actor: ['海边的卡夫卡', '夜的第七章', '风中的诗句', '小桥流水'][i % 4],
  actorAvatar: `https://picsum.photos/seed/actor-${i}/40/40`,
  workTitle: `作品 ${i + 1}`,
  at: [T0, T1, T2, T3, T4, T5, T6, T7][i % 8],
}));

// ─── 5 个 placeholder status ───
export const APPLICATION_STATUS = {
  original: { applied: false, reviewedAt: null, message: '原创认证审核中' },
  cocreate: { applied: false, reviewedAt: null, message: '共创权限未开通' },
  collection: { applied: false, reviewedAt: null, message: '合集权限未开通' },
  'hd-publish': { applied: false, reviewedAt: null, message: '高清发布权限未开通' },
};

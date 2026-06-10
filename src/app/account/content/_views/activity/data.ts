import { gradient2 } from '@/constants/gradients';

export type ActivityStatus =
  | 'upcoming'   // 即将开始 (报名未开放)
  | 'signup'     // 报名中 (尚未开始作品提交)
  | 'active'     // 进行中 (可投稿)
  | 'judging'    // 评审中 (停止投稿,等待结果)
  | 'ended';     // 已结束 (结果公示)

export type ActivityCategory =
  | 'official'   // 平台官方
  | 'topic'      // 话题挑战
  | 'challenge'  // 创作挑战
  | 'brand'      // 品牌联名
  | 'support';   // 扶持计划

export type ParticipationStatus =
  | 'none'       // 未报名
  | 'signed'     // 已报名 (未提交)
  | 'submitted'  // 已提交作品
  | 'shortlist'  // 入围
  | 'won'        // 获奖
  | 'lost';      // 未获奖

export type CategoryMeta = {
  label: string;
  color: string;
  bg: string;
};

export const CATEGORY_META: Record<ActivityCategory, CategoryMeta> = {
  official:  { label: '平台官方', color: '#FE2C55', bg: 'rgba(254, 44, 85, 0.14)' },
  topic:     { label: '话题挑战', color: '#25F4EE', bg: 'rgba(37, 244, 238, 0.14)' },
  challenge: { label: '创作挑战', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.14)' },
  brand:     { label: '品牌联名', color: '#FFB400', bg: 'rgba(255, 180, 0, 0.14)' },
  support:   { label: '扶持计划', color: '#5DDB96', bg: 'rgba(93, 219, 150, 0.14)' },
};

export type StatusMeta = {
  label: string;
  color: string;
  bg: string;
};

export const STATUS_META: Record<ActivityStatus, StatusMeta> = {
  upcoming: { label: '即将开始', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.14)' },
  signup:   { label: '报名中',   color: '#25F4EE', bg: 'rgba(37, 244, 238, 0.14)' },
  active:   { label: '进行中',   color: '#FE2C55', bg: 'rgba(254, 44, 85, 0.14)' },
  judging:  { label: '评审中',   color: '#FFB400', bg: 'rgba(255, 180, 0, 0.14)' },
  ended:    { label: '已结束',   color: '#9CA3AF', bg: 'rgba(156, 163, 175, 0.14)' },
};

export type PartMeta = {
  label: string;
  color: string;
  bg: string;
};

export const PART_META: Record<ParticipationStatus, PartMeta> = {
  none:      { label: '未报名',   color: '#9CA3AF', bg: 'rgba(156, 163, 175, 0.14)' },
  signed:    { label: '已报名',   color: '#25F4EE', bg: 'rgba(37, 244, 238, 0.14)' },
  submitted: { label: '已投稿',   color: '#5DDB96', bg: 'rgba(93, 219, 150, 0.14)' },
  shortlist: { label: '已入围',   color: '#FFB400', bg: 'rgba(255, 180, 0, 0.14)' },
  won:       { label: '已获奖',   color: '#FFD700', bg: 'rgba(255, 215, 0, 0.18)' },
  lost:      { label: '未获奖',   color: '#9CA3AF', bg: 'rgba(156, 163, 175, 0.14)' },
};

export interface PrizeTier {
  rank: string;          // 一等奖 / 二等奖 / 入围奖
  count: number;         // 名额数
  reward: string;        // ¥10,000 + 100w 流量包
  color: string;
}

export interface ActivitySubmission {
  id: string;
  workId: string;
  workTitle: string;
  workCover: string;     // gradient
  workDuration: number;  // seconds
  views: number;
  likes: number;
  votes: number;
  rank?: number;         // current ranking in this activity
  prize?: string;        // if won
  submittedAt: number;
}

export interface LeaderboardEntry {
  rank: number;
  creatorName: string;
  avatarColor: string;
  initials: string;
  workTitle: string;
  views: number;
  votes: number;
  isMe?: boolean;
}

export interface Activity {
  id: string;
  title: string;
  subtitle: string;
  desc: string;
  category: ActivityCategory;
  status: ActivityStatus;
  participation: ParticipationStatus;
  gradient: string;
  cover?: string;
  organizer: string;
  heat: number;
  startAt: number;
  endAt: number;
  endLabel: string;
  totalReward: string;     // ¥100w 现金 + 1亿流量
  totalRewardValue: number; // CNY equivalent for sorting
  rules: string[];
  requirements: string[];
  prizes: PrizeTier[];
  signupCount: number;
  submissionCount: number;
  totalViews: number;
  myWonReward?: string;
  myWonAt?: number;
  myRank?: number;
  submissions: ActivitySubmission[];
  leaderboard: LeaderboardEntry[];
}

const now = Date.now();
const day = 86400000;

// 一些可重用的色板
const G_RED = gradient2('#FE2C55', '#FFB400');
const G_CYAN = gradient2('#25F4EE', '#5DF7F2');
const G_PURPLE = gradient2('#8B5CF6', '#FE2C55');
const G_AMBER = gradient2('#FFB400', '#FFD566');
const G_GREEN = gradient2('#5DDB96', '#25F4EE');
const G_DARK = gradient2('#1F2937', '#374151');
const G_PINK = gradient2('#FE2C55', '#8B5CF6');
const G_GOLD = gradient2('#FFD700', '#FE8B6B');

export const ACTIVITIES: Activity[] = [
  {
    id: 'act-618',
    title: '618 创作激励计划',
    subtitle: '瓜分千万流量,最高奖 10w 现金',
    desc: '618 大促期间,平台投入 1000w 创作激励金 + 1 亿曝光流量。围绕"我的 618"主题创作短视频,日常种草/开箱/省钱攻略/工作室探班全部接受。',
    category: 'official',
    status: 'active',
    participation: 'submitted',
    gradient: G_RED,
    organizer: '平台官方',
    heat: 9862,
    startAt: now - 6 * day,
    endAt: now + 12 * day,
    endLabel: '06/18 23:59',
    totalReward: '¥1000w + 1亿流量',
    totalRewardValue: 10000000,
    rules: [
      '作品须于 2026.06.01 - 2026.06.18 期间发布',
      '视频时长 ≥ 30 秒,横竖屏均可',
      '标题或简介须包含 #我的618 话题',
      '原创作品,搬运/拼接将取消资格',
      '同一账号最多提交 5 部作品',
    ],
    requirements: ['#我的618 话题', '≥ 30 秒', '原创', '最多 5 部'],
    prizes: [
      { rank: '一等奖', count: 1,   reward: '¥100,000 + 1亿曝光',   color: '#FFD700' },
      { rank: '二等奖', count: 3,   reward: '¥50,000 + 5000w 曝光', color: '#C0C0C0' },
      { rank: '三等奖', count: 10,  reward: '¥10,000 + 1000w 曝光', color: '#CD7F32' },
      { rank: '入围奖', count: 100, reward: '¥1,000 + 500w 曝光',   color: '#5DDB96' },
    ],
    signupCount: 18420,
    submissionCount: 42810,
    totalViews: 286_400_000,
    myRank: 47,
    submissions: [
      {
        id: 'sub-001',
        workId: 'w-101',
        workTitle: '618 大牌口红 5 折真香!',
        workCover: G_RED,
        workDuration: 58,
        views: 124_320,
        likes: 8420,
        votes: 6210,
        rank: 47,
        submittedAt: now - 4 * day,
      },
      {
        id: 'sub-002',
        workId: 'w-102',
        workTitle: '我的购物车清单 | 618 必买好物',
        workCover: G_PINK,
        workDuration: 92,
        views: 86_140,
        likes: 5210,
        votes: 3840,
        rank: 128,
        submittedAt: now - 2 * day,
      },
    ],
    leaderboard: [
      { rank: 1, creatorName: '小柒同学',  avatarColor: G_RED,    initials: '小柒', workTitle: '618 必囤清单 TOP10', views: 8_420_000, votes: 482_100 },
      { rank: 2, creatorName: '美妆少女志', avatarColor: G_PINK,   initials: '美妆', workTitle: '618 大牌口红盲盒拆箱', views: 6_280_000, votes: 386_400 },
      { rank: 3, creatorName: '生活实验室', avatarColor: G_AMBER,  initials: '生活', workTitle: '618 家电选购避坑指南', views: 5_190_000, votes: 312_800 },
      { rank: 4, creatorName: '数码玩家',   avatarColor: G_CYAN,   initials: '数码', workTitle: '618 千元机大横评',     views: 4_840_000, votes: 268_400 },
      { rank: 5, creatorName: '探店达人',   avatarColor: G_GREEN,  initials: '探店', workTitle: '618 线下专柜实拍',     views: 3_920_000, votes: 234_100 },
      { rank: 47, creatorName: '我',       avatarColor: G_PURPLE, initials: '我',  workTitle: '618 大牌口红 5 折真香', views: 124_320,   votes: 6_210, isMe: true },
    ],
  },
  {
    id: 'act-vlog',
    title: '夏日 vlog 挑战赛',
    subtitle: '记录夏天的一切,iPhone 16 Pro 等你赢',
    desc: '夏天有什么不一样?可以是冰镇西瓜、是路边的蝉鸣、是和朋友的一次远行。用 vlog 镜头记录你的夏日 24 小时。',
    category: 'challenge',
    status: 'signup',
    participation: 'signed',
    gradient: G_CYAN,
    organizer: '清秋月视频组',
    heat: 7241,
    startAt: now + 2 * day,
    endAt: now + 25 * day,
    endLabel: '07/01 23:59',
    totalReward: 'iPhone 16 Pro × 3',
    totalRewardValue: 30000,
    rules: [
      '报名开放至 06/15,作品提交 06/16 - 07/01',
      '单条 vlog 时长 1 - 5 分钟',
      '需带 #夏日vlog 话题且 @官方账号',
      '人均最多提交 3 部作品',
    ],
    requirements: ['#夏日vlog 话题', '1-5 分钟', '@官方账号'],
    prizes: [
      { rank: '夏日特等奖', count: 1, reward: 'iPhone 16 Pro + ¥10,000 + 万粉流量', color: '#FFD700' },
      { rank: '夏日金奖',  count: 3, reward: 'iPhone 16 Pro',                       color: '#C0C0C0' },
      { rank: '夏日银奖',  count: 10, reward: 'AirPods Pro 2',                      color: '#CD7F32' },
      { rank: '人气奖',    count: 50, reward: '¥500 现金',                          color: '#5DDB96' },
    ],
    signupCount: 4280,
    submissionCount: 0,
    totalViews: 0,
    submissions: [],
    leaderboard: [],
  },
  {
    id: 'act-father',
    title: '父亲节话题:#给老爸的一句话',
    subtitle: '说出口的话不多,记录下来就够',
    desc: '父亲节,把那些没说出口的、藏在心里的话拍出来。可以是一次同框、一段对话、一封信。',
    category: 'topic',
    status: 'active',
    participation: 'won',
    gradient: G_PURPLE,
    organizer: '内容运营',
    heat: 4128,
    startAt: now - 9 * day,
    endAt: now - 2 * day,
    endLabel: '06/04 已结束',
    totalReward: '¥30,000 + 流量包',
    totalRewardValue: 30000,
    rules: [
      '作品形式不限:vlog / 微剧 / 朗诵 / 父子对话',
      '需带 #给老爸的一句话 话题',
      '单条作品评审通过即可获得流量扶持',
    ],
    requirements: ['#给老爸的一句话 话题', '形式不限'],
    prizes: [
      { rank: '最佳故事奖', count: 1,  reward: '¥10,000', color: '#FFD700' },
      { rank: '最佳情感奖', count: 3,  reward: '¥3,000',  color: '#C0C0C0' },
      { rank: '入围奖',     count: 20, reward: '¥500',    color: '#5DDB96' },
    ],
    signupCount: 2810,
    submissionCount: 1820,
    totalViews: 18_400_000,
    myWonReward: '¥3,000 (最佳情感奖)',
    myWonAt: now - 1 * day,
    myRank: 3,
    submissions: [
      {
        id: 'sub-101',
        workId: 'w-201',
        workTitle: '给老爸的一封信 | 第一次说我爱你',
        workCover: G_PURPLE,
        workDuration: 184,
        views: 482_000,
        likes: 38_120,
        votes: 24_810,
        rank: 3,
        prize: '¥3,000 (最佳情感奖)',
        submittedAt: now - 8 * day,
      },
    ],
    leaderboard: [
      { rank: 1, creatorName: '回忆杀',   avatarColor: G_GOLD,   initials: '回忆', workTitle: '父亲节 | 老爸的一封视频信', views: 1_280_000, votes: 92_400 },
      { rank: 2, creatorName: '林同学',   avatarColor: G_RED,    initials: '林',  workTitle: '我和老爸的 30 年',          views: 820_000,   votes: 58_400 },
      { rank: 3, creatorName: '我',       avatarColor: G_PURPLE, initials: '我',  workTitle: '给老爸的一封信',           views: 482_000,   votes: 24_810, isMe: true },
      { rank: 4, creatorName: '小麦同学', avatarColor: G_CYAN,   initials: '小麦', workTitle: '爸爸的第一次合照',         views: 360_000,   votes: 18_240 },
      { rank: 5, creatorName: '老李日记', avatarColor: G_AMBER,  initials: '老李', workTitle: '老爸的手 | 摄影记录',     views: 248_000,   votes: 14_120 },
    ],
  },
  {
    id: 'act-newstar',
    title: '新星扶持计划',
    subtitle: '万粉以下创作者专属流量包',
    desc: '专为新人创作者打造的长期扶持计划。粉丝 ≤ 1w 即可报名,通过审核获得专属推荐位、月度训练营、1 对 1 运营指导。',
    category: 'support',
    status: 'active',
    participation: 'signed',
    gradient: G_AMBER,
    organizer: '创作者成长营',
    heat: 5420,
    startAt: now - 90 * day,
    endAt: now + 365 * day,
    endLabel: '长期开放',
    totalReward: '¥5,000 起 / 月',
    totalRewardValue: 60000,
    rules: [
      '粉丝数 ≤ 10,000 可报名',
      '每月提交 ≥ 4 部原创作品',
      '通过审核可获月度流量包 + 现金奖励',
      '连续 3 个月达标可升级"星推官"身份',
    ],
    requirements: ['粉丝 ≤ 1w', '每月 ≥ 4 部作品', '原创内容'],
    prizes: [
      { rank: '月度优秀创作者', count: 50, reward: '¥5,000 + 500w 流量', color: '#FFD700' },
      { rank: '月度新锐',       count: 100, reward: '¥2,000 + 200w 流量', color: '#C0C0C0' },
      { rank: '上榜奖',         count: 500, reward: '¥500 + 50w 流量',    color: '#5DDB96' },
    ],
    signupCount: 12480,
    submissionCount: 38240,
    totalViews: 86_200_000,
    submissions: [],
    leaderboard: [
      { rank: 1, creatorName: '小白成长记', avatarColor: G_AMBER, initials: '小白', workTitle: '0 到 1w 粉的 30 天复盘', views: 820_000, votes: 48_200 },
      { rank: 2, creatorName: '画画的鹿',   avatarColor: G_PINK,  initials: '画画', workTitle: '每日一画 | 第 100 天',  views: 612_000, votes: 36_400 },
      { rank: 3, creatorName: '考研日常',   avatarColor: G_CYAN,  initials: '考研', workTitle: '考研 vlog | 7 月 day 1', views: 484_000, votes: 28_120 },
    ],
  },
  {
    id: 'act-travel',
    title: '旅行打卡活动',
    subtitle: '一站一句话,留下你的旅行印象',
    desc: '夏季旅行旺季开启!分享你最想推荐的小众目的地,带话题 #我的旅行打卡 即可参与。',
    category: 'topic',
    status: 'signup',
    participation: 'none',
    gradient: G_GREEN,
    organizer: '旅行频道',
    heat: 3820,
    startAt: now + 5 * day,
    endAt: now + 38 * day,
    endLabel: '07/15 23:59',
    totalReward: '¥30,000 + 双人机票',
    totalRewardValue: 30000,
    rules: [
      '内容须为 2025 年 6 月后实拍',
      '带 #我的旅行打卡 话题且至少 3 张地标照',
      '禁止使用商用素材或库存视频',
    ],
    requirements: ['#我的旅行打卡 话题', '原创实拍', '≥ 3 张地标'],
    prizes: [
      { rank: '旅行家奖',  count: 1,   reward: '双人国际机票 + ¥10,000',     color: '#FFD700' },
      { rank: '探索者奖',  count: 5,   reward: '国内 3 日游 + ¥3,000',       color: '#C0C0C0' },
      { rank: '人气奖',    count: 30,  reward: '¥500',                       color: '#5DDB96' },
    ],
    signupCount: 1820,
    submissionCount: 0,
    totalViews: 0,
    submissions: [],
    leaderboard: [],
  },
  {
    id: 'act-foodie',
    title: '美食探店计划',
    subtitle: '一城一味,城市美食打卡',
    desc: '与美食合作品牌联合策划。在你所在的城市,挑选 3 家最想推荐的店,拍一条 60s 内的探店视频。',
    category: 'brand',
    status: 'upcoming',
    participation: 'none',
    gradient: G_GOLD,
    organizer: '美食频道 × KFC',
    heat: 2840,
    startAt: now + 12 * day,
    endAt: now + 40 * day,
    endLabel: '07/10 23:59',
    totalReward: '¥50,000 + 品牌联名礼包',
    totalRewardValue: 50000,
    rules: [
      '07/03 开放报名,07/10 截止',
      '单条视频 ≤ 60 秒',
      '需展示真实店面、菜品、口味评价',
      '需带 #美食探店计划 #KFC 话题',
    ],
    requirements: ['≤ 60 秒', '真实探店', '#美食探店计划'],
    prizes: [
      { rank: '城市美食大使', count: 5,  reward: '¥5,000 + 品牌联名礼包',  color: '#FFD700' },
      { rank: '美食推荐官',   count: 20, reward: '¥1,000 + 品牌联名礼包',  color: '#C0C0C0' },
      { rank: '入围奖',       count: 100, reward: '品牌联名礼包 + 200w 流量', color: '#5DDB96' },
    ],
    signupCount: 0,
    submissionCount: 0,
    totalViews: 0,
    submissions: [],
    leaderboard: [],
  },
  {
    id: 'act-cosplay',
    title: '次元壁挑战 | Cosplay 大赛',
    subtitle: '动漫 / 游戏 / 国风 / 原创,展现你的角色力',
    desc: '与 B 站、A 站联合发起。一切角色还原皆可参赛,从妆造到剧情演绎全方位评审。',
    category: 'challenge',
    status: 'active',
    participation: 'shortlist',
    gradient: G_PINK,
    organizer: '二次元频道',
    heat: 6128,
    startAt: now - 18 * day,
    endAt: now + 8 * day,
    endLabel: '06/14 23:59',
    totalReward: '¥80,000 + 联名手办',
    totalRewardValue: 80000,
    rules: [
      '作品类型不限:静态展示 / 短剧 / 舞蹈 / 翻唱',
      '原 IP 须注明出处,原创角色加分',
      '带 #次元壁挑战 话题',
    ],
    requirements: ['#次元壁挑战 话题', '出处注明'],
    prizes: [
      { rank: '次元大赏',  count: 1,  reward: '¥30,000 + 联名手办',  color: '#FFD700' },
      { rank: '最佳还原',  count: 3,  reward: '¥10,000',             color: '#C0C0C0' },
      { rank: '最佳原创',  count: 3,  reward: '¥10,000',             color: '#C0C0C0' },
      { rank: '入围奖',    count: 30, reward: '¥500 + 周边礼包',     color: '#5DDB96' },
    ],
    signupCount: 6280,
    submissionCount: 8240,
    totalViews: 42_800_000,
    myRank: 12,
    submissions: [
      {
        id: 'sub-301',
        workId: 'w-301',
        workTitle: '原神 | 雷电将军舞蹈 cover',
        workCover: G_PINK,
        workDuration: 184,
        views: 286_400,
        likes: 24_100,
        votes: 18_240,
        rank: 12,
        submittedAt: now - 9 * day,
      },
    ],
    leaderboard: [
      { rank: 1, creatorName: '阿狸老师', avatarColor: G_PINK,  initials: '阿狸', workTitle: '英雄联盟 | 阿狸九尾飞舞', views: 3_280_000, votes: 184_200 },
      { rank: 2, creatorName: '画戟无敌', avatarColor: G_RED,   initials: '画戟', workTitle: '三国 | 吕布单人剧情',    views: 2_410_000, votes: 128_400 },
      { rank: 3, creatorName: '初音控',   avatarColor: G_CYAN,  initials: '初音', workTitle: '初音未来 | 千本樱舞蹈',   views: 1_820_000, votes: 98_240 },
      { rank: 12, creatorName: '我',     avatarColor: G_PURPLE, initials: '我',  workTitle: '原神 | 雷电将军舞蹈',     views: 286_400,   votes: 18_240, isMe: true },
    ],
  },
  {
    id: 'act-finance',
    title: '财经知识科普大赛',
    subtitle: '用 1 分钟讲明白一个财经概念',
    desc: '联合财经合作伙伴策划。把复杂的财经概念讲到小学生也能懂,1 分钟内完成。',
    category: 'brand',
    status: 'ended',
    participation: 'lost',
    gradient: G_DARK,
    organizer: '财经频道 × 招商银行',
    heat: 1820,
    startAt: now - 60 * day,
    endAt: now - 30 * day,
    endLabel: '05/05 已结束',
    totalReward: '¥40,000',
    totalRewardValue: 40000,
    rules: [
      '单条视频 ≤ 60 秒',
      '需讲解 1 个具体财经概念',
      '禁止具体投资建议',
    ],
    requirements: ['≤ 60 秒', '科普性质', '禁止投资建议'],
    prizes: [
      { rank: '一等奖', count: 1,  reward: '¥20,000', color: '#FFD700' },
      { rank: '二等奖', count: 3,  reward: '¥5,000',  color: '#C0C0C0' },
      { rank: '入围奖', count: 10, reward: '¥500',    color: '#5DDB96' },
    ],
    signupCount: 1240,
    submissionCount: 820,
    totalViews: 4_800_000,
    submissions: [
      {
        id: 'sub-401',
        workId: 'w-401',
        workTitle: '什么是复利?| 1 分钟搞懂',
        workCover: G_AMBER,
        workDuration: 58,
        views: 48_240,
        likes: 3_810,
        votes: 1_820,
        rank: 184,
        submittedAt: now - 50 * day,
      },
    ],
    leaderboard: [
      { rank: 1, creatorName: '财经小白',  avatarColor: G_GOLD,   initials: '财经', workTitle: '一分钟看懂通货膨胀',     views: 1_820_000, votes: 124_800 },
      { rank: 2, creatorName: '理财少女',  avatarColor: G_PINK,   initials: '理财', workTitle: '基金定投到底要不要做?',  views: 1_280_000, votes: 86_400 },
      { rank: 3, creatorName: '老韭菜',    avatarColor: G_RED,    initials: '老韭', workTitle: '股票 K 线 1 分钟入门',    views: 980_000,   votes: 64_200 },
    ],
  },
];

// 创作者自己的可投稿作品库 - 给 submit-work 对话框用
export interface MyWork {
  id: string;
  title: string;
  cover: string;
  duration: number;
  views: number;
  likes: number;
  publishedAt: number;
  status: 'published';
  hashtags: string[];
}

export const MY_WORKS: MyWork[] = [
  { id: 'w-101', title: '618 大牌口红 5 折真香!',         cover: G_RED,    duration: 58,  views: 124_320, likes: 8_420, publishedAt: now - 4 * day, status: 'published', hashtags: ['#我的618', '#美妆'] },
  { id: 'w-102', title: '我的购物车清单 | 618 必买好物',   cover: G_PINK,   duration: 92,  views: 86_140,  likes: 5_210, publishedAt: now - 2 * day, status: 'published', hashtags: ['#我的618', '#好物分享'] },
  { id: 'w-201', title: '给老爸的一封信 | 第一次说我爱你', cover: G_PURPLE, duration: 184, views: 482_000, likes: 38_120, publishedAt: now - 8 * day, status: 'published', hashtags: ['#给老爸的一句话'] },
  { id: 'w-301', title: '原神 | 雷电将军舞蹈 cover',       cover: G_PINK,   duration: 184, views: 286_400, likes: 24_100, publishedAt: now - 9 * day, status: 'published', hashtags: ['#次元壁挑战', '#原神'] },
  { id: 'w-401', title: '什么是复利?| 1 分钟搞懂',         cover: G_AMBER,  duration: 58,  views: 48_240,  likes: 3_810,  publishedAt: now - 50 * day, status: 'published', hashtags: ['#财经科普'] },
  { id: 'w-501', title: '夏日清晨咖啡馆 vlog',             cover: G_CYAN,   duration: 76,  views: 32_840,  likes: 2_140,  publishedAt: now - 1 * day, status: 'published', hashtags: ['#vlog', '#夏天'] },
  { id: 'w-502', title: '北海道 8 天 7 夜 | day1',         cover: G_GREEN,  duration: 142, views: 18_240,  likes: 1_280,  publishedAt: now - 6 * day, status: 'published', hashtags: ['#旅行', '#日本'] },
  { id: 'w-503', title: '我家附近的早餐店 | KFC 大早餐',   cover: G_GOLD,   duration: 48,  views: 12_840,  likes: 920,    publishedAt: now - 3 * day, status: 'published', hashtags: ['#美食探店', '#KFC'] },
];

export function relativeTime(ts: number, ref = Date.now()): string {
  const diff = ref - ts;
  const abs = Math.abs(diff);
  const future = diff < 0;
  const m = Math.floor(abs / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return future ? `${d} 天后` : `${d} 天前`;
  if (h > 0) return future ? `${h} 小时后` : `${h} 小时前`;
  if (m > 0) return future ? `${m} 分钟后` : `${m} 分钟前`;
  return future ? '即将' : '刚刚';
}

export function formatBigNumber(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}亿`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}w`;
  return n.toLocaleString();
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

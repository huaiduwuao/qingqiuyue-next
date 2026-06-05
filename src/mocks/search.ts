/**
 * Search (搜索) mock data — used by the home TopBar search and SearchPanel.
 * 真实后端就绪后,把 searchContent/searchCreators/searchTopics 三个函数
 * 替换为对应 API 即可,字段保持同名。
 */

export interface SearchContentItem {
  id: number;
  title: string;
  subtitle?: string;
  contentType: 'NOVEL' | 'FILM' | 'MUSIC' | 'VIDEO' | 'COMICS' | 'TELEPLAY' | 'ARTICLE' | 'ANIMATION' | 'NEWS' | 'VSHOW';
  coverGradient: string;
  author: string;
  views: number;
  comments: number;
  likes: number;
  matchField: 'title' | 'subtitle' | 'author'; // 命中字段,用于结果里高亮
}

export interface SearchCreatorItem {
  id: number;
  name: string;
  bio: string;
  avatarGradient: string;
  followers: number;
  works: number;
  verified: boolean;
  tags: string[];
}

export interface SearchTopicItem {
  id: number;
  title: string;
  description: string;
  discussCount: number;
  viewCount: number;
  hot: boolean;
  gradient: string;
}

export const HOT_KEYWORDS: string[] = [
  '狼人杀',
  '深海深水',
  'AI 创作',
  '短剧',
  '同人画',
  '治愈系',
  '悬疑剧场',
  '古风音乐',
];

export const SEARCH_HISTORY: string[] = ['AI 狼人杀 52 局', '古风配乐', '海龟汤', '二次元恋爱'];

/**
 * 模拟服务端搜索:对 query 做大小写不敏感的子串匹配,
 * 命中 title / subtitle / author 任一即返回。
 * 真实后端就绪后,把这三个函数换成 API 调用即可。
 */
export function searchContent(query: string): SearchContentItem[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return CONTENT_POOL.filter(
    (c) =>
      c.title.toLowerCase().includes(q) ||
      (c.subtitle?.toLowerCase().includes(q) ?? false) ||
      c.author.toLowerCase().includes(q),
  );
}

export function searchCreators(query: string): SearchCreatorItem[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return CREATOR_POOL.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.bio.toLowerCase().includes(q) ||
      c.tags.some((t) => t.toLowerCase().includes(q)),
  );
}

export function searchTopics(query: string): SearchTopicItem[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return TOPIC_POOL.filter(
    (t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
  );
}

const CONTENT_POOL: SearchContentItem[] = [
  {
    id: 1,
    title: 'AI 狼人杀第 52 局',
    subtitle: '12 人动物梦境 · 高能推理',
    contentType: 'VIDEO',
    coverGradient: 'linear-gradient(135deg, #FE2C55 0%, #8B5CF6 100%)',
    author: '狼村异事',
    views: 234_000,
    comments: 18_500,
    likes: 42_300,
    matchField: 'title',
  },
  {
    id: 2,
    title: '深海深水 - 埃及艳后',
    subtitle: '为了等几白目的娜察干干的,他们要潜入水母宫殿',
    contentType: 'COMICS',
    coverGradient: 'linear-gradient(135deg, #8B5CF6 0%, #2D1B4E 100%)',
    author: '南风知我意',
    views: 89_200,
    comments: 4_120,
    likes: 12_800,
    matchField: 'title',
  },
  {
    id: 3,
    title: '狼村异事 - 红事已完,轮到白事',
    subtitle: '悬疑短剧 · 全 12 集',
    contentType: 'TELEPLAY',
    coverGradient: 'linear-gradient(135deg, #FFB400 0%, #8B0000 100%)',
    author: '杏花微雨',
    views: 412_000,
    comments: 28_400,
    likes: 67_500,
    matchField: 'subtitle',
  },
  {
    id: 4,
    title: '海龟汤 100 局精选',
    subtitle: '高压桌游 · 沉浸式推理',
    contentType: 'VSHOW',
    coverGradient: 'linear-gradient(135deg, #06B6D4 0%, #5DDB96 100%)',
    author: '青衫客',
    views: 156_000,
    comments: 9_200,
    likes: 22_400,
    matchField: 'title',
  },
  {
    id: 5,
    title: '古风配乐《清秋月》',
    subtitle: '原创纯音乐 · 钢琴 + 古筝',
    contentType: 'MUSIC',
    coverGradient: 'linear-gradient(135deg, #D4AF37 0%, #8B6F1F 100%)',
    author: '小桥流水',
    views: 78_400,
    comments: 2_300,
    likes: 11_600,
    matchField: 'title',
  },
  {
    id: 6,
    title: 'AI 创作指南:从 prompt 到成片',
    subtitle: '清秋月官方创作教程',
    contentType: 'ARTICLE',
    coverGradient: 'linear-gradient(135deg, #25F4EE 0%, #5B8DEF 100%)',
    author: '清秋月官方',
    views: 23_400,
    comments: 1_100,
    likes: 5_800,
    matchField: 'title',
  },
  {
    id: 7,
    title: '二次元恋爱物语',
    subtitle: '少女向 · 全 24 话',
    contentType: 'ANIMATION',
    coverGradient: 'linear-gradient(135deg, #F472B6 0%, #FE2C55 100%)',
    author: '海的尽头',
    views: 312_000,
    comments: 22_400,
    likes: 56_200,
    matchField: 'title',
  },
  {
    id: 8,
    title: '短剧《重生之我在狼人杀》',
    subtitle: '穿越 × 推理 · 爆款 IP',
    contentType: 'TELEPLAY',
    coverGradient: 'linear-gradient(135deg, #FE2C55 0%, #FFB400 100%)',
    author: '夜归人',
    views: 1_240_000,
    comments: 86_000,
    likes: 198_000,
    matchField: 'subtitle',
  },
  {
    id: 9,
    title: '古风音乐合集 2026',
    subtitle: '原创 + 改编 · 200 首',
    contentType: 'MUSIC',
    coverGradient: 'linear-gradient(135deg, #D4AF37 0%, #FFD566 100%)',
    author: '小桥流水',
    views: 56_200,
    comments: 1_800,
    likes: 9_400,
    matchField: 'subtitle',
  },
  {
    id: 10,
    title: '《清秋月》同名小说',
    subtitle: '十年清秋 · 问心明月 · 长篇连载',
    contentType: 'NOVEL',
    coverGradient: 'linear-gradient(135deg, #8B5CF6 0%, #FE2C55 100%)',
    author: '青衫客',
    views: 489_000,
    comments: 34_200,
    likes: 92_400,
    matchField: 'title',
  },
  {
    id: 11,
    title: '治愈系猫咪日常',
    subtitle: '萌宠短视频合集',
    contentType: 'VIDEO',
    coverGradient: 'linear-gradient(135deg, #5DDB96 0%, #06B6D4 100%)',
    author: '山间清月',
    views: 92_400,
    comments: 3_400,
    likes: 14_200,
    matchField: 'subtitle',
  },
  {
    id: 12,
    title: '悬疑剧场《深海回响》',
    subtitle: '心理惊悚 · 8 集',
    contentType: 'TELEPLAY',
    coverGradient: 'linear-gradient(135deg, #1E1B4B 0%, #0F172A 100%)',
    author: '故园',
    views: 234_000,
    comments: 18_400,
    likes: 42_300,
    matchField: 'subtitle',
  },
];

const CREATOR_POOL: SearchCreatorItem[] = [
  {
    id: 1,
    name: '小桥流水',
    bio: '古风音乐人 / 原创配乐 / 钢琴与古筝',
    avatarGradient: 'linear-gradient(135deg, #D4AF37 0%, #FFD566 100%)',
    followers: 1_240_000,
    works: 86,
    verified: true,
    tags: ['音乐', '古风', '原创'],
  },
  {
    id: 2,
    name: '青衫客',
    bio: '推理小说家 · 狼人杀主播 · AI 创作者',
    avatarGradient: 'linear-gradient(135deg, #8B5CF6 0%, #FE2C55 100%)',
    followers: 892_000,
    works: 142,
    verified: true,
    tags: ['小说', '推理', 'AI'],
  },
  {
    id: 3,
    name: '杏花微雨',
    bio: '短剧 / 悬疑 / 影视后期',
    avatarGradient: 'linear-gradient(135deg, #FE2C55 0%, #FFB400 100%)',
    followers: 412_000,
    works: 38,
    verified: true,
    tags: ['短剧', '悬疑'],
  },
  {
    id: 4,
    name: '南风知我意',
    bio: '漫画家 / 同人画师 / 海龟汤狂热粉',
    avatarGradient: 'linear-gradient(135deg, #06B6D4 0%, #8B5CF6 100%)',
    followers: 234_000,
    works: 67,
    verified: false,
    tags: ['漫画', '同人', '海龟汤'],
  },
  {
    id: 5,
    name: '山间清月',
    bio: '治愈系视频博主 / 萌宠日常 / vlog',
    avatarGradient: 'linear-gradient(135deg, #5DDB96 0%, #06B6D4 100%)',
    followers: 156_000,
    works: 124,
    verified: false,
    tags: ['治愈', '萌宠', 'vlog'],
  },
];

const TOPIC_POOL: SearchTopicItem[] = [
  {
    id: 1,
    title: '#AI 狼人杀挑战赛',
    description: '12 人 AI 推理局,你的逻辑能撑到第几轮?',
    discussCount: 28_400,
    viewCount: 1_240_000,
    hot: true,
    gradient: 'linear-gradient(135deg, #FE2C55 0%, #8B5CF6 100%)',
  },
  {
    id: 2,
    title: '#古风音乐复兴',
    description: '传统乐器遇上现代编曲,会擦出怎样的火花?',
    discussCount: 12_200,
    viewCount: 412_000,
    hot: true,
    gradient: 'linear-gradient(135deg, #D4AF37 0%, #FFB400 100%)',
  },
  {
    id: 3,
    title: '#深海深水 同人创作',
    description: '粉丝向二创 / 同人画 / 短剧改编',
    discussCount: 8_900,
    viewCount: 234_000,
    hot: false,
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #2D1B4E 100%)',
  },
  {
    id: 4,
    title: '#治愈系猫咪',
    description: '每天一只猫,治愈一整天',
    discussCount: 18_400,
    viewCount: 612_000,
    hot: true,
    gradient: 'linear-gradient(135deg, #5DDB96 0%, #06B6D4 100%)',
  },
  {
    id: 5,
    title: '#AI 创作 100 问',
    description: '从 prompt 到成片,创作者都在问什么?',
    discussCount: 6_200,
    viewCount: 156_000,
    hot: false,
    gradient: 'linear-gradient(135deg, #25F4EE 0%, #5B8DEF 100%)',
  },
  {
    id: 6,
    title: '#狼村异事 全网首播',
    description: '红事已完,轮到白事 · 悬疑短剧',
    discussCount: 22_400,
    viewCount: 892_000,
    hot: true,
    gradient: 'linear-gradient(135deg, #FFB400 0%, #8B0000 100%)',
  },
];

export function formatNumber(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}亿`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}w`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

/**
 * Home module seed data — 7 侧栏菜单 (精选/推荐/AI 搜索/关注/朋友/直播/放映厅/短剧)。
 */

import { avatar, cover, range } from '../utils/seed';

// ─── 我的:个人主页 profile ───
export const MY_PROFILE = {
  user: {
    id: 1,
    nickname: '怀独无傲',
    douyinId: '84301022',
    avatar: avatar(101),
    age: 32,
    region: '奥地利',
    bio: '心怀孤独 · 身无傲气',
    level: '月亮',
  },
  stats: {
    following: 131,
    followers: 23,
    likes: 0,
    lives: 3,
  },
  recent: [
    { id: 1, title: '银杏树下', cover: cover(400, 600, 201), views: 3200 },
    { id: 2, title: '雨后清秋', cover: cover(400, 600, 202), views: 2100 },
    { id: 3, title: '月下独酌', cover: cover(400, 600, 203), views: 1800 },
  ],
  appointments: 2,
  collections: 49,
};

// ─── 我的:每个 tab 的内容(作品/喜欢/收藏/历史/稍后/预约/AI 笔记) ───
type MyItem = {
  id: number;
  title: string;
  cover: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  collectNum: number;
  durationSec: number;
  postedAt: number;
  contentType: 'NOVEL' | 'MUSIC' | 'FILM' | 'TELEPLAY' | 'ANIMATION' | 'COMICS' | 'VIDEO' | 'VSHOW' | 'LIVE' | 'ARTICLE' | 'NEWS';
  status: 'public' | 'private' | 'draft';
  isPrivate?: boolean;
};

function buildMyItem(i: number, opts: { type?: MyItem['contentType']; daysAgo?: number; status?: MyItem['status'] } = {}): MyItem {
  const titles = ['银杏树下', '雨后清秋', '月下独酌', '长安的雨', '北岭的雪', '拾光手记', '山城阿吉', '光与影', '海蓝时见鲸', '夜雨寄北', '清欢渡', '林深时见鹿'];
  return {
    id: 1000 + i,
    title: titles[i % titles.length] + (i > 11 ? ` ${Math.floor(i / 12) + 1}` : ''),
    cover: cover(400, 600, 500 + i),
    views: 800 + (i * 173) % 12000,
    likes: 12 + (i * 11) % 800,
    comments: 2 + (i * 3) % 200,
    shares: 1 + (i * 2) % 80,
    collectNum: 5 + (i * 7) % 400,
    durationSec: 30 + (i * 13) % 600,
    postedAt: Date.now() - (opts.daysAgo ?? i) * 86_400_000,
    contentType: opts.type ?? (['VIDEO', 'NOVEL', 'MUSIC', 'ARTICLE', 'FILM'] as const)[i % 5],
    status: opts.status ?? 'public',
    isPrivate: opts.status === 'private',
  };
}

const MY_WORKS: MyItem[] = range(12).map((i) => buildMyItem(i, { daysAgo: i }));
const MY_PRIVATE_WORKS: MyItem[] = range(3).map((i) => buildMyItem(20 + i, { status: 'private' }));
const MY_DRAFT: MyItem[] = range(2).map((i) => buildMyItem(30 + i, { status: 'draft' }));
const MY_COLLECTIONS_LIST: MyItem[] = range(18).map((i) => buildMyItem(40 + i, { daysAgo: i * 2 }));
const MY_LIKES: MyItem[] = range(8).map((i) => buildMyItem(60 + i, { daysAgo: i }));
const MY_HISTORY: MyItem[] = range(15).map((i) => buildMyItem(80 + i, { daysAgo: 0, type: 'VIDEO' }));
const MY_LATER: MyItem[] = range(5).map((i) => buildMyItem(100 + i, { daysAgo: i }));
const MY_APPOINTMENTS: MyItem[] = range(3).map((i) => buildMyItem(120 + i, { type: 'LIVE', daysAgo: 1 }));
const MY_AI_NOTES: MyItem[] = range(6).map((i) => buildMyItem(140 + i, { type: 'ARTICLE', daysAgo: i * 3 }));
const MY_COLLECTIONS_GROUP: { id: number; title: string; cover: string; count: number; updatedAt: number }[] = range(6).map((i) => ({
  id: 200 + i,
  title: ['秋日收藏', '书单合集', '夜读', '音乐盒子', 'AI 收藏', '旅行相册'][i],
  cover: cover(400, 600, 600 + i),
  count: 8 + (i * 5) % 32,
  updatedAt: Date.now() - i * 86_400_000 * 2,
}));
const MY_DRAMAS: MyItem[] = range(2).map((i) => buildMyItem(160 + i, { type: 'TELEPLAY', daysAgo: i * 5 }));

export const MY_CONTENT = {
  works: MY_WORKS,
  private: MY_PRIVATE_WORKS,
  draft: MY_DRAFT,
  collection: MY_COLLECTIONS_LIST,
  collections: MY_COLLECTIONS_GROUP,
  drama: MY_DRAMAS,
  like: MY_LIKES,
  history: MY_HISTORY,
  later: MY_LATER,
  order: MY_APPOINTMENTS,
  ai: MY_AI_NOTES,
  recommend: MY_COLLECTIONS_LIST.slice(0, 6),
};

// ─── 通用 feed (首页/关注/朋友共用) ───
type FeedItem = {
  id: number;
  authorId: number;
  authorName: string;
  authorAvatar: string;
  title: string;
  cover: string;
  durationSec: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  isLive?: boolean;
  liveViewers?: number;
  postedAgoMin: number;
  isFollowing?: boolean;
  isFriend?: boolean;
  category: 'video' | 'live' | 'image' | 'short';
  section: 'recommend' | 'live' | 'music' | 'anime' | 'news' | 'entertainment' | 'tech' | 'food' | 'game' | 'knowledge' | 'sports' | 'finance' | 'novel' | 'comics' | 'film' | 'teleplay';
};

export const FEED_SECTIONS: { key: FeedItem['section']; label: string }[] = [
  { key: 'recommend', label: '推荐' },
  { key: 'novel', label: '小说' },
  { key: 'comics', label: '漫画' },
  { key: 'film', label: '影视' },
  { key: 'teleplay', label: '小剧场' },
  { key: 'entertainment', label: '综艺' },
  { key: 'music', label: '音乐' },
  { key: 'anime', label: '二次元' },
  { key: 'news', label: '资讯' },
  { key: 'tech', label: '科技' },
  { key: 'food', label: '美食' },
  { key: 'game', label: '游戏' },
  { key: 'knowledge', label: '知识' },
  { key: 'sports', label: '体育' },
  { key: 'finance', label: '财经' },
];

// ─── 用户库(关注/朋友/suggestions 都从这取)───
export const CURRENT_USER_ID = 1;

export type UserSummary = {
  id: number;
  name: string;
  avatar: string;
  douyinId: string;
  bio?: string;
  followers: number;
  following: number;
  posts: number;
  verified?: boolean;
  region?: string;
};

const USER_NAMES = [
  '江南烟雨', '云中孤鹤', '山有木兮', '海边的卡夫卡', '南方有暖阳',
  '风的诗', '夜的第七章', '青衫客', '小桥流水', '梧桐细雨',
  '半山听雨', '青灯古佛', '山间明月', '江上晚风', '林深时见鹿',
  '海蓝时见鲸', '夜雨寄北', '清欢渡', '南风知我意', '且听风吟',
  '清秋月', '墨羽', '北望长安', '长歌行', '月满西楼', '白衣卿相',
  '清平调', '行到水穷处', '坐看云起时', '此心安处',
];

export const USERS: UserSummary[] = [
  { id: 1, name: '怀独无傲', avatar: avatar(101), douyinId: '84301022', bio: '心怀孤独 · 身无傲气', followers: 23, following: 131, posts: 0, region: '奥地利' },
  ...USER_NAMES.map((name, i) => ({
    id: 1000 + i + 1, // 1001..1030
    name,
    avatar: avatar(3000 + i),
    douyinId: `qqy${(1000 + i).toString()}`,
    bio: ['古风摄影师', '美食探店', '旅行博主', '独立音乐人', '国风舞者', '二创作者', '深夜电台', '手帐达人', '园艺生活', '古琴研习'][i % 10] + ' · ' + name,
    followers: 500 + (i * 137) % 9500,
    following: 50 + (i * 23) % 950,
    posts: 10 + (i * 7) % 200,
    verified: i % 5 === 0,
    region: ['北京', '上海', '杭州', '成都', '广州', '西安', '苏州', '南京'][i % 8],
  })),
];

export function getUser(id: number): UserSummary | null {
  return USERS.find((u) => u.id === id) || null;
}

// ─── 关系(可变,用于 follow/unfollow 写入)───
// 我(怀独无傲, id=1) 当前关注了 6 个人,其中 3 个是朋友
export const FOLLOWED_IDS: Set<number> = new Set([1001, 1003, 1005, 1007, 1009, 1011]);
export const FRIEND_IDS: Set<number> = new Set([1001, 1003, 1005]);
export const FRIEND_REQUESTS: { id: number; fromId: number; fromName: string; fromAvatar: string; message: string; time: string }[] = [
  { id: 1, fromId: 1012, fromName: '青灯古佛', fromAvatar: avatar(3011), message: '通过一下,认识一下', time: '2 小时前' },
  { id: 2, fromId: 1015, fromName: '林深时见鹿', fromAvatar: avatar(3014), message: '你关注的人也关注了 ta', time: '5 小时前' },
  { id: 3, fromId: 1018, fromName: '清欢渡', fromAvatar: avatar(3017), message: '想和你成为朋友', time: '昨天' },
];

// 关系操作(纯函数副本写入,模拟不可变)
export function isFollowing(userId: number): boolean { return FOLLOWED_IDS.has(userId); }
export function isFriend(userId: number): boolean { return FRIEND_IDS.has(userId); }
export function followUser(userId: number): boolean {
  if (FOLLOWED_IDS.has(userId)) return false;
  FOLLOWED_IDS.add(userId);
  return true;
}
export function unfollowUser(userId: number): boolean {
  if (!FOLLOWED_IDS.has(userId)) return false;
  FOLLOWED_IDS.delete(userId);
  FRIEND_IDS.delete(userId);
  return true;
}
export function addFriend(userId: number): boolean {
  if (!FOLLOWED_IDS.has(userId)) FOLLOWED_IDS.add(userId);
  if (FRIEND_IDS.has(userId)) return false;
  FRIEND_IDS.add(userId);
  return true;
}
export function removeFriend(userId: number): boolean {
  if (!FRIEND_IDS.has(userId)) return false;
  FRIEND_IDS.delete(userId);
  return true;
}
export function acceptFriendRequest(reqId: number) {
  const idx = FRIEND_REQUESTS.findIndex((r) => r.id === reqId);
  if (idx < 0) return null;
  const req = FRIEND_REQUESTS[idx];
  FRIEND_REQUESTS.splice(idx, 1);
  addFriend(req.fromId);
  return req;
}
export function rejectFriendRequest(reqId: number) {
  const idx = FRIEND_REQUESTS.findIndex((r) => r.id === reqId);
  if (idx < 0) return null;
  const [req] = FRIEND_REQUESTS.splice(idx, 1);
  return req;
}

// ─── 我发出的好友申请 ───
export const SENT_FRIEND_REQUESTS: { id: number; toId: number; toName: string; toAvatar: string; message: string; time: string }[] = [
  { id: 101, toId: 1020, toName: '南风知我意', toAvatar: avatar(3019), message: '我是怀独无傲', time: '1 天前' },
  { id: 102, toId: 1025, toName: '白衣卿相', toAvatar: avatar(3024), message: '想加个好友一起创作', time: '3 天前' },
];
export function getSentFriendRequests() {
  return SENT_FRIEND_REQUESTS.slice();
}
export function cancelSentFriendRequest(reqId: number) {
  const idx = SENT_FRIEND_REQUESTS.findIndex((r) => r.id === reqId);
  if (idx < 0) return null;
  const [req] = SENT_FRIEND_REQUESTS.splice(idx, 1);
  return req;
}

// ─── 我的好友(从 FRIEND_IDS 派生出 UserSummary)───
export function getFriendList(): UserSummary[] {
  return Array.from(FRIEND_IDS)
    .map((id) => getUser(id))
    .filter((u): u is UserSummary => u !== null);
}
// ─── 我的关注(从 FOLLOWED_IDS 派生出 UserSummary + 朋友标记)───
export function getFollowingList() {
  return Array.from(FOLLOWED_IDS)
    .map((id) => {
      const u = getUser(id);
      return u ? { ...u, isFriend: FRIEND_IDS.has(id) } : null;
    })
    .filter((u): u is UserSummary & { isFriend: boolean } => u !== null);
}
export function getFriendStats() {
  return {
    friendCount: FRIEND_IDS.size,
    incomingCount: FRIEND_REQUESTS.length,
    sentCount: SENT_FRIEND_REQUESTS.length,
  };
}

// ─── Feed 构造:用真实 userId,标 isFollowing/isFriend ───
const NAMES = USER_NAMES;

function makeFeed(start: number, n: number): FeedItem[] {
  const sectionKeys = FEED_SECTIONS.map((s) => s.key);
  // 作者池:从 USERS 里抽 id>=1001 的真实用户
  const authorPool = USERS.filter((u) => u.id >= 1001);
  return range(n, start).map((i) => {
    const isLive = i % 7 === 3;
    const isShort = i % 5 === 1;
    const isImage = !isLive && !isShort && i % 9 === 4;
    const sectionIdx = (i + start) % sectionKeys.length;
    const section = sectionKeys[sectionIdx] as FeedItem['section'];
    const author = authorPool[(i + start) % authorPool.length];
    return {
      id: i,
      authorId: author.id,
      authorName: author.name,
      authorAvatar: author.avatar,
      title: isLive ? '现场直播中,一起来看!' : isShort ? '短剧片段' : isImage ? `${author.name} 拍的图集` : `${author.name} 的作品 ${i}`,
      cover: isLive ? cover(800, 450, 4000 + i) : cover(800, 450, 5000 + i),
      durationSec: isLive ? 0 : 30 + (i % 12) * 10,
      views: 1000 + (i * 137) % 9000,
      likes: 50 + (i * 23) % 950,
      comments: 5 + (i * 7) % 95,
      shares: 1 + (i * 3) % 49,
      isLive,
      liveViewers: isLive ? 200 + (i * 11) % 800 : undefined,
      postedAgoMin: i * 7 + 3,
      isFollowing: isFollowing(author.id),
      isFriend: isFriend(author.id),
      category: isLive ? 'live' : isShort ? 'short' : isImage ? 'image' : 'video',
      section,
    };
  });
}

// 全量 feed 池(40 条),按 user 关系过滤
// 倒序:postedAgoMin 越小越新 → ASC = 最新在前
const ALL_FEED: FeedItem[] = makeFeed(101, 40).sort((a, b) => a.postedAgoMin - b.postedAgoMin);

export const FEED = {
  // 精选(原首页)— 抖音风格瀑布流混合内容(全量,无关关系)
  home: ALL_FEED.slice(0, 18),
  // 关注:仅我关注的人
  follow: () => ALL_FEED.filter((f) => FOLLOWED_IDS.has(f.authorId)).map(decorateFollow),
  // 朋友:互为朋友
  friend: () => ALL_FEED.filter((f) => FRIEND_IDS.has(f.authorId)).map(decorateFollow),
};

function decorateFollow(f: FeedItem): FeedItem {
  return { ...f, isFollowing: isFollowing(f.authorId), isFriend: isFriend(f.authorId) };
}

// ─── 建议关注/加好友列表 ───
export function suggestFollowUsers(limit = 8): UserSummary[] {
  return USERS.filter((u) => u.id >= 1001 && !FOLLOWED_IDS.has(u.id)).slice(0, limit);
}
export function suggestFriendUsers(limit = 8): UserSummary[] {
  return USERS.filter((u) => u.id >= 1001 && !FRIEND_IDS.has(u.id) && !FOLLOWED_IDS.has(u.id)).slice(0, limit);
}

// 内容类型子分类(全部/视频/直播/图文/短剧)
export const FEED_CATEGORIES: { key: 'all' | FeedItem['category']; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'video', label: '视频' },
  { key: 'live', label: '直播' },
  { key: 'image', label: '图文' },
  { key: 'short', label: '短剧' },
];

// ─── 直播 ───
export const LIVE_ROOMS = range(18).map((i) => ({
  id: 6000 + i,
  hostId: 2000 + i,
  hostName: NAMES[i % NAMES.length],
  hostAvatar: avatar(2000 + i),
  title: `${NAMES[i % NAMES.length]} 直播间`,
  cover: cover(600, 800, 6000 + i),
  viewers: 100 + (i * 47) % 4900,
  category: ['颜值', '游戏', '音乐', '户外', '二次元', '知识'][i % 6],
  region: ['内地', '港澳台', '日本', '韩国', '欧美'][i % 5],
  startedAt: Date.now() - (i * 13 + 5) * 60_000, // 距开始分钟数
  isLive: i % 5 !== 4,
  isTop: i < 3,
  hotRank: 0,
}));
// 按 viewers 倒序排,前 10 上榜
LIVE_ROOMS.sort((a, b) => b.viewers - a.viewers);
LIVE_ROOMS.forEach((r, i) => { r.hotRank = i < 10 ? i + 1 : 0; });
export const LIVE_TOP_10 = LIVE_ROOMS.filter((r) => r.hotRank > 0).sort((a, b) => a.hotRank - b.hotRank);

// ─── 放映厅 ───
export const THEATER_ITEMS = range(24).map((i) => ({
  id: 7000 + i,
  title: ['深海深水', '狼村异事', 'AI 狼人杀', '大侠远山', '红楼梦', '西部世界', '长安三万里', '独立日'][i % 8] + ` 第 ${i + 1} 集`,
  cover: cover(800, 450, 7000 + i),
  durationMin: 30 + (i % 6) * 15,
  rating: 7 + (i % 3) * 0.5,
  category: (['movie', 'drama', 'anime', 'variety'] as const)[i % 4],
  region: ['国产', '欧美', '日韩', '其他'][i % 4],
  year: 2020 + (i % 7),
  views: 50000 + (i * 19437) % 950000,
}));

// ─── 短剧分类(题材) ───
export type DramaGenre = '古风' | '悬疑' | '都市' | '言情' | '校园' | '逆袭';
export const DRAMA_GENRES: DramaGenre[] = ['古风', '悬疑', '都市', '言情', '校园', '逆袭'];
// ─── 短剧状态 ───
export type DramaStatus = 'HOT' | 'DONE' | 'EXCLUSIVE';
export const DRAMA_STATUSES: { key: DramaStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: '全部' },
  { key: 'HOT', label: '热门连载' },
  { key: 'DONE', label: '已完结' },
  { key: 'EXCLUSIVE', label: '独家' },
];

// ─── 短剧系列(整剧) ───
export type DramaSeries = {
  id: number;
  title: string;
  cover: string;
  genre: DramaGenre;
  status: DramaStatus;
  rating: number;
  views: number;
  likes: number;
  episodes: number;
  freeEpisodes: number;
  author: string;
  description: string;
  hotRank: number; // 0 = 不上榜;1-10 上榜
};

const DRAMA_TITLES = [
  { title: '锦衣夜行', genre: '古风' as const, status: 'HOT' as const, author: '月满西楼' },
  { title: '长安未晚', genre: '古风' as const, status: 'EXCLUSIVE' as const, author: '白衣卿相' },
  { title: '鹤唳华亭', genre: '古风' as const, status: 'DONE' as const, author: '清秋月' },
  { title: '重生之都市仙尊', genre: '都市' as const, status: 'HOT' as const, author: '北望长安' },
  { title: '逆袭：从送外卖开始', genre: '逆袭' as const, status: 'HOT' as const, author: '长歌行' },
  { title: '我的学霸女友', genre: '校园' as const, status: 'DONE' as const, author: '青衫客' },
  { title: '禁庭深深', genre: '言情' as const, status: 'HOT' as const, author: '清平调' },
  { title: '血色档案', genre: '悬疑' as const, status: 'EXCLUSIVE' as const, author: '夜雨寄北' },
  { title: '替嫁后我成了团宠', genre: '言情' as const, status: 'HOT' as const, author: '南风知我意' },
  { title: '回到 1998', genre: '逆袭' as const, status: 'DONE' as const, author: '此心安处' },
  { title: '迷雾之城', genre: '悬疑' as const, status: 'HOT' as const, author: '且听风吟' },
  { title: '那年夏天的风', genre: '校园' as const, status: 'DONE' as const, author: '风的诗' },
  { title: '锦衣之下·双生', genre: '古风' as const, status: 'HOT' as const, author: '月满西楼' },
  { title: '下山后我被盯上了', genre: '都市' as const, status: 'EXCLUSIVE' as const, author: '行到水穷处' },
  { title: '闪婚总裁的替身妻', genre: '言情' as const, status: 'DONE' as const, author: '坐看云起时' },
  { title: '暗夜追凶', genre: '悬疑' as const, status: 'HOT' as const, author: '夜雨寄北' },
  { title: '高考 1999', genre: '校园' as const, status: 'HOT' as const, author: '青衫客' },
  { title: '重回巅峰', genre: '逆袭' as const, status: 'EXCLUSIVE' as const, author: '此心安处' },
  { title: '宫墙柳', genre: '古风' as const, status: 'DONE' as const, author: '清平调' },
  { title: '金融巨鳄', genre: '都市' as const, status: 'HOT' as const, author: '北望长安' },
  { title: '他的小仙女', genre: '言情' as const, status: 'EXCLUSIVE' as const, author: '且听风吟' },
  { title: '回到那年高考', genre: '校园' as const, status: 'HOT' as const, author: '风的诗' },
  { title: '一夜暴富后', genre: '逆袭' as const, status: 'DONE' as const, author: '长歌行' },
  { title: '消失的证据', genre: '悬疑' as const, status: 'DONE' as const, author: '夜雨寄北' },
];

export const DRAMA_SERIES: DramaSeries[] = DRAMA_TITLES.map((d, i) => ({
  id: 9000 + i,
  title: d.title,
  cover: cover(400, 600, 9000 + i),
  genre: d.genre,
  status: d.status,
  rating: 7 + ((i * 17) % 30) / 10, // 7.0 - 9.9
  views: 100000 + (i * 23147) % 9900000, // 10w - 1000w
  likes: 1000 + (i * 311) % 99900,
  episodes: 24 + (i % 6) * 12, // 24-84
  freeEpisodes: (i % 3) + 1, // 1-3
  author: d.author,
  description: `${d.author} 作品 · ${d.genre}题材 ${d.status === 'DONE' ? '已完结' : '连载中'},共 ${24 + (i % 6) * 12} 集。`,
  hotRank: 0, // 后续按 views 排序后赋值
}));

// 按 views 倒序排,前 10 上榜
DRAMA_SERIES.sort((a, b) => b.views - a.views);
DRAMA_SERIES.forEach((d, i) => { d.hotRank = i < 10 ? i + 1 : 0; });

export const DRAMA_TOP_10: DramaSeries[] = DRAMA_SERIES.filter((d) => d.hotRank > 0).sort((a, b) => a.hotRank - b.hotRank);

// ─── 短剧分集(保留,供详情页)───
export const DRAMA_EPISODES = range(30).map((i) => ({
  id: 8000 + i,
  dramaId: 9000,
  episode: i + 1,
  title: `第 ${i + 1} 集`,
  durationSec: 60 + (i % 5) * 30,
  cover: cover(400, 600, 8000 + i),
  views: 500 + (i * 89) % 9500,
  isFree: i < 5,
}));

// 放映厅 Top 10(按 views 排)
export const THEATER_TOP_10 = [...THEATER_ITEMS]
  .sort((a, b) => b.views - a.views)
  .slice(0, 10)
  .map((item, i) => ({ ...item, hotRank: i + 1 }));

// ─── AI 搜索分块响应 ───
export const AI_SEARCH_CHUNKS: Record<string, { type: 'text' | 'card'; content: string; meta?: any }[]> = {
  default: [
    { type: 'text', content: '我理解你想了解这个话题。下面是一些相关推荐:' },
    { type: 'card', content: '相关视频', meta: { items: range(4).map((i) => ({ id: 9000 + i, title: `AI 推荐 ${i + 1}`, cover: cover(400, 600, 9000 + i) })) } },
    { type: 'text', content: '如果你想深入了解,可以试试搜索更具体的关键词。' },
  ],
};

// ─── 右栏 tab 内容(精选/关注/朋友 共用) ───
export const SIDE_COMMENTS = [
  { id: 1, user: '海边的卡夫卡', avatar: avatar(3001), text: '屠边局女巫真不能自救 太刺激了', likes: 248, time: '3 分钟前' },
  { id: 2, user: '山有木兮', avatar: avatar(3003), text: '白狼王第 4 轮的发言直接封神 🐺', likes: 132, time: '12 分钟前' },
  { id: 3, user: '云中孤鹤', avatar: avatar(3002), text: '求 56 局完整时间线 🙏', likes: 89, time: '24 分钟前' },
  { id: 4, user: '梧桐细雨', avatar: avatar(3009), text: 'Claude 骑士的逻辑链真清晰', likes: 56, time: '40 分钟前' },
  { id: 5, user: '小桥流水', avatar: avatar(3008), text: 'Gemini 预言家查杀好准', likes: 41, time: '1 小时前' },
];

export const SIDE_RELATED = range(6).map((i) => ({
  id: 10000 + i,
  title: ['狼村异事 第 12 集', '大侠远山 上帝视角', 'AI 狼人杀 第 55 局', '深海深水 第 5 集', '狼人杀复盘 第 56 局', '狼村异事 番外篇'][i],
  author: NAMES[i % NAMES.length],
  authorAvatar: avatar(4000 + i),
  cover: cover(400, 600, 10000 + i),
  durationSec: 30 + (i % 8) * 15,
  views: 1200 + (i * 311) % 8800,
  likes: 30 + (i * 17) % 700,
  category: (['video', 'short', 'live'] as const)[i % 3],
}));

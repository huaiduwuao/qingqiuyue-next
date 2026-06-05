/**
 * Wallpaper (壁纸) mock data — used by the /wallpaper page.
 * 真实后端就绪后,把这里替换为 `wallpaperClient` 调用即可,字段保持同名。
 * 壁纸背景(`bg`)支持两种形态:gradient(纯 CSS 渐变)或 image(CDN URL)。
 */

export type WallpaperSource = 'gradient' | 'image';

export type WallpaperCategory = 'abstract' | 'anime' | 'scenery' | 'stars' | 'minimal' | 'cyber';

export type WallpaperSize = 'desktop' | 'tablet' | 'mobile' | 'all';

export interface Wallpaper {
  id: string;
  title: string;
  category: WallpaperCategory;
  tags: string[];
  source: WallpaperSource;
  /** gradient: CSS linear-gradient() 字符串; image: CDN URL */
  bg: string;
  /** 顶部点缀色(用于卡片小角标) */
  accent: string;
  author: string;
  /** 已下载/收藏人数,展示用 */
  usage: number;
  /** 文件大小(MB) */
  sizeMb: number;
  /** 推荐理由/简介 */
  desc: string;
  /** 适用场景 */
  sizes: WallpaperSize[];
  /** 是否官方发布 */
  official: boolean;
  /** 发布时间 */
  releaseTime: string; // ISO
}

export interface MyWallpaper {
  id: string;
  /** 当前应用到哪个区域:`home` = 主页背景;`account` = 个人中心;`none` = 仅收藏未应用 */
  appliedTo: 'home' | 'account' | 'none';
  setAt: string; // ISO
}

export const WALLPAPER_CATEGORIES: Array<{
  key: WallpaperCategory;
  label: string;
  sub: string;
  accent: string;
}> = [
  { key: 'abstract', label: '抽象渐变', sub: '极简色彩 · 高级感', accent: '#8B5CF6' },
  { key: 'anime', label: '二次元', sub: '动画/插画风格', accent: '#FE2C55' },
  { key: 'scenery', label: '自然风景', sub: '山 · 海 · 森林', accent: '#5DDB96' },
  { key: 'stars', label: '星空宇宙', sub: '银河 · 极光', accent: '#5B8DEF' },
  { key: 'minimal', label: '极简', sub: '纯色 · 留白', accent: '#C5C8D6' },
  { key: 'cyber', label: '赛博朋克', sub: '霓虹 · 故障风', accent: '#FF6B8A' },
];

export const WALLPAPERS: Wallpaper[] = [
  {
    id: 'w001',
    title: '极光之夜',
    category: 'stars',
    tags: ['极光', '深空', '夜晚'],
    source: 'gradient',
    bg: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 35%, #4C1D95 70%, #831843 100%)',
    accent: '#06B6D4',
    author: '清秋月官方',
    usage: 12480,
    sizeMb: 4.2,
    desc: '冰岛极光下的静谧时刻,色彩在黑夜里轻柔流淌。',
    sizes: ['desktop', 'tablet', 'mobile'],
    official: true,
    releaseTime: '2026-04-12T00:00:00+08:00',
  },
  {
    id: 'w002',
    title: '紫境幻象',
    category: 'abstract',
    tags: ['紫色', '光晕', '梦幻'],
    source: 'gradient',
    bg: 'linear-gradient(135deg, #8B5CF6 0%, #C4B5FD 50%, #FE2C55 100%)',
    accent: '#8B5CF6',
    author: '设计师 @Mia',
    usage: 8932,
    sizeMb: 2.8,
    desc: '紫色光影交错的迷幻空间,适合写代码时凝视。',
    sizes: ['desktop', 'tablet', 'mobile'],
    official: false,
    releaseTime: '2026-04-08T00:00:00+08:00',
  },
  {
    id: 'w003',
    title: '鲸落之海',
    category: 'scenery',
    tags: ['海洋', '深蓝', '鲸鱼'],
    source: 'gradient',
    bg: 'linear-gradient(180deg, #0C4A6E 0%, #075985 40%, #0EA5E9 100%)',
    accent: '#0EA5E9',
    author: '清秋月官方',
    usage: 15620,
    sizeMb: 5.6,
    desc: '深海里鲸鱼缓缓下沉的瞬间,生命与寂静的对话。',
    sizes: ['desktop', 'mobile'],
    official: true,
    releaseTime: '2026-03-30T00:00:00+08:00',
  },
  {
    id: 'w004',
    title: '霓虹都市',
    category: 'cyber',
    tags: ['赛博', '霓虹', '城市'],
    source: 'gradient',
    bg: 'linear-gradient(135deg, #0A0A0F 0%, #1F1B3A 30%, #FE2C55 65%, #06B6D4 100%)',
    accent: '#FE2C55',
    author: '设计师 @K',
    usage: 9841,
    sizeMb: 3.4,
    desc: '不夜城的霓虹招牌,雨后的反光倒映出另一个赛博世界。',
    sizes: ['desktop', 'mobile'],
    official: false,
    releaseTime: '2026-04-20T00:00:00+08:00',
  },
  {
    id: 'w005',
    title: '雪山日出',
    category: 'scenery',
    tags: ['雪山', '日出', '温暖'],
    source: 'gradient',
    bg: 'linear-gradient(180deg, #FCD34D 0%, #F59E0B 25%, #FB923C 50%, #1E3A8A 100%)',
    accent: '#F59E0B',
    author: '摄影师 @柳白',
    usage: 7204,
    sizeMb: 6.1,
    desc: '珠穆朗玛峰的第一缕阳光,金红交接的瞬间。',
    sizes: ['desktop', 'tablet'],
    official: true,
    releaseTime: '2026-04-01T00:00:00+08:00',
  },
  {
    id: 'w006',
    title: '樱花物语',
    category: 'anime',
    tags: ['樱花', '少女', '春日'],
    source: 'gradient',
    bg: 'linear-gradient(135deg, #FDF2F8 0%, #FBCFE8 40%, #F9A8D4 100%)',
    accent: '#F472B6',
    author: '插画师 @小桥',
    usage: 18930,
    sizeMb: 3.9,
    desc: '四月樱花飘落的校园走廊,少女回眸的温柔瞬间。',
    sizes: ['desktop', 'mobile'],
    official: false,
    releaseTime: '2026-04-15T00:00:00+08:00',
  },
  {
    id: 'w007',
    title: '墨竹听雨',
    category: 'minimal',
    tags: ['水墨', '竹', '极简'],
    source: 'gradient',
    bg: 'linear-gradient(180deg, #F5F5F4 0%, #E7E5E4 60%, #D6D3D1 100%)',
    accent: '#44403C',
    author: '清秋月官方',
    usage: 5460,
    sizeMb: 1.8,
    desc: '水墨画里的几杆竹,雨声滴答的午后。',
    sizes: ['desktop', 'tablet', 'mobile'],
    official: true,
    releaseTime: '2026-03-15T00:00:00+08:00',
  },
  {
    id: 'w008',
    title: '银河铁道',
    category: 'stars',
    tags: ['银河', '星空', '旅行'],
    source: 'gradient',
    bg: 'linear-gradient(180deg, #020617 0%, #1E1B4B 30%, #4F46E5 70%, #A78BFA 100%)',
    accent: '#A78BFA',
    author: '设计师 @深空',
    usage: 11092,
    sizeMb: 4.7,
    desc: '坐着小火车穿越银河系的奇妙之旅。',
    sizes: ['desktop', 'mobile'],
    official: true,
    releaseTime: '2026-04-22T00:00:00+08:00',
  },
  {
    id: 'w009',
    title: '赛博少女',
    category: 'cyber',
    tags: ['赛博', '少女', '机械'],
    source: 'gradient',
    bg: 'linear-gradient(135deg, #1A0033 0%, #FF006E 50%, #00F5FF 100%)',
    accent: '#FF006E',
    author: '插画师 @Futaba',
    usage: 21040,
    sizeMb: 5.2,
    desc: '机械义体的少女回望镜头,霓虹色的眼眸。',
    sizes: ['desktop', 'mobile'],
    official: false,
    releaseTime: '2026-04-18T00:00:00+08:00',
  },
  {
    id: 'w010',
    title: '森林秘境',
    category: 'scenery',
    tags: ['森林', '绿色', '清晨'],
    source: 'gradient',
    bg: 'linear-gradient(180deg, #ECFCCB 0%, #86EFAC 40%, #166534 100%)',
    accent: '#22C55E',
    author: '摄影师 @山间',
    usage: 6820,
    sizeMb: 4.9,
    desc: '晨雾还没散去的原始森林,阳光斜斜穿透树冠。',
    sizes: ['desktop', 'tablet'],
    official: true,
    releaseTime: '2026-03-28T00:00:00+08:00',
  },
  {
    id: 'w011',
    title: '和风屋檐',
    category: 'anime',
    tags: ['和风', '屋檐', '雨'],
    source: 'gradient',
    bg: 'linear-gradient(180deg, #FEE2E2 0%, #FCA5A5 50%, #7F1D1D 100%)',
    accent: '#DC2626',
    author: '插画师 @千早',
    usage: 8230,
    sizeMb: 3.1,
    desc: '京都古寺的屋檐下,雨滴连成珠帘。',
    sizes: ['desktop', 'mobile'],
    official: false,
    releaseTime: '2026-04-10T00:00:00+08:00',
  },
  {
    id: 'w012',
    title: '黑金几何',
    category: 'minimal',
    tags: ['黑色', '金色', '几何'],
    source: 'gradient',
    bg: 'linear-gradient(135deg, #0A0A0A 0%, #171717 50%, #44403C 100%)',
    accent: '#D4AF37',
    author: '清秋月官方',
    usage: 4180,
    sizeMb: 1.5,
    desc: '极简黑金几何,商务感与高级感并存。',
    sizes: ['desktop', 'tablet', 'mobile'],
    official: true,
    releaseTime: '2026-04-25T00:00:00+08:00',
  },
];

export const MY_WALLPAPERS: MyWallpaper[] = [
  { id: 'w001', appliedTo: 'home', setAt: '2026-05-20T10:24:00+08:00' },
  { id: 'w006', appliedTo: 'none', setAt: '2026-05-15T20:11:00+08:00' },
  { id: 'w009', appliedTo: 'none', setAt: '2026-04-28T08:42:00+08:00' },
];

import { gradient2 } from '@/constants/gradients';
import { ACCENT } from '@/constants/accents';

/**
 * 无封面悬赏的兜底封面。
 *
 * 悬赏表有 cover 列,但历史数据(机器人早期发的)全是空串 —— 后端机器人现在会带封面、
 * 发布表单也支持上传了,存量那批补不回来(作品名对不上内容池)。直接留白的话,
 * 赏金广场一排卡片长得一模一样。
 *
 * 这里按「标题哈希 + 分类」画一张确定性 SVG:同一条悬赏永远得到同一张图,
 * 列表刷新 / 翻页 / 换布局都不会闪色。必须是确定性的 —— 用随机色会让无限滚动时
 * 已渲染的卡片突然换色。
 */

/** 分类配色,与 apis/dashboard.ts 的 CATEGORY_GRADIENT 保持一致(那边没导出) */
const CATEGORY_TINT: Record<string, string> = {
  video: gradient2('#25F4EE', '#5DF7F2'),
  image: gradient2('#FFB400', '#FFD566'),
  novel: gradient2('#8B5CF6', '#C4B5FD'),
  art: gradient2('#FE2C55', '#FF6B8A'),
  music: gradient2('#5DDB96', '#25F4EE'),
  film: gradient2(ACCENT.purple.main, '#FE2C55'),
  script: gradient2('#FE2C55', '#FFB400'),
  live: gradient2('#25F4EE', '#FFB400'),
  voice: gradient2('#EC4899', '#F9A8D4'),
};

/** FNV-1a,和 lib/content/fingerprint.ts 同一个算法,保证跨端一致 */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 从渐变串里抠出两个色标(`linear-gradient(135deg, #A 0%, #B 100%)`) */
function stopsOf(gradient: string): [string, string] {
  const found = gradient.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
  return [found[0] ?? '#FE2C55', found[1] ?? found[0] ?? '#8B5CF6'];
}

/** 按分类挑个能一眼认出的图形,画在封面上当"图标" */
const SHAPE_BY_CATEGORY: Record<string, string> = {
  // 播放三角
  video: '<path d="M300 150 L400 90 L400 210 Z" />',
  // 音符
  music: '<circle cx="320" cy="190" r="34"/><rect x="348" y="60" width="12" height="132"/>',
  // 书本(两页)
  novel: '<path d="M250 100 h90 v130 h-90 z M350 100 h90 v130 h-90 z" />',
  // 相框
  image: '<rect x="270" y="80" width="180" height="140" rx="10"/>',
  // 圆点花(画作)
  art: '<circle cx="300" cy="150" r="60"/><circle cx="390" cy="150" r="34"/>',
  // 场记板
  film: '<rect x="270" y="110" width="180" height="110" rx="8"/>',
  // 话筒
  voice: '<rect x="330" y="80" width="60" height="90" rx="30"/><path d="M310 170 h100" />',
  // 直播信号
  live: '<circle cx="360" cy="150" r="26"/><circle cx="360" cy="150" r="62" fill="none"/>',
};

const DEFAULT_SHAPE = '<circle cx="360" cy="150" r="70"/>';

/**
 * 生成一张 720×405(16:9)的 SVG data URI。
 * 标题取前 12 个字画在左下角,和卡片右上角的 ¥ 徽标、左上角分类角标互不遮挡。
 */
export function fallbackCoverDataUri(title: string, category?: string): string {
  const seed = `${category || ''}|${(title || '').trim()}`;
  const n = hash(seed);
  const cat = (category || 'video').toLowerCase();
  const [c1, c2] = stopsOf(CATEGORY_TINT[cat] ?? CATEGORY_TINT.video);

  // 光斑位置也用哈希定,让每张的层次不一样但同一条稳定
  const cx = 20 + (n % 60);
  const cy = 15 + ((n >> 8) % 50);
  const shape = SHAPE_BY_CATEGORY[cat] ?? DEFAULT_SHAPE;
  const label = (title || '').trim().slice(0, 12);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="405" viewBox="0 0 720 405"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient><radialGradient id="s" cx="${cx}%" cy="${cy}%" r="55%"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.28"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs><rect width="720" height="405" fill="url(#g)"/><rect width="720" height="405" fill="url(#s)"/><g fill="#ffffff" fill-opacity="0.16" stroke="#ffffff" stroke-opacity="0.22" stroke-width="3">${shape}</g><rect y="285" width="720" height="120" fill="#000000" fill-opacity="0.22"/><text x="36" y="352" fill="#ffffff" fill-opacity="0.95" font-size="34" font-family="sans-serif" font-weight="600">${escapeXml(label)}</text></svg>`;

  // 整串 encodeURIComponent:空格/换行/#/" 全部转义。
  // 不能只换 # —— SVG 里的裸空格和换行会让 CSS 的 url("...") 直接失效
  // (字符串里不允许出现未转义的换行),封面就整块不显示。
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** 标题里可能有 & < > 之类,直接塞进 SVG 会破坏文档 */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

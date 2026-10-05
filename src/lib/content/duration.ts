/**
 * 列表卡片的时长(秒)。
 *
 * 优先用接口直接给的 durationSec / duration;否则读 metadata.duration —— 爬虫写进去的
 * 是秒数(线上音乐约 200 万条、视频 3000 多条有这个字段)。
 *
 * 以前是拿正则在 content 正文里找 "mm:ss":线上命中的全是正文里的钟点(资讯的
 * "2026/9/10 20:38:27"、综艺的"每周四中午12:00更新"),卡片角标显示的是假时长;
 * 而且列表接口现在只带正文前 300 字,不再靠正文。
 *
 * 列表里的 metadata 是裁过的,只剩白名单键(Go repository.ListMetadataKeys);duration /
 * duration_ms 在白名单里,删之前先看这里。
 */
export function listItemDurationSec(item: { durationSec?: unknown; duration?: unknown; metadata?: unknown }): number {
  const direct = Number(item.durationSec || item.duration || 0);
  if (Number.isFinite(direct) && direct > 0) return Math.round(direct);
  const raw = item.metadata;
  if (!raw) return 0;
  let meta: unknown = raw;
  if (typeof raw === 'string') {
    try {
      meta = JSON.parse(raw);
    } catch {
      return 0;
    }
  }
  const d = Number((meta as { duration?: unknown } | null)?.duration);
  return Number.isFinite(d) && d > 0 ? Math.round(d) : 0;
}

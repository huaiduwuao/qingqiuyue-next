'use client';

import { useQuery } from '@tanstack/react-query';

/** 分集/章节(module_content_item)。id 是字符串:雪花 id 超过 JS 安全整数。 */
export interface ContentItem {
  id: string;
  title: string;
  sort?: number;
  url?: string;
  link?: string;
  /** 后端回填的直链(hls/mp4);空则对 url 实时解析 */
  playUrl?: string;
  cover?: string;
  /** 漫画:这一话的分页图片(JSON 数组字符串);小说:正文(lite 模式下不给) */
  content?: string;
  minioKey?: string;
  type?: string;
  /** 付费内容未解锁、超出免费试看范围的条目:没有正文和播放地址 */
  locked?: boolean;
}

/**
 * 分集/章节的展示标题。源站没有分集名时 title 只是序号("1"、"第1集"),
 * 和界面上的"第N集"重复,当作没有标题。index 从 0 开始。
 */
export function episodeTitle(item: Pick<ContentItem, 'title'>, index: number): string {
  const t = (item.title || '').trim();
  if (!t || t === String(index + 1) || /^第?\s*\d+\s*[集话期章]?$/.test(t)) return '';
  return t;
}

export interface ContentItemsResult {
  items: ContentItem[];
  total: number;
  /** 后端正在从源站补齐分集/章节,稍后重查 */
  backfilling: boolean;
}

type ItemPageFetcher = (params: Record<string, unknown>) => Promise<unknown>;

interface ItemPage {
  list?: ContentItem[];
  records?: ContentItem[];
  total?: number;
  backfilling?: boolean;
}

const PAGE_SIZE = 500;
const MAX_PAGES = 6;
const BACKFILL_POLL_MS = 4000;
const BACKFILL_MAX_POLLS = 8;

export interface UseContentItemsOpts {
  lite?: boolean;
  /**
   * 目标章节 id:拉到含它的页就提前 break,避免长篇(几千章)首次进入详情时
   * 一次拉全本目录。只用于"按窗口拉",全本目录由调用方在抽屉打开时
   * 调用 {@link fetchContentItemsAll} 异步补全。
   */
  untilChapterId?: string;
}

/** 与 hook 内部一致的 queryKey,让调用方拿到同一 key 写 setQueryData 回滚。 */
export function contentItemsQueryKey(
  kind: string,
  contentId: string | null | undefined,
  opts: UseContentItemsOpts = {},
): readonly unknown[] {
  const lite = !!opts.lite;
  return ['detail', kind, contentId, 'items', lite ? 'lite' : 'full', opts.untilChapterId ?? 'all'] as const;
}

/**
 * 把一页请求抽象出来。`page` 从 1 开始,与后端 Page 接口一致。
 * 返回值合并到 {@link ContentItemsResult};遇到 `untilChapterId` 时也会提前停。
 */
async function fetchPages(
  fetchPage: ItemPageFetcher,
  contentId: string,
  opts: UseContentItemsOpts,
): Promise<ContentItemsResult> {
  const lite = !!opts.lite;
  const until = opts.untilChapterId ? String(opts.untilChapterId) : '';
  const items: ContentItem[] = [];
  let total = 0;
  let backfilling = false;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = (await fetchPage({
      moduleContentId: String(contentId),
      page,
      page_size: PAGE_SIZE,
      ...(lite ? { lite: 1 } : {}),
    })) as ItemPage | undefined;
    const data = res ?? {};
    const list = data.list ?? data.records ?? [];
    items.push(...list);
    total = Number(data.total ?? items.length);
    backfilling = Boolean(data.backfilling);
    // 拉到目标章节就停 —— 长篇小说初次进入只取"起点附近"
    if (until && list.some((c) => ContentItemId(c) === until)) break;
    if (list.length < PAGE_SIZE || items.length >= total) break;
  }
  return {
    items: items.map((it) => ({ ...it, id: ContentItemId(it) })),
    total,
    backfilling,
  };
}

function ContentItemId(it: { id?: unknown }): string {
  return String((it as { id: unknown }).id);
}

/**
 * 把全本目录翻完 —— 抽屉打开时调用,把当前 key 缓存补齐。
 * 与 hook 内部行为一致(同样最多 MAX_PAGES 页、忽略 untilChapterId)。
 */
export async function fetchContentItemsAll(
  fetchPage: ItemPageFetcher,
  contentId: string,
  opts: Omit<UseContentItemsOpts, 'untilChapterId'> = {},
): Promise<ContentItemsResult> {
  return fetchPages(fetchPage, contentId, opts);
}

/**
 * 某内容的分集/章节列表(*-item/page、novel-chapter/page)。
 *
 * - 一页 500 条,超过时顺序拉后续页,最多 3000 条;
 * - 后端发现一条都没有时会回源补齐,没来得及补完的响应带 backfilling,这里每 4 秒重查,最多 8 次;
 * - lite 只要目录,不让后端逐章拉正文(长篇小说的目录用);
 * - 传 `untilChapterId` 时,只拉到含它的页就停 —— 长篇小说首次进入详情用。
 */
export function useContentItems(
  kind: string,
  contentId: string | null | undefined,
  fetchPage: ItemPageFetcher,
  opts: UseContentItemsOpts = {},
) {
  const lite = !!opts.lite;
  const untilChapterId = opts.untilChapterId;
  return useQuery({
    queryKey: contentItemsQueryKey(kind, contentId, { lite, untilChapterId }),
    enabled: !!contentId,
    queryFn: () => fetchPages(fetchPage, String(contentId), { lite, untilChapterId }),
    refetchInterval: (query) =>
      query.state.data?.backfilling && query.state.dataUpdateCount <= BACKFILL_MAX_POLLS ? BACKFILL_POLL_MS : false,
  });
}

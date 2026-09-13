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

/**
 * 某内容的分集/章节列表(*-item/page、novel-chapter/page)。
 *
 * - 一页 500 条,超过时顺序拉后续页,最多 3000 条;
 * - 后端发现一条都没有时会回源补齐,没来得及补完的响应带 backfilling,这里每 4 秒重查,最多 8 次;
 * - lite 只要目录,不让后端逐章拉正文(长篇小说的目录用)。
 */
export function useContentItems(
  kind: string,
  contentId: string | null | undefined,
  fetchPage: ItemPageFetcher,
  opts: { lite?: boolean } = {},
) {
  const lite = !!opts.lite;
  return useQuery({
    queryKey: ['detail', kind, contentId, 'items', lite ? 'lite' : 'full'],
    enabled: !!contentId,
    queryFn: async (): Promise<ContentItemsResult> => {
      const items: ContentItem[] = [];
      let total = 0;
      let backfilling = false;
      for (let page = 1; page <= MAX_PAGES; page++) {
        const res = (await fetchPage({
          moduleContentId: String(contentId),
          page,
          page_size: PAGE_SIZE,
          ...(lite ? { lite: 1 } : {}),
        })) as { data?: ItemPage } | undefined;
        const data = res?.data ?? {};
        const list = data.list ?? data.records ?? [];
        items.push(...list);
        total = Number(data.total ?? items.length);
        backfilling = Boolean(data.backfilling);
        if (list.length < PAGE_SIZE || items.length >= total) break;
      }
      return { items: items.map((it) => ({ ...it, id: String(it.id) })), total, backfilling };
    },
    refetchInterval: (query) =>
      query.state.data?.backfilling && query.state.dataUpdateCount <= BACKFILL_MAX_POLLS ? BACKFILL_POLL_MS : false,
  });
}

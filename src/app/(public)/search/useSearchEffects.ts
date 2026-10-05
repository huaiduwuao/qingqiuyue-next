'use client';

import { useEffect, useState } from 'react';
import { trackSearchImpression, subscribeSearchStream } from '@/lib/track';
import { suggestCreators, suggestTopics } from '@/apis/search';
import { formatApiError } from '@/lib/api/client';
import { SEARCH_STREAM_REFETCH_GAP, toCreatorItems, toTopicItems, type SearchCreatorItem, type SearchTopicItem } from './searchModel';

/** 联想:创作者(suggestCreators) + 话题(suggestTopics),并行请求各自后端接口合并。AI 模式下不查。 */
export function useSearchSuggest(query: string, aiMode: boolean) {
  const [creators, setCreators] = useState<SearchCreatorItem[]>([]);
  const [topics, setTopics] = useState<SearchTopicItem[]>([]);

  useEffect(() => {
    const kw = query.trim();
    if (!kw || aiMode) {
      setCreators([]);
      setTopics([]);
      return;
    }
    let cancelled = false;

    Promise.all([suggestCreators(kw), suggestTopics(kw)])
      .then(([creatorList, topicList]) => {
        if (cancelled) return;
        setCreators(toCreatorItems(creatorList));
        setTopics(toTopicItems(topicList));
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('load suggest failed', formatApiError(err));
        setCreators([]);
        setTopics([]);
      });

    return () => {
      cancelled = true;
    };
  }, [query, aiMode]);
  return { creators, topics };
}

/**
 * §6.3 SSE 订阅 discover:events:<kw>,命中时 refetch + 增量合并。
 * 失败时 onError 关连接,降级到老的轮询(refetchInterval 接管)。
 */
export function useSearchStreamRefetch(query: string, aiMode: boolean, refetch: () => unknown) {
  useEffect(() => {
    const k = query.trim();
    if (!k || aiMode) return;
    // 全网检索一轮会连着推几十条 indexed:每条都整页重搜 + 重渲染整个结果列表,页面会卡。
    // 合并成最多每 SEARCH_STREAM_REFETCH_GAP 一次(尾部触发,最后一批不会丢)。
    let timer: ReturnType<typeof setTimeout> | null = null;
    let last = 0;
    const refetchSoon = () => {
      if (timer) return;
      const wait = Math.max(0, last + SEARCH_STREAM_REFETCH_GAP - Date.now());
      timer = setTimeout(() => {
        timer = null;
        last = Date.now();
        void refetch();
      }, wait);
    };
    const unsubscribe = subscribeSearchStream(
      k,
      (hit) => {
        if (hit.type === 'indexed' || hit.type === 'done') {
          // 命中 / 本轮结束:合并后 refetch 一次,新条目自然进入结果。
          refetchSoon();
        }
      },
      () => {
        /* §15.5 SSE 失败 — 不上报(降级到轮询是正常路径,不是错误);
           真正的异常由 fetch catch 处经 safeErrorLog 上报 */
      },
    );
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, aiMode]);
}

/** §7.2 IntersectionObserver:内容卡片(data-cid)可见 50% + 停留 200ms 触发 impression。 */
export function useSearchImpressions(query: string) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const k = query.trim();
    if (!k) return;
    const seen = new Set<string>();
    // 已交给 observer 的卡片:扫描时只挂新出现的,不再每 1.5 秒把所有卡片重挂一遍。
    const observed = new WeakSet<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.5) {
            const id = (e.target as HTMLElement).dataset['cid'];
            if (id && !seen.has(id)) {
              seen.add(id);
              const pos = Number((e.target as HTMLElement).dataset['pos'] ?? 0);
              trackSearchImpression(k, id, pos);
            }
          }
        }
      },
      { threshold: 0.5 },
    );
    const scan = () => {
      document.querySelectorAll('[data-cid]').forEach((el) => {
        if (observed.has(el)) return;
        if (!seen.has((el as HTMLElement).dataset['cid'] || '')) {
          observed.add(el);
          observer.observe(el);
        }
      });
    };
    // 只在 DOM 有变化(结果渲染 / 翻页追加)时扫描,同一帧内的多次变化合并成一次;
    // 之前是常驻 setInterval,页面开多久就每 1.5 秒全文档 querySelectorAll 多久。
    let raf = 0;
    const mo = new MutationObserver(() => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        scan();
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    scan();
    return () => {
      mo.disconnect();
      if (raf) cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [query])
}

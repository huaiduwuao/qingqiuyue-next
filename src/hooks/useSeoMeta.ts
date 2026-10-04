'use client';

import { useEffect } from 'react';

/**
 * 详情页拿到数据后改写 <title> / description / canonical。
 *
 * 站点是静态导出,每个 HTML 的 <head> 都是同一份「清秋月」;会跑 JS 的搜索引擎(谷歌)和分享卡片
 * 以运行后的 DOM 为准,这里把它们改成这条内容自己的。canonical 指向服务端直出页 /w/<id>
 * (qingqiuyue-go internal/seo),不跑 JS 的爬虫由前端 nginx 直接转去那里。
 */
export function useSeoMeta(opts: { id?: string | number | null; title?: string; description?: string }) {
  const { id, title, description } = opts;
  useEffect(() => {
    if (typeof document === 'undefined' || !title) return;
    const prevTitle = document.title;
    document.title = `${title} - 清秋月`;
    const setMeta = (name: string, content: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.name = name;
        document.head.appendChild(el);
      }
      const prev = el.content;
      el.content = content;
      return () => {
        el!.content = prev;
      };
    };
    const undoDesc = description ? setMeta('description', description.slice(0, 150)) : undefined;
    let canonical: HTMLLinkElement | null = null;
    if (id) {
      canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.appendChild(canonical);
      }
      canonical.href = `${window.location.origin}/w/${id}`;
    }
    return () => {
      document.title = prevTitle;
      undoDesc?.();
      if (canonical) canonical.remove();
    };
  }, [id, title, description]);
}

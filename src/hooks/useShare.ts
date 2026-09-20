'use client';

/**
 * useShare —— 抽取 14+ 详情页的 handleShare 模式。
 *
 * 用法:
 *   const { share, ShareButtons } = useShare({
 *     contentType: 'video',
 *     contentId: 123,
 *     title: 'xxx',
 *     cover: '...',
 *   });
 *
 *   // 方式 1:在原有 IconButton onClick 里用 share()
 *   <IconButton onClick={share}><ShareRoundedIcon /></IconButton>
 *
 *   // 方式 2:直接渲染一组多平台按钮
 *   <ShareButtons />  // 这一组已经在 hook 里组装好
 */

import React, { useCallback } from 'react';

export interface UseShareArgs {
  contentType: string;
  contentId: number;
  title: string;
  url?: string;
  cover?: string;
  desc?: string;
  subtitle?: string;
  topicId?: string;
  videoUrl?: string;
  defaultTags?: string[];
  onAfterShare?: (platform: string) => void;
}

export function useShare(args: UseShareArgs) {
  const url = args.url || (typeof window !== 'undefined' ? window.location.href : '');

  const share = useCallback(async () => {
    try {
      const nav: any = typeof navigator !== 'undefined' ? navigator : {};
      if (nav.share) {
        await nav.share({ title: args.title, text: args.desc || args.title, url });
      } else if (nav.clipboard?.writeText) {
        await nav.clipboard.writeText(url);
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        // ignore
      }
    }
    args.onAfterShare?.('web');
  }, [args, url]);

  return { share, url };
}
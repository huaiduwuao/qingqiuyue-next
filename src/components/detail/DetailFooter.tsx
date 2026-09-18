'use client';

import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { Paywall } from '@/apis/paywall';
import { PaywallGate } from './PaywallGate';
import { TipButton } from './TipButton';
import { GiftButton } from './GiftButton';
import { RelatedContent } from './RelatedContent';

/** 详情接口里本组件用到的字段(各类型详情共有)。 */
export interface DetailFooterData {
  contentType?: string;
  category?: string;
  authorId?: number | string;
  userId?: number | string;
  author?: string;
  paywall?: Paywall | null;
}

interface DetailFooterProps {
  contentId: string | number;
  /**
   * 详情接口返回的原始数据。各页面对它有各自的类型(Film / Video / ...),
   * 这里只读取 DetailFooterData 里的公共字段,所以接受任意对象。
   */
  detail?: object | null;
  /** 文字类(小说/文章/新闻/漫画/图文)为 read,音视频类为 watch,影响付费卡片文案。 */
  kind?: 'read' | 'watch';
}

/**
 * 所有详情页共用的正文之后区域:付费解锁 → 打赏创作者 → 相关推荐。
 *
 * 解锁成功后让所有 ['detail', ...] 查询失效重拉 —— 全文由服务端在解锁后才下发。
 */
export function DetailFooter({ contentId, detail: raw, kind = 'read' }: DetailFooterProps) {
  const queryClient = useQueryClient();
  if (!contentId) return null;

  const detail = (raw ?? {}) as DetailFooterData;
  const creatorId = detail.authorId ?? detail.userId;
  const contentType = detail.contentType ?? detail.category;

  return (
    <Box sx={{ mt: 2 }}>
      <PaywallGate
        contentId={contentId}
        paywall={detail?.paywall}
        kind={kind}
        onUnlocked={() => queryClient.invalidateQueries({ queryKey: ['detail'] })}
      />
      {Number(creatorId) > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, my: 3 }}>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>喜欢这个作品?</Typography>
          <TipButton creatorId={creatorId} contentId={contentId} creatorName={detail?.author} />
          <GiftButton creatorId={creatorId} contentId={contentId} creatorName={detail?.author} />
        </Box>
      )}
      <RelatedContent contentId={contentId} contentType={contentType} />
    </Box>
  );
}

export default DetailFooter;

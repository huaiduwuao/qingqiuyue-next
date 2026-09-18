'use client';

/**
 * 私信里的富内容卡片(消息 type=card)。
 *
 * content 是服务端写死的 JSON 快照(msgapp.ShareCard):作品之后被下架、任务被删,
 * 历史消息里这张卡还是读得懂的,只是点进去会落到一个「内容不存在」的详情页 ——
 * 这比把标题也一起丢掉要好。
 */

import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import { getDetailRoute } from '@/lib/contentRoute';
import type { ShareCard } from '@/apis/msg';

const KIND_LABEL: Record<string, string> = {
  work: '作品',
  bounty: '悬赏任务',
  demand: '悬赏需求',
  activity: '活动',
  playlist: '歌单',
  user: '名片',
};

/** 卡片点开去哪:作品按 contentType 拼详情页,其余用服务端给的 href。 */
export function cardHref(card: ShareCard): string | null {
  if (card.kind === 'work' && card.contentType) return getDetailRoute(card.contentType, card.id);
  return card.href || null;
}

export function parseShareCard(content: string): ShareCard | null {
  try {
    const c = JSON.parse(content) as ShareCard;
    return c && c.kind ? c : null;
  } catch {
    return null;
  }
}

export default function ShareCardBubble({ content }: { content: string }) {
  const card = parseShareCard(content);
  if (!card) {
    return <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>[分享]</Typography>;
  }
  const href = cardHref(card);
  const label = KIND_LABEL[card.kind] || '分享';
  const round = card.kind === 'user';

  return (
    <Box
      sx={{
        width: 280,
        maxWidth: '100%',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ px: 1.5, py: 0.75, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main' }} />
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
          {label}
          {card.badge && card.badge !== label ? ` · ${card.badge}` : ''}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.25, px: 1.5, py: 1.25 }}>
        <Box
          sx={{
            width: 52,
            height: round ? 52 : 68,
            flexShrink: 0,
            borderRadius: round ? '50%' : 1,
            bgcolor: 'action.selected',
            backgroundImage: card.cover ? `url("${card.cover}")` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {!card.cover && <ImageOutlinedIcon sx={{ fontSize: 20, color: 'text.disabled' }} />}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            sx={{
              fontSize: 13,
              fontWeight: 600,
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {card.title}
          </Typography>
          {card.subtitle && (
            <Typography noWrap sx={{ fontSize: 11, color: 'text.secondary', mt: 0.25 }}>
              {card.subtitle}
            </Typography>
          )}
          {card.meta && (
            <Typography sx={{ fontSize: 11, color: 'text.disabled', mt: 0.25 }}>{card.meta}</Typography>
          )}
        </Box>
      </Box>

      {card.note && (
        <Typography
          sx={{
            fontSize: 12,
            color: 'text.secondary',
            px: 1.5,
            pb: 1,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {card.note}
        </Typography>
      )}

      <Box sx={{ px: 1.5, pb: 1.25 }}>
        <Button
          size="small"
          variant="outlined"
          fullWidth
          href={href ?? undefined}
          disabled={!href}
          sx={{ textTransform: 'none', fontSize: 12 }}
        >
          {href ? '打开看看' : '内容已不可用'}
        </Button>
      </Box>
    </Box>
  );
}

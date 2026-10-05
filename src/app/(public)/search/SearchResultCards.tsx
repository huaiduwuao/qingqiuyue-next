'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import VerifiedIcon from '@mui/icons-material/Verified';
import { ACCENT } from '@/constants/accents';
import { CoverImage } from '@/components/common/CoverImage';
import { PlayTag } from '@/components/common/PlayTag';
import { ListLayout } from '@/components/common/ListLayout';
import {
  REASON_HINT,
  TYPE_ACCENT,
  TYPE_LABEL,
  formatNumber,
  type SearchContentItem,
  type SearchCreatorItem,
  type SearchTopicItem,
} from './searchModel';

export function Section({
  title,
  count,
  visible,
  onMore,
  moreLabel,
  children,
}: {
  title: string;
  count: number;
  /** 实际渲染出来的条数(全部 tab 里被截断时小于 count) */
  visible?: number;
  /** 还有更多时,点击切到对应子 tab */
  onMore?: () => void;
  moreLabel?: string;
  children: React.ReactNode;
}) {
  const hidden = visible != null ? Math.max(0, count - visible) : 0;
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--text-muted, rgba(255,255,255,0.55))',
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          {title}
        </Typography>
        <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'var(--text-muted, rgba(255,255,255,0.3))' }} />
        <Typography sx={{ fontSize: 11, color: 'var(--text-disabled, rgba(255,255,255,0.35))' }}>{count} 条</Typography>
        {hidden > 0 && onMore && (
          <Box sx={{ flex: 1 }} />
        )}
        {hidden > 0 && onMore && (
          <Box
            component="button"
            type="button"
            onClick={onMore}
            sx={{
              ml: 'auto',
              border: 0,
              bgcolor: 'transparent',
              cursor: 'pointer',
              font: 'inherit',
              fontSize: 11.5,
              fontWeight: 600,
              color: 'primary.main',
              px: 0.5,
              py: 0.25,
              borderRadius: 1,
              '&:hover': { bgcolor: 'var(--bg-hover, rgba(255,255,255,0.06))' },
            }}
          >
            还有 {hidden} 条 · {moreLabel ?? '查看全部'} ›
          </Box>
        )}
      </Box>
      <ListLayout rows minColumnWidth={440} gap={8}>{children}</ListLayout>
    </Box>
  );
}

// memo:SearchPageContent 有十几个 state(筛选、输入、联想…),任何一个变都会重渲染整列结果
export const ContentResult = React.memo(function ContentResult({
  item,
  onClick,
  renderHL,
  positionForImpression = 0,
}: {
  item: SearchContentItem;
  onClick: (item: SearchContentItem, position: number) => void;
  renderHL: (text: string) => React.ReactNode;
  positionForImpression?: number;
}) {
  // 没有封面图时,用类型色做渐变兜底(永远不至于一片黑)。
  const fallbackBg = `linear-gradient(135deg, ${TYPE_ACCENT[item.contentType]} 0%, rgba(20,20,30,0.85) 100%)`;
  const scorePct = typeof item.score === 'number' ? Math.round(item.score * 100) : null;
  // 章节进度:有 readyItems/totalItems 时显示 "12/345 章" 之类,小说/剧集用户最关心。
  const chapterLabel =
    item.readyItems != null && item.totalItems != null && item.totalItems > 0
      ? `${item.readyItems}/${item.totalItems} 章`
      : null;
  return (
    <Box
      data-cid={item.id}
      data-pos={positionForImpression}
      onClick={() => onClick(item, positionForImpression)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 1.25,
        borderRadius: 2,
        cursor: 'pointer',
        transition: 'all 0.15s',
        // 宽屏多列时每条自成卡片
        border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
        '&:hover': { bgcolor: 'var(--bg-hover, rgba(255,255,255,0.04))', borderColor: 'var(--border-strong, rgba(255,255,255,0.12))' },
      }}
    >
      {/* 封面:有图走 CoverImage(过 mediaUrl 处理 MinIO/外站),没图走类型渐变兜底。
          这样"求魔"这种小说搜出来立刻能看到真实封面,而不是色块。 */}
      <Box
        sx={{
          position: 'relative',
          width: 72,
          height: 96,
          flexShrink: 0,
          borderRadius: 1.5,
          overflow: 'hidden',
          background: fallbackBg,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}
      >
        {item.cover ? (
          <CoverImage
            src={item.cover}
            alt={item.title}
            sx={{ width: '100%', height: '100%' }}
          />
        ) : (
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.18), transparent 50%)',
            }}
          />
        )}
        {/* 左上:类型徽标 */}
        <Box
          sx={{
            position: 'absolute',
            top: 4,
            left: 4,
            px: 0.5,
            py: 0.15,
            borderRadius: 0.5,
            bgcolor: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(4px)',
            color: '#fff',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 0.3,
          }}
        >
          {TYPE_LABEL[item.contentType]}
        </Box>
        {/* 右下:章节进度(有数据时显示),小说/剧集最有用的"这部收了多少"提示 */}
        {chapterLabel && (
          <Box
            sx={{
              position: 'absolute',
              right: 4,
              bottom: 4,
              px: 0.5,
              py: 0.1,
              borderRadius: 0.5,
              bgcolor: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(4px)',
              color: '#fff',
              fontSize: 9,
              fontWeight: 600,
              fontFamily: 'monospace',
              lineHeight: 1.2,
            }}
          >
            {chapterLabel}
          </Box>
        )}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* 标题 + 命中位置行内标签 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text-primary, #fff)',
              lineHeight: 1.4,
              flex: 1,
              minWidth: 0,
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {renderHL(item.title)}
          </Typography>
          <Box
            sx={{
              flexShrink: 0,
              px: 0.75,
              py: 0.2,
              borderRadius: 0.75,
              bgcolor: `${TYPE_ACCENT[item.contentType]}1A`,
              color: TYPE_ACCENT[item.contentType],
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            {item.matchField === 'title' ? '标题命中' : item.matchField === 'author' ? '作者命中' : '描述命中'}
          </Box>
        </Box>
        {item.subtitle && (
          <Typography
            sx={{
              fontSize: 12,
              color: 'var(--text-muted, rgba(255,255,255,0.55))',
              lineHeight: 1.5,
              mt: 0.25,
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {renderHL(item.subtitle)}
          </Typography>
        )}
        {/* 元信息行:作者 · 相关度 · 可用性徽标。原来的伪造 views/comments/likes 全删了,
            /search 接口本就不返回这些,留着只会显示 "undefined"。 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'var(--text-muted, rgba(255,255,255,0.55))' }}>
            <Box
              sx={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${TYPE_ACCENT[item.contentType]}, rgba(20,20,30,0.85))`,
                fontSize: 9,
                fontWeight: 700,
                color: 'var(--text-primary, #fff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {item.author[0]}
            </Box>
            <Typography sx={{ fontSize: 11 }}>{renderHL(item.author)}</Typography>
          </Box>
          {scorePct != null && (
            <>
              <Box sx={{ width: 2, height: 2, borderRadius: '50%', bgcolor: 'var(--text-disabled, rgba(255,255,255,0.25))' }} />
              <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.55))' }}>
                相关度 {scorePct}%
              </Typography>
            </>
          )}
          {/* 能不能播 / 能不能读:搜索结果自带 availability(playability 状态),直接给 PlayTag,不再发请求 */}
          <PlayTag id={item.id} contentType={item.contentType} status={item.availability} variant="inline" />
          {(item.mergedCount ?? 0) > 1 && (
            <>
              <Box sx={{ width: 2, height: 2, borderRadius: '50%', bgcolor: 'var(--text-disabled, rgba(255,255,255,0.25))' }} />
              <Tooltip
                arrow
                placement="top"
                title={`同一部作品在 ${item.mergedCount} 个数据源各有一条收录,已合并显示${
                  item.usable ? ',这里打开的是能看的那条' : ''
                }:${[...new Set((item.variants || []).map((v) => v.sourceLabel?.replace(/\s*\[.*?\]/g, '') || ''))].filter(Boolean).join('、')}`}
              >
                <Typography component="span" sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.55))', cursor: 'help' }}>
                  已合并 {item.mergedCount} 个来源
                </Typography>
              </Tooltip>
            </>
          )}
          {item.reason && REASON_HINT[item.reason] && (
            <>
              <Box sx={{ width: 2, height: 2, borderRadius: '50%', bgcolor: 'var(--text-disabled, rgba(255,255,255,0.25))' }} />
              <Tooltip title={`为什么出现:${REASON_HINT[item.reason]}`} arrow placement="top">
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    px: 0.6,
                    py: 0.15,
                    borderRadius: 0.5,
                    bgcolor: 'var(--bg-hover, rgba(255,255,255,0.06))',
                    color: 'var(--text-muted, rgba(255,255,255,0.55))',
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: 'help',
                  }}
                >
                  {REASON_HINT[item.reason]}
                </Box>
              </Tooltip>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
});

export const CreatorResult = React.memo(function CreatorResult({
  item,
  renderHL,
  onFollow,
  following,
}: {
  item: SearchCreatorItem;
  renderHL: (text: string) => React.ReactNode;
  onFollow: (item: SearchCreatorItem) => void;
  following?: boolean;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 1.5,
        borderRadius: 2,
        cursor: 'pointer',
        transition: 'all 0.15s',
        // 宽屏多列时每条自成卡片
        border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
        '&:hover': { bgcolor: 'var(--bg-hover, rgba(255,255,255,0.04))', borderColor: 'var(--border-strong, rgba(255,255,255,0.12))' },
      }}
    >
      <Box
        sx={{
          width: 52,
          height: 52,
          flexShrink: 0,
          borderRadius: '50%',
          background: item.avatarGradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          fontWeight: 800,
          color: 'var(--text-primary, #fff)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}
      >
        {item.name[0]}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>
            {renderHL(item.name)}
          </Typography>
          {item.verified && <VerifiedIcon sx={{ fontSize: 14, color: 'primary.main' }} />}
        </Box>
        <Typography
          sx={{
            fontSize: 11,
            color: 'var(--text-muted, rgba(255,255,255,0.55))',
            mt: 0.25,
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {renderHL(item.bio)}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
          {item.tags.slice(0, 3).map((t) => (
            <Box
              key={t}
              sx={{
                px: 0.5,
                py: 0.1,
                borderRadius: 0.5,
                bgcolor: 'rgba(139, 92, 246, 0.15)',
                color: ACCENT.purple.main,
                fontSize: 9,
                fontWeight: 600,
              }}
            >
              {t}
            </Box>
          ))}
        </Box>
      </Box>
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #fff)' }}>
          {formatNumber(item.followers)}
        </Typography>
        <Typography sx={{ fontSize: 10, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>粉丝</Typography>
      </Box>
      <Button
        size="small"
        variant="contained"
        disableElevation
        disabled={following}
        onClick={() => onFollow(item)}
        sx={{
          minWidth: 56,
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'none',
          borderRadius: 1.5,
          py: 0.5,
          px: 1.5,
          background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
          '&:hover': { filter: 'brightness(1.1)' },
        }}
      >
        + 关注
      </Button>
    </Box>
  );
});

export const TopicResult = React.memo(function TopicResult({
  item,
  renderHL,
  onClick,
}: {
  item: SearchTopicItem;
  renderHL: (text: string) => React.ReactNode;
  onClick: (item: SearchTopicItem) => void;
}) {
  return (
    <Box
      onClick={() => onClick(item)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 1.5,
        borderRadius: 2,
        cursor: 'pointer',
        transition: 'all 0.15s',
        // 宽屏多列时每条自成卡片
        border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
        '&:hover': { bgcolor: 'var(--bg-hover, rgba(255,255,255,0.04))', borderColor: 'var(--border-strong, rgba(255,255,255,0.12))' },
      }}
    >
      <Box
        sx={{
          width: 56,
          height: 56,
          flexShrink: 0,
          borderRadius: 1.5,
          background: item.gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-primary, #fff)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.2), transparent 50%)',
          }}
        />
        <Typography
          sx={{ fontSize: 24, fontWeight: 800, position: 'relative', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}
        >
          #
        </Typography>
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>
            {renderHL(item.title)}
          </Typography>
          {item.hot && (
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.25,
                px: 0.5,
                py: 0.1,
                borderRadius: 0.5,
                background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
                color: 'var(--text-primary, #fff)',
                fontSize: 9,
                fontWeight: 700,
              }}
            >
              <TrendingUpIcon sx={{ fontSize: 9 }} />
              热门
            </Box>
          )}
        </Box>
        <Typography
          sx={{
            fontSize: 11,
            color: 'var(--text-muted, rgba(255,255,255,0.55))',
            mt: 0.25,
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {renderHL(item.description)}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5, color: 'var(--text-muted, rgba(255,255,255,0.45))' }}>
          <Typography sx={{ fontSize: 10 }}>{formatNumber(item.viewCount)} 浏览</Typography>
          <Box sx={{ width: 2, height: 2, borderRadius: '50%', bgcolor: 'var(--text-disabled, rgba(255,255,255,0.25))' }} />
          <Typography sx={{ fontSize: 10 }}>{formatNumber(item.discussCount)} 讨论</Typography>
        </Box>
      </Box>
    </Box>
  );
});

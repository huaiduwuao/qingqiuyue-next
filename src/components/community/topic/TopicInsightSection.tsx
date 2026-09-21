'use client';

// TopicInsightSection —— 专题的结构化洞察板块(通用)。
//
// 一个专题可挂多个 insight,按 kind 经 INSIGHT_RENDERERS 注册表分发:
//   - lineups        → 热门阵容卡片网格(类似 Mobalytics 阵容页)
//   - versionHistory → 版本竖向时间线(沿用 PoetTimeline 的视觉语言)
//   - narrativeWorld → 叙事世界观(展现形式模板,复用 versions 数据,纵向叙事流)
//   - cardArchive    → 卡片档案集(展现形式模板,复用 lineups 数据,密集档案卡)
//
// 后两个是「展现形式模板」的替换形态:勾选模板后由后端 Resolve 以新 kind 产出,
// 顶替对应的默认板块(同一份数据换一种呈现,不重复渲染)。
//
// 渲染约定:任一板块为空(后端返回 0 条)→ 整个 insight 不渲染,等同 "没有就不显示"。
// 这样非 TFT 专题(insights:[])在前台 topic-detail 完全不引入额外视觉噪音。

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import WhatshotRoundedIcon from '@mui/icons-material/WhatshotRounded';
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import type { TopicInsight, TopicInsightLineup, TopicInsightVersion } from '@/apis/community';
import { CoverImage } from '@/components/common/CoverImage';
import { ListLayout, LIST_ROW } from '@/components/common/ListLayout';
import { NarrativeWorldView } from './NarrativeWorldView';
import { CardArchiveView } from './CardArchiveView';

interface Props {
  insight: TopicInsight;
}

type Renderer = (insight: TopicInsight) => React.ReactNode;

// INSIGHT_RENDERERS:insight.kind → 渲染器。新增展现形式模板时在此登记一行即可。
const INSIGHT_RENDERERS: Record<string, Renderer> = {
  lineups: (ins) => <LineupsView insight={ins} />,
  versionHistory: (ins) => <VersionHistoryView insight={ins} />,
  narrativeWorld: (ins) => <NarrativeWorldView insight={ins} />,
  cardArchive: (ins) => <CardArchiveView insight={ins} />,
};

export function TopicInsightSection({ insight }: Props) {
  const render = INSIGHT_RENDERERS[insight.kind];
  if (!render) return null;
  return <>{render(insight)}</>;
}

function LineupsView({ insight }: Props) {
  const items = insight.lineups ?? [];
  if (items.length === 0) return null;
  return (
    <Box sx={{ mt: 3 }}>
      <SectionHeader icon={<WhatshotRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />} title={insight.title} hint={insight.hint} count={items.length} />
      <LineupGrid items={items} />
    </Box>
  );
}

function VersionHistoryView({ insight }: Props) {
  const items = insight.versions ?? [];
  if (items.length === 0) return null;
  return (
    <Box sx={{ mt: 3 }}>
      <SectionHeader icon={<HistoryEduIcon sx={{ fontSize: 16, color: 'text.secondary' }} />} title={insight.title} hint={insight.hint} count={items.length} />
      <VersionTimeline items={items} />
    </Box>
  );
}

export function SectionHeader({ icon, title, hint, count }: { icon: React.ReactNode; title: string; hint?: string; count?: number }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.25, flexWrap: 'wrap' }}>
      {icon}
      <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>{title}</Typography>
      {typeof count === 'number' && count > 0 && (
        <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>共 {count} 条</Typography>
      )}
      {hint && <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.45))' }}>{hint}</Typography>}
    </Box>
  );
}

// ─── LineupGrid ──────────────────────────────────────────────────────────

export function LineupGrid({ items }: { items: TopicInsightLineup[] }) {
  return (
    <ListLayout minColumnWidth={170} gap={12} listMaxWidth="none">
      {items.map((it) => (
        <LineupCard key={String(it.id ?? it.title)} item={it} />
      ))}
    </ListLayout>
  );
}

function LineupCard({ item }: { item: TopicInsightLineup }) {
  // 用 Box component="a" 包外链;Box 本身接 sx + polymorphic component,
  // 直接 <a sx={...}> 在严格 TS 下属性不识别。
  const isExternal = !!item.sourceUrl;
  const cardSx = {
    display: 'flex',
    alignItems: 'stretch',
    borderRadius: 2,
    overflow: 'hidden',
    bgcolor: 'var(--bg-card, rgba(20,22,32,0.6))',
    border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'transform .2s',
    '&:hover': { transform: 'translateY(-2px)' },
    [LIST_ROW]: { display: 'flex', alignItems: 'stretch' },
  };
  return (
    <Box
      {...(isExternal
        ? { component: 'a' as const, href: item.sourceUrl, target: '_blank', rel: 'noopener noreferrer' }
        : {})}
      sx={cardSx}
    >
      <Box
        sx={{
          position: 'relative',
          width: { xs: 120, sm: 180 },
          flexShrink: 0,
          aspectRatio: { xs: '16/10', [LIST_ROW]: '16/10' },
          [LIST_ROW]: { width: { xs: 120, sm: 180 } },
        }}
      >
        <CoverImage src={item.cover} alt={item.title} sx={{ width: '100%', height: '100%' }} />
        {item.vendor && (
          <Box
            sx={{
              position: 'absolute',
              left: 6,
              bottom: 6,
              px: 0.75,
              py: 0.25,
              borderRadius: 0.75,
              fontSize: 10,
              fontWeight: 600,
              color: '#fff',
              bgcolor: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(4px)',
              maxWidth: 'calc(100% - 12px)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {item.vendor}
          </Box>
        )}
        {item.sourceUrl && (
          <LaunchRoundedIcon
            sx={{
              position: 'absolute',
              right: 6,
              top: 6,
              fontSize: 14,
              color: '#fff',
              bgcolor: 'rgba(0,0,0,0.45)',
              borderRadius: 999,
              p: 0.25,
            }}
          />
        )}
      </Box>
      <Box sx={{ p: 1.25, flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', [LIST_ROW]: { flex: 1 } }}>
        <Typography
          sx={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary, #fff)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: 36,
          }}
        >
          {item.title}
        </Typography>
        {item.subtitle && (
          <Typography
            sx={{
              fontSize: 11,
              color: 'var(--text-muted, rgba(255,255,255,0.45))',
              mt: 0.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {item.subtitle}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

// ─── VersionTimeline ─────────────────────────────────────────────────────

// 竖向轨道:沿用 PoetTimeline 的视觉节奏(主线 / 节点 / 节点圈 / 年份列宽),
// 把"year"替成"version" — 同样是短字符串宽度自适应,事件拼成 flex 行。
// 没数据时整个组件返回 null,与 PoetTimeline 的 "没有就不显示" 一致。
function VersionTimeline({ items }: { items: TopicInsightVersion[] }) {
  const sorted = [...items].sort((a, b) => compareVersionDesc(a.version, b.version));
  return (
    <Box
      sx={{
        position: 'relative',
        pl: 3,
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 7,
          top: 6,
          bottom: 6,
          width: 2,
          bgcolor: 'divider',
          borderRadius: 1,
        },
      }}
    >
      {sorted.map((it, idx) => (
        <Box
          key={`${it.version}-${idx}`}
          sx={{
            position: 'relative',
            pb: idx === sorted.length - 1 ? 0 : 2,
            display: 'flex',
            gap: 1.5,
            alignItems: 'flex-start',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              left: -22,
              top: 6,
              width: 12,
              height: 12,
              borderRadius: '50%',
              bgcolor: 'background.paper',
              border: '2px solid',
              borderColor: 'primary.main',
            }}
          />
          <Typography
            sx={{
              fontSize: 13,
              fontWeight: 600,
              color: 'primary.main',
              minWidth: 56,
              flexShrink: 0,
            }}
          >
            {it.version}
          </Typography>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 14, color: 'text.primary', lineHeight: 1.7, wordBreak: 'break-word' }}>
              {it.summary}
              {it.sourceUrl && (
                <Box
                  component="a"
                  href={it.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    ml: 0.75,
                    fontSize: 11,
                    color: 'var(--text-muted, rgba(255,255,255,0.45))',
                    textDecoration: 'none',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  [源]
                </Box>
              )}
            </Typography>
            {it.releasedAt && (
              <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.45))', mt: 0.25 }}>
                {it.releasedAt}
              </Typography>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

// compareVersionDesc:前端兜底排序 —— 后端已按版本号降序返回,但 import 顺序或手工行混排时会乱,
// 客户端兜一道。后端解析不了的版本号(没匹配到 S10/v14.x)走字典序,不会 panic。
export function compareVersionDesc(a: string, b: string): number {
  const key = (s: string): [boolean, number[], string] => {
    const lower = s.toLowerCase();
    if (lower.startsWith('s')) {
      const n = parseInt(lower.slice(1), 10);
      return [true, [Number.isFinite(n) ? n : 0], s];
    }
    const m = lower.match(/^v?(\d+)\.(\d+)([a-z]?)/);
    if (m) {
      return [false, [parseInt(m[1], 10) || 0, parseInt(m[2], 10) || 0], m[3] || ''];
    }
    return [false, [0], s];
  };
  const [aS, aN, aSuf] = key(a);
  const [bS, bN, bSuf] = key(b);
  if (aS !== bS) return aS ? -1 : 1;
  for (let i = 0; i < Math.max(aN.length, bN.length); i++) {
    const av = aN[i] ?? 0;
    const bv = bN[i] ?? 0;
    if (av !== bv) return bv - av;
  }
  if (aSuf === bSuf) return 0;
  return aSuf < bSuf ? 1 : -1;
}

export default TopicInsightSection;

'use client';

// 意境的「活」部分:每个意境都和人生感悟、文明图谱一样,跟着热点、搜索和用户长分支,
// 有行为闭环(埋点 → 真实反馈排序 → 个性化 → 推荐召回)。后端把意境镜像成文明图谱的节点
// c.yj.<意境 id>(qingqiuyue-go internal/handler/civ_yj.go),这里全部复用图谱的接口与部件。
//
//   FlagshipStrip  意境广场顶部的两个旗舰意境:人生感悟、文明图谱(它们有自己完整的页面)
//   LiveTopics     「此刻 · 意境在长」:按人排的、正挂着热点的意境与刚长出的分支
//   TopicLiveSection 意境详情页里的此刻热点、站内此刻、长出的枝、接一枝、意思相近的作品

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import SpaRoundedIcon from '@mui/icons-material/SpaRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import { civNode, type CivNode } from '@/apis/civ';
import { ago } from '@/components/insight/Branches';
import { ItemGrid } from '@/components/insight/ThemeWorks';
import { civSignals, GraftBox, ORIGIN_LABEL } from '@/components/civ/CivParts';
import { useTopicImpressions, useTopicOpen, workClickCapture } from '@/lib/topicTrack';
import { topicHref } from './format';

const YJ = 'c.yj';
const ACCENT = '#FF8A3D';

/** 意境节点 key → 意境 id;分支(c.yj.<id>.xxx)返回 null */
export function yjTopicId(key: string): string | null {
  const m = /^c\.yj\.(\d+)$/.exec(key);
  return m ? m[1] : null;
}

/** 节点去哪:意境本身去意境详情页,长出来的分支去节点页 */
export function yjHref(key: string): string {
  const id = yjTopicId(key);
  return id ? topicHref(id) : `/civ/node?key=${encodeURIComponent(key)}`;
}

const muted = 'var(--text-muted, rgba(255,255,255,0.5))';
const border = 'var(--border-color, rgba(255,255,255,0.1))';

export function FlagshipStrip() {
  const items = [
    {
      href: '/insight',
      icon: <SpaRoundedIcon sx={{ fontSize: 22 }} />,
      name: '人生感悟',
      line: '爱恨离合、七情六欲、世道人心 —— 同一种心事,换一种作品再看一遍',
      color: '#C8553D',
    },
    {
      href: '/civ',
      icon: <PublicRoundedIcon sx={{ fontSize: 22 }} />,
      name: '文明图谱',
      line: '社会、文化、科技、政治、军事、民生 —— 把人类文明拆开,每部作品都有地方挂',
      color: '#2E86AB',
    },
  ];
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5, mb: 3 }}>
      {items.map((it) => (
        <Box
          key={it.href}
          component={Link}
          href={it.href}
          sx={{
            p: 2,
            borderRadius: 2,
            textDecoration: 'none',
            color: 'inherit',
            border: `1px solid ${border}`,
            borderLeft: `3px solid ${it.color}`,
            display: 'flex',
            gap: 1.5,
            alignItems: 'flex-start',
            minWidth: 0,
            transition: 'transform .15s',
            '&:hover': { transform: 'translateY(-2px)', borderColor: it.color },
          }}
        >
          <Box sx={{ color: it.color, mt: 0.25 }}>{it.icon}</Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: it.color }}>
              {it.name}
              <Box component="span" sx={{ fontSize: 11, fontWeight: 500, color: muted, ml: 1 }}>
                旗舰意境
              </Box>
            </Typography>
            <Typography sx={{ fontSize: 12, color: muted, mt: 0.5, lineHeight: 1.6 }}>{it.line}</Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function LiveCard({ n }: { n: CivNode }) {
  const isTopic = !!yjTopicId(n.key);
  const signals = civSignals(n);
  return (
    <Box
      component={Link}
      href={yjHref(n.key)}
      sx={{
        p: 1.5,
        borderRadius: 1.5,
        border: `1px solid ${border}`,
        textDecoration: 'none',
        color: 'inherit',
        minWidth: 0,
        display: 'block',
        '&:hover': { borderColor: ACCENT },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, minWidth: 0 }}>
        <Typography sx={{ fontSize: 14.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {n.name}
        </Typography>
        {!isTopic && n.parentName && (
          <Typography sx={{ fontSize: 11, color: muted, whiteSpace: 'nowrap' }}>← {n.parentName}</Typography>
        )}
        <Typography sx={{ fontSize: 10.5, color: muted, ml: 'auto', whiteSpace: 'nowrap' }}>
          {n.forYou ? '你可能在意 · ' : ''}
          {isTopic ? '意境' : ORIGIN_LABEL[n.origin]}
          {n.lastSignal ? ` · ${ago(n.lastSignal)}` : ''}
        </Typography>
      </Box>
      {n.headline && (
        <Typography
          sx={{
            fontSize: 12.5,
            color: muted,
            mt: 0.5,
            lineHeight: 1.6,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          此刻:{n.headline}
        </Typography>
      )}
      <Typography sx={{ fontSize: 11, color: muted, mt: 0.5 }}>
        {[...signals, `作品 ${n.works.toLocaleString()}`].join(' · ')}
      </Typography>
    </Box>
  );
}

/** 「此刻 · 意境在长」:正挂着热点 / 有人在看 / 刚长出分支的意境,按人排。没有就不显示。 */
export function LiveTopics() {
  const q = useQuery({ queryKey: ['civ', 'node', YJ], queryFn: () => civNode(YJ), staleTime: 5 * 60_000, retry: false });
  // 只要「活」的:挂着热点、有人搜、刚长出来的枝,或者和这个人的偏好很近
  const list = (q.data?.children ?? [])
    .filter((n) => n.status === 'open' && (n.hotCount || n.searchUsers || n.depth > 1 || n.forYou))
    .slice(0, 9);
  useTopicImpressions(list.map((n) => n.key));
  if (!list.length) return null;
  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.25, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700 }}>此刻 · 意境在长</Typography>
        <Typography sx={{ fontSize: 11, color: muted }}>
          跟着热点、搜索和大家接的枝长出来的{q.data?.personalized ? ',按你的偏好排' : ''}
        </Typography>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' }, gap: 1 }}>
        {list.map((n) => (
          <LiveCard key={n.key} n={n} />
        ))}
      </Box>
    </Box>
  );
}

/** 意境详情页:此刻的热点、站内此刻、长出的枝、接一枝、意思相近的作品。节点不存在(私密 / 刚建)时不显示。 */
export function TopicLiveSection({ topicId }: { topicId: string }) {
  const router = useRouter();
  const key = `${YJ}.${topicId}`;
  useTopicOpen(key);
  const q = useQuery({ queryKey: ['civ', 'node', key], queryFn: () => civNode(key), staleTime: 5 * 60_000, retry: false });
  useTopicImpressions((q.data?.children ?? []).map((c) => c.key));
  if (!q.data) return null;
  const { node } = q.data;
  const evidence = q.data.evidence ?? [];
  const now = q.data.now ?? [];
  const semantic = q.data.semantic ?? [];
  const grown = q.data.children ?? [];
  const head = (title: string, hint?: string) => (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.25, flexWrap: 'wrap' }}>
      <Typography sx={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap' }}>{title}</Typography>
      {hint && <Typography sx={{ fontSize: 11, color: muted }}>{hint}</Typography>}
    </Box>
  );
  return (
    <Box sx={{ mb: 3 }}>
      {evidence.length > 0 && (
        <Box sx={{ mb: 3 }}>
          {head('此刻的热点', `热搜里出现了这个意境的词${node.cues.length ? `(${node.cues.slice(0, 4).join('、')})` : ''}`)}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {evidence.slice(0, 5).map((e) => (
              <Box
                key={e.word}
                component="a"
                href={e.url || undefined}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ display: 'flex', gap: 1, alignItems: 'baseline', textDecoration: 'none', color: 'inherit', minWidth: 0, '&:hover': { color: ACCENT } }}
              >
                <Typography sx={{ fontSize: 13.5, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.word}
                </Typography>
                <Typography sx={{ fontSize: 11, color: muted, whiteSpace: 'nowrap' }}>
                  {e.source}
                  {e.rank ? ` 第 ${e.rank} 位` : ''} · {ago(e.at)}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {now.length > 0 && (
        <Box sx={{ mb: 3 }}>
          {head('站内此刻', '近几天标题里带这个意境的词的资讯与视频')}
          <Box onClickCapture={workClickCapture(key)}>
            <ItemGrid list={now} accent={ACCENT} showType />
          </Box>
        </Box>
      )}

      {grown.length > 0 && (
        <Box sx={{ mb: 3 }}>
          {head('长出的枝', '热点、搜索或大家在这个意境下接出来的')}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1 }}>
            {grown.slice(0, 8).map((g) => (
              <Box
                key={g.key}
                onClick={() => router.push(yjHref(g.key))}
                sx={{ p: 1.25, borderRadius: 1.5, border: `1px solid ${border}`, cursor: 'pointer', minWidth: 0, '&:hover': { borderColor: ACCENT } }}
              >
                <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
                  {g.name}
                  <Box component="span" sx={{ fontSize: 10.5, fontWeight: 400, color: muted, ml: 1 }}>
                    {g.status === 'pending' ? '待长出' : ORIGIN_LABEL[g.origin]}
                  </Box>
                </Typography>
                <Typography sx={{ fontSize: 11.5, color: muted, mt: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {g.headline || g.intro || g.cues.join(' · ')} · 作品 {g.works.toLocaleString()}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {semantic.length > 0 && (
        <Box sx={{ mb: 3 }}>
          {head('意思相近的作品', '字面上没出现这个意境的词,按语义向量找到的')}
          <Box onClickCapture={workClickCapture(key)}>
            <ItemGrid list={semantic} accent={ACCENT} showType />
          </Box>
        </Box>
      )}

      <Box sx={{ mb: 3, p: 2, borderRadius: 2, border: `1px dashed ${border}` }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 0.5 }}>在「{node.name}」下接一枝</Typography>
        <Typography sx={{ fontSize: 12, color: muted, mb: 1.5 }}>
          觉得这个意境还缺一块?起个名字、给几个线索词,站内相关作品够 3 部就开,不够就先挂着等内容长出来。
        </Typography>
        <GraftBox parent={key} accent={ACCENT} />
      </Box>
    </Box>
  );
}

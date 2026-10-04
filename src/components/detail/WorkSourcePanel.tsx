'use client';

/**
 * 作品的权威出处 + 播放源(后端详情的 work 块,qingqiuyue-go internal/workcat)。
 *
 * 同一部作品被几个数据源各收录一条,后端归并成「作品」:资料以维基数据 / Bangumi 为准,
 * 播放源汇总了每条收录能提供的来源,并按「能看 → 等级 → 真实播放成功率」排好了序。
 * 这里如实标出每个来源的等级(官方免费 / 平台用户上传 / 第三方来源 / 正版平台去原站),
 * 能在站内播的可以切换,正版会员平台给去原站的链接。
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import Link from '@mui/material/Link';

export interface WorkOffer {
  contentId: string;
  kind: 'stream' | 'link' | string;
  tier: string;
  tierLabel: string;
  region: string;
  label: string;
  url: string;
  status: string;
  watchable: boolean;
  playOk: number;
  playFail: number;
}

export interface WorkInfo {
  id: string;
  type: string;
  title: string;
  aliases?: string[];
  year?: number;
  authority: string;
  wikidataId?: string;
  bangumiId?: string;
  doubanId?: string;
  imdbId?: string;
  repContentId: string;
  memberCount: number;
  watchable: boolean;
  bestTier?: string;
  offers: WorkOffer[];
}

const TIER_COLOR: Record<string, string> = {
  official_free: '#22c55e',
  platform_ugc: '#3b82f6',
  third_party: '#f59e0b',
  paid_platform: '#94a3b8',
};

const REGION_NOTE: Record<string, string> = {
  cn: '仅中国大陆网络可播放',
  overseas: '中国大陆网络可能无法播放',
};

/** 能在站内播放的来源(已按后端的选源顺序) */
export function streamOffers(w?: WorkInfo | null): WorkOffer[] {
  return (w?.offers || []).filter((o) => o.kind === 'stream' && o.watchable);
}

function authorityLinks(w: WorkInfo): { label: string; href: string }[] {
  const out: { label: string; href: string }[] = [];
  if (w.wikidataId) out.push({ label: '维基数据', href: `https://www.wikidata.org/wiki/${w.wikidataId}` });
  if (w.bangumiId) out.push({ label: 'Bangumi', href: `https://bgm.tv/subject/${w.bangumiId}` });
  if (w.doubanId) out.push({ label: '豆瓣', href: `https://movie.douban.com/subject/${w.doubanId}/` });
  if (w.imdbId) out.push({ label: 'IMDb', href: `https://www.imdb.com/title/${w.imdbId}/` });
  return out;
}

export function WorkSourcePanel({
  work,
  activeUrl,
  onSelect,
}: {
  work?: WorkInfo | null;
  /** 当前在播的来源地址(高亮) */
  activeUrl?: string;
  /** 传了才能切换站内来源;不传时只展示 */
  onSelect?: (o: WorkOffer) => void;
}) {
  if (!work) return null;
  const streams = streamOffers(work);
  const links = (work.offers || []).filter((o) => o.kind === 'link');
  const auth = authorityLinks(work);
  if (streams.length === 0 && links.length === 0 && auth.length === 0 && work.memberCount <= 1) return null;

  const chip = (o: WorkOffer, active: boolean, clickable: boolean) => {
    const color = TIER_COLOR[o.tier] || '#94a3b8';
    const rate = o.playOk + o.playFail > 0 ? `近 30 天播放成功 ${o.playOk}/${o.playOk + o.playFail}` : '';
    const tip = [o.tierLabel, REGION_NOTE[o.region], rate].filter(Boolean).join(' · ');
    return (
      <Tooltip key={o.url} title={tip} arrow>
        <Box
          component={clickable ? 'button' : 'span'}
          onClick={clickable ? () => onSelect?.(o) : undefined}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.6,
            px: 1.2,
            py: 0.5,
            borderRadius: 999,
            border: '1px solid',
            borderColor: active ? color : 'divider',
            bgcolor: active ? `${color}1F` : 'transparent',
            color: 'text.primary',
            fontSize: 13,
            cursor: clickable ? 'pointer' : 'default',
            font: 'inherit',
          }}
        >
          <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
          {o.label || o.tierLabel}
          <Box component="span" sx={{ fontSize: 11, color: 'text.secondary' }}>{o.tierLabel}</Box>
        </Box>
      </Tooltip>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
      {streams.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mr: 0.5 }}>播放来源</Typography>
          {streams.map((o) => chip(o, o.url === activeUrl, !!onSelect))}
        </Box>
      )}
      {links.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mr: 0.5 }}>正版平台</Typography>
          {links.map((o) => (
            <Link key={o.url} href={o.url} target="_blank" rel="noopener noreferrer" underline="hover" sx={{ fontSize: 13 }}>
              去{o.label}看
            </Link>
          ))}
        </Box>
      )}
      {(auth.length > 0 || work.memberCount > 1) && (
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
          {auth.length > 0 && (
            <>
              资料来自{' '}
              {auth.map((a, i) => (
                <React.Fragment key={a.href}>
                  {i > 0 && ' · '}
                  <Link href={a.href} target="_blank" rel="noopener noreferrer" underline="hover" color="inherit">
                    {a.label}
                  </Link>
                </React.Fragment>
              ))}
            </>
          )}
          {work.memberCount > 1 && <>{auth.length > 0 ? ',' : ''}已合并 {work.memberCount} 个数据源的收录</>}
        </Typography>
      )}
    </Box>
  );
}

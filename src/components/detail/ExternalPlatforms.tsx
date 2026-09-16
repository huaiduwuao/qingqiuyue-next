'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { mediaUrl } from '@/lib/media';

/**
 * 全网检索收录的作品(后端 internal/discover)在详情里带:
 *   playNotice —— 本站为什么播不了/读不了(会员独占、付费、仅收录书目…)
 *   platforms  —— 各平台入口,vip=true 表示该平台需要会员或付费
 * 本站播不了的作品照样收录、照样搜得到,但必须如实说明原因并给出原平台入口,
 * 不能把付费页交给播放器硬解析,再报一句"解析失败,尽快修复"。
 */
export interface ExternalPlatform {
  site?: string;
  name?: string;
  url: string;
  vip?: boolean;
}

interface WithPlatforms {
  platforms?: unknown;
  playNotice?: unknown;
}

const isHttp = (u: unknown): u is string => typeof u === 'string' && /^https?:\/\//.test(u);

/** 从详情数据里取出可用的平台入口(去掉非 http 地址、按 URL 去重)。 */
export function platformsOf(data?: WithPlatforms | null): ExternalPlatform[] {
  const raw = Array.isArray(data?.platforms) ? (data!.platforms as ExternalPlatform[]) : [];
  const seen = new Set<string>();
  return raw.filter((p) => {
    if (!p || !isHttp(p.url) || seen.has(p.url)) return false;
    seen.add(p.url);
    return true;
  });
}

/** 详情里的播放/阅读说明;没有时返回空串。 */
export function playNoticeOf(data?: WithPlatforms | null): string {
  return typeof data?.playNotice === 'string' ? data.playNotice.trim() : '';
}

function hostOf(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
}

/** 一排原平台入口按钮。 */
export function PlatformLinks({
  platforms,
  title = '在这些平台可以找到',
  dense = false,
}: {
  platforms: ExternalPlatform[];
  title?: string;
  dense?: boolean;
}) {
  if (platforms.length === 0) return null;
  return (
    <Box sx={{ mt: dense ? 1 : 2 }}>
      {title && (
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>{title}</Typography>
      )}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {platforms.map((p) => (
          <Button
            key={p.url}
            size="small"
            variant="outlined"
            href={p.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            {p.name || hostOf(p.url)}
            {p.vip && (
              <Box
                component="span"
                sx={{ ml: 0.75, px: 0.5, borderRadius: 0.5, fontSize: 10, lineHeight: '16px', bgcolor: 'warning.main', color: '#000' }}
              >
                会员/付费
              </Box>
            )}
          </Button>
        ))}
      </Box>
    </Box>
  );
}

/** 播放器位置的替代面板:封面做底,写明原因,列出原平台入口。 */
export function UnavailablePlayer({
  notice,
  platforms,
  poster,
}: {
  notice: string;
  platforms: ExternalPlatform[];
  poster?: string;
}) {
  return (
    <Box
      role="note"
      sx={{
        position: 'relative',
        width: '100%',
        maxWidth: '100%',
        aspectRatio: '16 / 9',
        maxHeight: '70vh',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#000',
      }}
    >
      {poster && (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url("${mediaUrl(poster)}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(18px) brightness(0.35)',
            transform: 'scale(1.1)',
          }}
        />
      )}
      <Box sx={{ position: 'relative', textAlign: 'center', px: 3, maxWidth: 560, color: '#fff' }}>
        <InfoOutlinedIcon sx={{ fontSize: 32, color: 'warning.main', mb: 1 }} />
        <Typography sx={{ fontSize: { xs: 13, sm: 15 }, lineHeight: 1.7, mb: 1.5 }}>{notice}</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
          {platforms.slice(0, 4).map((p) => (
            <Button
              key={p.url}
              size="small"
              variant="contained"
              href={p.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
              sx={{ textTransform: 'none', borderRadius: 2 }}
            >
              去{p.name || hostOf(p.url)}观看
            </Button>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

'use client';

/** 手机版的实现列表行:缩略图 + 任务名 + 一行「需求 · 团队 · 日期」+ 行尾金额;有作品的点进作品页。 */

import React from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';
import { MobileListRow } from '@/components/mobile/MobileSection';
import { CoverImage } from '@/components/common/CoverImage';
import { TYPE_TO_ROUTE } from '@/lib/contentType.gen';
import { yuan, type Realization } from '@/apis/team';
import { RowIcon } from '../personal/mobileKit';

const workHref = (r: Realization) => {
  const route = r.workId && r.workId !== '0' ? TYPE_TO_ROUTE[(r.workType || '').toUpperCase()] : null;
  return route ? `${route}?id=${encodeURIComponent(r.workId)}` : null;
};

export default function RealizationRowsMobile({ items }: { items: Realization[] }) {
  const router = useRouter();
  // 后端空结果可能是 {"list": null},flatMap 后会混进 null
  const rows = (items ?? []).filter(Boolean);
  return (
    <>
      {rows.map((r, i) => {
        const href = workHref(r);
        const meta = [r.taskTitle && r.demandTitle ? `需求:${r.demandTitle}` : '', r.teamId > 0 ? r.teamName || '团队交付' : r.nickname || '', String(r.createdAt || '').slice(5, 10)]
          .filter(Boolean)
          .join(' · ');
        return (
          <MobileListRow
            key={r.id}
            divider={i > 0}
            onClick={href ? () => router.push(href) : undefined}
            leading={
              r.workCover ? (
                <CoverImage src={r.workCover} alt="" loading="lazy" sx={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 2, flexShrink: 0 }} />
              ) : (
                <RowIcon color="secondary.main" bg="action.hover" size={40}>
                  <HandshakeRoundedIcon />
                </RowIcon>
              )
            }
            title={r.taskTitle || r.demandTitle}
            subtitle={meta || (href ? '作品交付' : '文字交付')}
            trailing={
              <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                {r.settledAt ? (
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'primary.main' }}>¥{yuan(r.amountCents)}</Typography>
                ) : (
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>待结账</Typography>
                )}
              </Box>
            }
          />
        );
      })}
    </>
  );
}

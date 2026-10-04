'use client';

/**
 * PlayTag —— 全站资源卡片上的「能不能播 / 能不能读」标签。
 *
 * 和 AvailabilityBadge 的区别:那个要调用方手里已经有判定;这个只要内容 id,
 * 自己合批去问 /api/content/availability(见 apis/availability.ts)。调用方已经拿到
 * playbackStatus 的(推荐流、榜单、搜索)直接传 status,不再发请求。
 *
 * 播放/阅读轴上还没判定的(unknown)显示灰色「待检测」:用户要求每条资源都标明能不能播,
 * 不标会被读成"能播",标「可播」又是猜。壁纸、人物词条这类(axis = none)不挂标签。
 */

import React, { useEffect, useState } from 'react';
import Chip from '@mui/material/Chip';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import { AvailabilityBadge, specOf } from './AvailabilityBadge';
import { loadAvailability, peekAvailability, type AvailabilityItem } from '@/apis/availability';
import type { EntityId } from '@/lib/id';

/** 这些类型没有能不能播的问题,不必发请求。 */
const INERT_TYPES = new Set(['WALLPAPER', 'PICTURE', 'PERSON', 'TOPIC', 'USER', 'PLAYLIST']);

export interface PlayTagProps {
  id?: EntityId | null;
  /** 内容类型(大写 code);认得出是壁纸 / 人物时直接不画。 */
  contentType?: string | null;
  /** 调用方已有的判定(playbackStatus);给了就不再问接口。 */
  status?: string | null;
  /** 阅读轴的章节程度(调用方已有时传入;否则用接口返回的)。 */
  readyItems?: number;
  totalItems?: number;
  variant?: 'inline' | 'overlay';
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
  sx?: any;
}

function usePlayAvailability(id: EntityId | null | undefined, skip: boolean) {
  const [item, setItem] = useState<AvailabilityItem | null | undefined>(() =>
    skip || id == null ? undefined : peekAvailability(id),
  );
  useEffect(() => {
    if (skip || id == null || id === '') return;
    const hit = peekAvailability(id);
    if (hit !== undefined) {
      setItem(hit);
      return;
    }
    let alive = true;
    loadAvailability(id).then((v) => alive && setItem(v));
    return () => {
      alive = false;
    };
  }, [id, skip]);
  return item;
}

export function PlayTag({ id, contentType, status, readyItems, totalItems, variant = 'inline', sx, ...pos }: PlayTagProps) {
  const ct = (contentType || '').toUpperCase();
  const inert = INERT_TYPES.has(ct);
  const given = status && status !== 'unknown' ? status : undefined;
  const item = usePlayAvailability(id, inert || !!given);
  if (inert) return null;

  const st = given ?? item?.status;
  if (!st || item?.axis === 'none' || st === 'not_applicable') return null;

  const ready = readyItems ?? item?.readyItems;
  const total = totalItems ?? item?.totalItems;
  if (specOf(st, ready, total, ct)) {
    return (
      <AvailabilityBadge
        status={st}
        readyItems={ready}
        totalItems={total}
        contentType={ct}
        variant={variant}
        sx={sx}
        {...pos}
      />
    );
  }
  // unknown:说"待检测",不猜。
  const overlay = variant === 'overlay';
  return (
    <Chip
      size="small"
      icon={<HelpOutlineRoundedIcon />}
      label="待检测"
      sx={{
        height: overlay ? 22 : 20,
        fontSize: 11,
        fontWeight: 600,
        ...(overlay
          ? {
              position: 'absolute',
              zIndex: 5,
              top: pos.top ?? 8,
              ...(pos.left !== undefined ? { left: pos.left } : { right: pos.right ?? 8 }),
              ...(pos.bottom !== undefined ? { bottom: pos.bottom } : {}),
              bgcolor: 'rgba(0,0,0,0.5)',
              color: 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(6px)',
              border: '1px solid rgba(255,255,255,0.18)',
            }
          : {
              bgcolor: 'rgba(148,163,184,0.14)',
              color: 'text.secondary',
              border: '1px solid rgba(148,163,184,0.32)',
            }),
        '& .MuiChip-icon': { color: 'inherit', fontSize: 13, ml: 0.5 },
        '& .MuiChip-label': { px: 0.75 },
        ...sx,
      }}
    />
  );
}

export default PlayTag;

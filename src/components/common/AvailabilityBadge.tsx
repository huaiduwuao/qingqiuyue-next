'use client';

/**
 * AvailabilityBadge —— 「这条内容在站内到底能不能用」的角标。
 *
 * 为什么需要它:判定链路早就有(后端 internal/playability),但结论只下发到沉浸式
 * 推荐流一处。列表、搜索、书架、详情页上,一本只有目录的小说和一本完整的书长得
 * 一模一样 —— 用户点进去才发现阅读器是空白的。
 *
 * 线上实测(2026-09-18):145,574 条小说章节行里存了正文的只有 17 条。整个小说库
 * 没有一本能读完,而界面上没有任何地方说出过这件事。
 *
 * 措辞原则:
 *   - 能用的说"站内可看/可读",不说"免费""高清"这类没有依据的形容。
 *   - 不能用的说清**为什么**,并且严格区分"我们弄坏了"和"我们没收录"——
 *     后者说成"修复中"会凭空制造一堆永远修不完、也不该修的预期。
 *   - 部分可读要给出具体程度(共 900 章,站内 20 章),含糊的"部分"没有用。
 */

import React from 'react';
import Chip from '@mui/material/Chip';
import PlayCircleOutlineRoundedIcon from '@mui/icons-material/PlayCircleOutlineRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import BuildRoundedIcon from '@mui/icons-material/BuildRounded';
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded';
import type { PlaybackStatus } from '@/apis/recommend';

export type AvailabilityTone = 'good' | 'partial' | 'external' | 'broken';

export interface AvailabilityBadgeProps {
  /**
   * 可用性结论。放宽到 string 是因为来源不止 PlaybackStatus 一处 ——
   * 补全页从 /api/spider/content/backfill/item-stats 拿到的是裸字符串。
   * specOf 本来就是 switch 字符串,认不出的值返回 null(不显示角标),
   * 所以放宽类型不会让任何既有调用方行为改变。
   */
  status?: PlaybackStatus | string;
  /** 已入库正文的章节数 / 目录总章节数,partial_text 时用来说清程度。 */
  readyItems?: number;
  totalItems?: number;
  /** inline 跟在标题旁;overlay 贴在封面角上。 */
  variant?: 'inline' | 'overlay';
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
  sx?: any;
}

type Spec = { label: string; tone: AvailabilityTone; icon: React.ReactElement };

// 色板对应四种"用户该做什么":
//   good     绿 —— 现在就能在站内用
//   partial  琥珀 —— 能用一部分,点进去会遇到边界
//   external 灰蓝 —— 站内用不了,但有正当去处(不是故障,别用警示色)
//   broken   红 —— 确实坏了,该修
const toneColor: Record<AvailabilityTone, { fg: string; bg: string; border: string }> = {
  good: { fg: '#16a34a', bg: 'rgba(22, 163, 74, 0.14)', border: 'rgba(22, 163, 74, 0.38)' },
  partial: { fg: '#d97706', bg: 'rgba(217, 119, 6, 0.14)', border: 'rgba(217, 119, 6, 0.38)' },
  external: { fg: '#64748b', bg: 'rgba(100, 116, 139, 0.14)', border: 'rgba(100, 116, 139, 0.34)' },
  broken: { fg: '#dc2626', bg: 'rgba(220, 38, 38, 0.14)', border: 'rgba(220, 38, 38, 0.38)' },
};

/**
 * specOf 把状态翻成用户看得懂的一句话。
 *
 * 返回 null 表示"不该显示角标":unknown(还没判定,说什么都是猜)和
 * not_applicable(壁纸/人物词条,本来就没有能不能用的问题)。给这两种挂角标
 * 只会制造噪声 —— 一屏里每张卡片都挂着标签,等于没有标签。
 */
export function specOf(
  status?: PlaybackStatus | string,
  readyItems?: number,
  totalItems?: number,
): Spec | null {
  switch (status) {
    // ── 播放轴 ──
    case 'playable':
      return { label: '站内可播', tone: 'good', icon: <PlayCircleOutlineRoundedIcon /> };
    case 'embeddable':
      return { label: '站内可看', tone: 'good', icon: <PlayCircleOutlineRoundedIcon /> };
    case 'bandwidth_limited':
      // 内容没坏,是我们不替源站付视频带宽。说"去原站看",不说"不可用"。
      return { label: '去原站看', tone: 'external', icon: <OpenInNewRoundedIcon /> };
    case 'live_offline':
      return { label: '未开播', tone: 'external', icon: <HourglassEmptyRoundedIcon /> };
    case 'pending_repair':
      return { label: '修复中', tone: 'broken', icon: <BuildRoundedIcon /> };

    // ── 阅读轴 ──
    case 'readable':
      return { label: '站内可读', tone: 'good', icon: <MenuBookRoundedIcon /> };
    case 'partial_text':
      return {
        // 有具体数字就报数字。"部分章节"对用户毫无信息量 —— 是 20/900 还是 880/900,
        // 决定了他要不要点进来。
        label:
          readyItems && totalItems
            ? `站内 ${readyItems}/${totalItems} 章`
            : '部分章节可读',
        tone: 'partial',
        icon: <MenuBookRoundedIcon />,
      };
    case 'catalog_only':
      // 线上小说的普遍状态。必须说"仅目录"而不是任何暗示能读的说法 ——
      // 这正是用户点进去看到空白页的那一类。
      return { label: '仅目录', tone: 'external', icon: <OpenInNewRoundedIcon /> };
    case 'external_only':
      return { label: '去原站读', tone: 'external', icon: <OpenInNewRoundedIcon /> };

    default:
      return null; // unknown / not_applicable / 后端没下发
  }
}

const inlineSx = (tone: AvailabilityTone) => ({
  height: 20,
  fontSize: 11,
  fontWeight: 600,
  bgcolor: toneColor[tone].bg,
  color: toneColor[tone].fg,
  border: `1px solid ${toneColor[tone].border}`,
  '& .MuiChip-icon': { color: toneColor[tone].fg, fontSize: 13, ml: 0.5 },
  '& .MuiChip-label': { px: 0.75 },
});

const overlaySx = (tone: AvailabilityTone) => ({
  position: 'absolute' as const,
  zIndex: 5,
  height: 22,
  fontSize: 11,
  fontWeight: 600,
  bgcolor: 'rgba(0, 0, 0, 0.58)',
  color: '#fff',
  backdropFilter: 'blur(6px)',
  border: '1px solid rgba(255,255,255,0.2)',
  '& .MuiChip-icon': { color: toneColor[tone].fg, fontSize: 13, ml: 0.5 },
  '& .MuiChip-label': { px: 0.75 },
});

export function AvailabilityBadge({
  status,
  readyItems,
  totalItems,
  variant = 'inline',
  top = 8,
  left,
  right = 8,
  bottom,
  sx,
}: AvailabilityBadgeProps) {
  const spec = specOf(status, readyItems, totalItems);
  if (!spec) return null;

  const base = variant === 'overlay' ? overlaySx(spec.tone) : inlineSx(spec.tone);
  const pos =
    variant === 'overlay'
      ? { top, ...(left !== undefined ? { left } : {}), ...(right !== undefined && left === undefined ? { right } : {}), ...(bottom !== undefined ? { bottom } : {}) }
      : {};

  return (
    <Chip
      size="small"
      icon={spec.icon}
      label={spec.label}
      sx={{ ...base, ...pos, ...sx }}
    />
  );
}

export default AvailabilityBadge;

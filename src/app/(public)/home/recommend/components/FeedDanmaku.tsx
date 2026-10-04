'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import { getComments } from '@/apis/home';

/**
 * 推荐流的弹幕层。
 *
 * 弹幕内容就是这条内容的站内评论:进来时把最近一页评论排队飘过,之后每 15 秒拉一次
 * 第一页,新出现的评论接着飘 —— 别人刚发的也能"实时"看到(站内推送通道是按用户投递的,
 * 没有按内容广播的房间,轮询是现阶段最省事的实时)。发评论走评论栏,下一轮轮询就上屏。
 *
 * 只放站内评论(视频走本站播放器,没有源站自带的弹幕)。
 */

export interface DanmakuItem {
  key: string;
  text: string;
  mine?: boolean;
}

interface Flying extends DanmakuItem {
  lane: number;
  duration: number;
}

const LANES = 6;
const POLL_MS = 15_000;
/** 同一条道上两条弹幕的最小间隔,免得叠在一起 */
const LANE_GAP_MS = 1_600;

function commentList(res: unknown): Array<{ id?: string | number; content?: string }> {
  // contentClient 已剥掉 {code,msg,data},这里是 { list, total };兼容数组形态。
  const payload = (res as { data?: unknown })?.data ?? res;
  if (Array.isArray(payload)) return payload;
  return ((payload as { list?: unknown[] })?.list ?? []) as Array<{ id?: string | number; content?: string }>;
}

/** 拉评论、排队、发射。返回当前在飞的弹幕。 */
export function useFeedDanmaku(contentId: string | null, enabled: boolean) {
  const [flying, setFlying] = useState<Flying[]>([]);
  const queue = useRef<DanmakuItem[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const laneFree = useRef<number[]>(Array(LANES).fill(0));

  // 换内容:清空一切
  useEffect(() => {
    queue.current = [];
    seen.current = new Set();
    laneFree.current = Array(LANES).fill(0);
    setFlying([]);
  }, [contentId]);

  // 拉取 + 轮询
  useEffect(() => {
    if (!contentId || !enabled) return;
    let cancelled = false;
    const pull = async () => {
      try {
        const list = commentList(await getComments(contentId, { page: 1, page_size: 30 }));
        if (cancelled) return;
        // 接口按时间倒序,老的先飘
        for (const c of [...list].reverse()) {
          const id = String(c.id ?? '');
          const text = (c.content || '').replace(/\s+/g, ' ').trim();
          if (!id || !text || seen.current.has(id)) continue;
          seen.current.add(id);
          queue.current.push({ key: `c-${id}`, text: text.length > 40 ? `${text.slice(0, 40)}…` : text });
        }
      } catch {
        /* 弹幕拉不到不影响看视频 */
      }
    };
    void pull();
    const t = setInterval(pull, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [contentId, enabled]);

  // 发射:每 450ms 看一眼队列,有空闲的道就放一条上去
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => {
      if (!queue.current.length) return;
      const now = Date.now();
      const lane = laneFree.current.findIndex((free) => free <= now);
      if (lane < 0) return;
      const item = queue.current.shift()!;
      laneFree.current[lane] = now + LANE_GAP_MS + item.text.length * 60;
      // 长的飘得稍快一点,整体观感更匀
      const duration = 8 + Math.min(item.text.length, 40) * 0.06;
      setFlying((f) => [...f, { ...item, lane, duration }]);
    }, 450);
    return () => clearInterval(t);
  }, [enabled]);

  const land = useCallback((key: string) => setFlying((f) => f.filter((x) => x.key !== key)), []);

  return { flying: enabled ? flying : [], land };
}

/** 弹幕层本体:铺在视频上半区,不接收任何指针事件,不挡滑动和点击。 */
export function DanmakuLayer({ items, onLand }: { items: Flying[]; onLand: (key: string) => void }) {
  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: '8%',
        height: `${LANES * 34}px`,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 2,
        '@keyframes feedDanmakuFly': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(calc(-100vw - 100%))' },
        },
      }}
    >
      {items.map((d) => (
        <Box
          key={d.key}
          onAnimationEnd={() => onLand(d.key)}
          sx={{
            position: 'absolute',
            left: '100%',
            top: d.lane * 34,
            whiteSpace: 'nowrap',
            fontSize: 15,
            fontWeight: 600,
            lineHeight: '28px',
            px: d.mine ? 1 : 0,
            borderRadius: 999,
            color: '#fff',
            border: d.mine ? '1px solid rgba(255,255,255,0.7)' : 'none',
            textShadow: '0 0 2px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.7)',
            animation: `feedDanmakuFly ${d.duration}s linear forwards`,
            willChange: 'transform',
          }}
        >
          {d.text}
        </Box>
      ))}
    </Box>
  );
}

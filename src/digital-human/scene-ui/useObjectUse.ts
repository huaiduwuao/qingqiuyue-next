/**
 * scene-ui/useObjectUse.ts — 创世十期:点椅子坐下、点灯开关
 *
 *   - 椅子 / 凳子 / 沙发:量出这件上的座位(handle.seatSpots),挑离点的地方最近、没人坐的那个;
 *     走到座位前面,到了就坐下(handle.sitAt)。点自己正坐着的那件 = 站起来。走动 / 点别处会自动站起来。
 *   - 灯:POST /world/placements/:id/switch;服务端存好后推 edit 给房里所有人(自己也收到,灯跟着亮 / 灭)。
 *
 * 坐着时 useRoomSocket 报的位置帧带 a = 'sit'、y = 座面高度,同伴那边照着画坐姿。
 */

import React from 'react';
import { switchPlacement, type WorldPlacement } from '@/apis/world';
import type { VrmStageHandle } from '../VrmStage';
import type { WorldEvent } from '../vrm/world/useVrmWorld';
import { pickSeat, type SeatSpot } from '../vrm/world/interact';
import type { RoomSocketState } from './useRoomSocket';

export interface UseObjectUseOptions {
  handle: VrmStageHandle | null;
  rs: Pick<RoomSocketState, 'peers'> & { use?: (id: string) => boolean };
  items: WorldPlacement[];
  toast: (icon: string, text: string) => void;
}

const ARRIVE = 0.3;
const WALK_TIMEOUT = 12_000;

export function useObjectUse(opts: UseObjectUseOptions) {
  const optsRef = React.useRef(opts);
  optsRef.current = opts;
  const pendingRef = React.useRef<{ spot: SeatSpot; id: string; timer: number; started: number } | null>(null);
  const seatOfRef = React.useRef<string | null>(null); // 正坐着的那件摆放
  const [sittingOn, setSittingOn] = React.useState<string | null>(null);

  const cancel = React.useCallback(() => {
    const p = pendingRef.current;
    if (p) window.clearInterval(p.timer);
    pendingRef.current = null;
  }, []);
  React.useEffect(() => cancel, [cancel]);

  const sitDown = React.useCallback((id: string, point: { x: number; z: number }) => {
    const { handle, rs, toast } = optsRef.current;
    if (!handle) return;
    // 点自己正坐着的那件 = 站起来
    if (handle.sitting() && seatOfRef.current === id) {
      handle.standUp();
      seatOfRef.current = null;
      setSittingOn(null);
      return;
    }
    const me = handle.getPosition();
    const spots = handle.seatSpots(id, me);
    if (!spots.length) { toast('🪑', '这件还没加载好,等一下再点'); return; }
    const sitters = rs.peers.filter((p) => p.a === 'sit').map((p) => ({ x: p.x, z: p.z }));
    const spot = pickSeat(spots, sitters, point);
    if (!spot) { toast('🪑', '坐满了'); return; }
    cancel();
    if (handle.sitting()) handle.standUp();
    const arrive = () => {
      handle.sitAt(spot);
      seatOfRef.current = id;
      setSittingOn(id);
    };
    const here = handle.getPosition();
    if (Math.hypot(here.x - spot.approach.x, here.z - spot.approach.z) < ARRIVE) { arrive(); return; }
    handle.walkTo(spot.approach.x, spot.approach.z);
    const started = performance.now();
    const timer = window.setInterval(() => {
      const p = pendingRef.current;
      if (!p) return;
      const now = handle.getPosition();
      if (Math.hypot(now.x - spot.approach.x, now.z - spot.approach.z) < ARRIVE) {
        cancel();
        arrive();
      } else if (performance.now() - p.started > WALK_TIMEOUT) {
        cancel();
      }
    }, 100);
    pendingRef.current = { spot, id, timer, started };
  }, [cancel]);

  const toggleLamp = React.useCallback((id: string) => {
    const { items, toast } = optsRef.current;
    const p = items.find((x) => x.id === id);
    const on = !(p?.off ?? false);
    switchPlacement(id, !on).catch((e: unknown) => toast('💡', (e as Error)?.message || '开关不了'));
  }, []);

  /** 交给世界事件:处理了返回 true */
  const onWorldEvent = React.useCallback((e: WorldEvent): boolean => {
    if (e.type !== 'useObject') return false;
    if (e.kind === 'use') { optsRef.current.rs.use?.(e.id); return true; } // 世界模型:交给服务端跑规则
    if (e.kind === 'seat') sitDown(e.id, e.point);
    else toggleLamp(e.id);
    return true;
  }, [sitDown, toggleLamp]);

  // 别的途径站起来了(键盘走、点地面走开):同步状态
  React.useEffect(() => {
    if (!sittingOn) return;
    const t = window.setInterval(() => {
      if (!optsRef.current.handle?.sitting()) { seatOfRef.current = null; setSittingOn(null); }
    }, 300);
    return () => window.clearInterval(t);
  }, [sittingOn]);

  return { onWorldEvent, sittingOn, cancel };
}

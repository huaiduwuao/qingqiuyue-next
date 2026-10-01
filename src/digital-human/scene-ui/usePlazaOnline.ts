/**
 * scene-ui/usePlazaOnline.ts — 广场的联网部分
 *
 *   - 心跳:每 3 秒把自己的位置报给服务端(/plaza/presence),拿回附近的人画进场景;
 *     离开页面 / 收起广场时告诉服务端「我走了」。
 *   - 许愿墙:进页面拉一次,别人许的新愿望走实时推送(plaza.wish)插到最前,
 *     并在许愿池上方冒出来;自己的愿望被祝福(plaza.bless)弹提示。
 *   - 光环:心跳回包里带着自己戴的光环,直接画到脚下;换了装扮调 refreshAura()。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { VrmStageHandle } from '../VrmStage';
import {
  PLAZA_EVENT_BLESS, PLAZA_EVENT_WISH, blessPlazaWish, leavePlaza, listPlazaWishes, makePlazaWish, plazaHeartbeat,
  type PlazaWish,
} from '@/apis/plaza';
import { useRealtimeEvent, type RealtimeEvent } from '@/lib/realtime';
import { ZONE_BY_ID } from '../vrm/world/worldLayout';

const HEARTBEAT_MS = 3000;

export interface UsePlazaOnlineOptions {
  handle: VrmStageHandle | null;
  enabled: boolean;
  /** 当前场景:同一场景里的人才互相看得见 */
  sceneKey?: string;
  toast: (icon: string, text: string) => void;
  /** 许愿 / 祝福成功后:让页面层记任务、刷新平台任务 */
  onWished?: () => void;
  onBlessed?: () => void;
  /** 七期:已经在房间集线器里的人(画成真形象了):心跳回来的人影里去掉,免得画两遍 */
  exclude?: () => Set<string>;
}

function errMsg(e: unknown, fallback: string): string {
  const m = (e as { message?: string; msg?: string })?.message || (e as { msg?: string })?.msg;
  return typeof m === 'string' && m && m.length < 60 ? m : fallback;
}

export function usePlazaOnline(opts: UsePlazaOnlineOptions) {
  const { handle, enabled } = opts;
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const [online, setOnline] = useState(0);
  const [wishes, setWishes] = useState<PlazaWish[]>([]);
  const [leftToday, setLeftToday] = useState(3);
  const [wishBusy, setWishBusy] = useState(false);
  /** 许愿墙拉取失败(服务不可用):面板显示「连不上」,输入框禁用 */
  const [wishError, setWishError] = useState(false);
  const refreshAuraRef = useRef(true); // 第一次心跳就取一次光环
  const failuresRef = useRef(0);

  // 心跳
  useEffect(() => {
    if (!enabled || !handle) return;
    let alive = true;
    let timer: number | null = null;
    const beat = async () => {
      const snap = handle.getWorldSnapshot();
      if (snap && alive) {
        try {
          const refresh = refreshAuraRef.current;
          refreshAuraRef.current = false;
          const r = await plazaHeartbeat({ x: snap.x, z: snap.z, yaw: snap.yaw, zone: snap.zone, scene: optsRef.current.sceneKey, refresh });
          if (!alive || !r) return;
          failuresRef.current = 0;
          setOnline(r.online);
          const skip = optsRef.current.exclude?.();
          handle.setPeers(r.peers.filter((p) => !skip?.has(String(p.id))).map((p) => ({ id: p.id, nickname: p.nickname, x: p.x, z: p.z, yaw: p.yaw, aura: p.aura, moving: p.moving })));
          handle.setAura(r.self?.aura || null);
        } catch {
          // 没登录 / 服务没上线:连错几次就放慢,别每 3 秒刷一条错误
          failuresRef.current += 1;
        }
      }
      if (alive) timer = window.setTimeout(beat, failuresRef.current > 3 ? 30_000 : HEARTBEAT_MS);
    };
    void beat();
    const onHide = () => { if (document.visibilityState === 'hidden') void leavePlaza().catch(() => {}); };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onHide);
      handle.setPeers([]);
      void leavePlaza().catch(() => {});
    };
  // 换场景时重开心跳:旧场景的人要立刻消失
  }, [enabled, handle, opts.sceneKey]);

  const loadWishes = useCallback(async () => {
    try {
      const r = await listPlazaWishes(30);
      setWishes(r.list);
      setLeftToday(r.leftToday);
      setWishError(false);
    } catch {
      setWishError(true);
    }
  }, []);
  useEffect(() => { if (enabled) void loadWishes(); }, [enabled, loadWishes]);

  // 实时推送:别人的新愿望 / 我的愿望被祝福
  useRealtimeEvent(useCallback((ev: RealtimeEvent) => {
    if (ev.type === PLAZA_EVENT_WISH && ev.data) {
      const w = ev.data as PlazaWish;
      setWishes((list) => (list.some((x) => x.id === w.id) ? list : [w, ...list].slice(0, 40)));
      const pool = ZONE_BY_ID.wish;
      optsRef.current.handle?.floatTextAt(`🌟 ${w.text.slice(0, 14)}${w.text.length > 14 ? '…' : ''}`, pool.x, 2.6, pool.z, '#9be8ff');
      optsRef.current.toast('⛲', `${w.user?.nickname || '有人'} 许了个愿`);
    } else if (ev.type === PLAZA_EVENT_BLESS && ev.data) {
      const d = ev.data as { wishId: string; blessings: number; from?: { nickname?: string } };
      setWishes((list) => list.map((x) => (x.id === d.wishId ? { ...x, blessings: d.blessings } : x)));
      optsRef.current.toast('💝', `${d.from?.nickname || '有人'} 祝福了你的愿望`);
      optsRef.current.handle?.floatText('💝', '#ff9be8');
    }
  }, []), enabled);

  const makeWish = useCallback(async (text: string): Promise<boolean> => {
    setWishBusy(true);
    try {
      const r = await makePlazaWish(text);
      setWishes((list) => [r.wish, ...list.filter((x) => x.id !== r.wish.id)]);
      setLeftToday(r.leftToday);
      const pool = ZONE_BY_ID.wish;
      optsRef.current.handle?.floatTextAt('🌟 愿望已挂上许愿墙', pool.x, 2.6, pool.z, '#9be8ff');
      optsRef.current.onWished?.();
      return true;
    } catch (e) {
      optsRef.current.toast('⚠️', errMsg(e, '许愿没成功,稍后再试'));
      return false;
    } finally {
      setWishBusy(false);
    }
  }, []);

  const bless = useCallback(async (w: PlazaWish) => {
    if (w.blessed) return;
    // 先乐观更新,失败再回滚
    setWishes((list) => list.map((x) => (x.id === w.id ? { ...x, blessed: true, blessings: x.blessings + 1 } : x)));
    try {
      const r = await blessPlazaWish(w.id);
      setWishes((list) => list.map((x) => (x.id === w.id ? { ...x, blessed: true, blessings: r.blessings } : x)));
      if (!w.mine) optsRef.current.onBlessed?.();
    } catch (e) {
      setWishes((list) => list.map((x) => (x.id === w.id ? w : x)));
      optsRef.current.toast('⚠️', errMsg(e, '祝福没送出去'));
    }
  }, []);

  const refreshAura = useCallback(() => { refreshAuraRef.current = true; }, []);

  return { online, wishes, leftToday, wishBusy, wishError, makeWish, bless, refreshAura, reloadWishes: loadWishes };
}

export type PlazaOnline = ReturnType<typeof usePlazaOnline>;

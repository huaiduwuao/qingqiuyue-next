/**
 * scene-ui/useWorldGame.ts — 广场玩法的记账与反应
 *
 * VrmStage 只报事件(捡到星光、进出地标、戳一戳、按 F);这里负责:
 *   - 经验 / 等级 / 每日任务(存 localStorage,只是本机的小进度,丢了也无妨);
 *   - 角色的即时反应(动作、表情、头顶飘字);
 *   - 地标互动:舞池跳舞、观星台俯瞰在本地做,其余回灌成一句话交给数字人。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { VrmStageHandle } from '../VrmStage';
import type { WorldEvent } from '../vrm/world/useVrmWorld';
import { getPlazaProgress, savePlazaProgress } from '@/apis/plaza';
import {
  DEFAULT_WORLD, QUEST_XP, applyGameEvent, findZone, levelOf, mergeGameStates, parseGameState, pokeReaction, zoneFeed, zoneProp,
  type GameEvent, type GameState, type WorldDef, type ZoneId,
} from '../vrm/world/worldLayout';

const STORE_KEY = 'dh_world_game';

export interface GameToast { id: number; icon: string; text: string; tone: 'quest' | 'level' | 'info' }

export interface UseWorldGameOptions {
  handle: VrmStageHandle | null;
  /** 回灌一句话给数字人(走正常对话) */
  sendText: (text: string) => void;
  /** 舞池:开/关跳舞(页面层的舞台状态) */
  setDancing: (on: boolean) => void;
  dancing: boolean;
  /** 放一小会儿彩屑庆祝 */
  celebrate: () => void;
  /** 对话进行中时地标互动先不回灌,免得打断她说话 */
  busy: boolean;
  /** 当前场景(地标从这里查) */
  def?: WorldDef;
}

function load(): GameState {
  try { return parseGameState(JSON.parse(localStorage.getItem(STORE_KEY) || 'null')); } catch { return parseGameState(null); }
}

export function useWorldGame(opts: UseWorldGameOptions) {
  const [state, setState] = useState<GameState>(() => parseGameState(null));
  const stateRef = useRef(state);
  const [zone, setZone] = useState<ZoneId | null>(null);
  const zoneRef = useRef<ZoneId | null>(null);
  const [toasts, setToasts] = useState<GameToast[]>([]);
  const [overview, setOverview] = useState(false);
  const overviewRef = useRef(false);
  const setOverviewState = useCallback((on: boolean) => { overviewRef.current = on; setOverview(on); }, []);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const toastId = useRef(0);
  const pokeCount = useRef(0);
  const pokeTimes = useRef<number[]>([]);
  const emotionTimer = useRef<number | null>(null);
  const overviewTimer = useRef<number | null>(null);

  // 读本机进度放到挂载后:SSR 时没有 localStorage;再和服务端的进度合并(换设备也接得上)
  const saveTimer = useRef<number | null>(null);
  const remoteOk = useRef(false);
  useEffect(() => {
    const s = load();
    stateRef.current = s;
    setState(s);
    let alive = true;
    getPlazaProgress().then((r) => {
      // 回包形状不对(服务没上线)就当没有服务端,只用本机进度
      if (!alive || !r || typeof r.exists !== 'boolean') return;
      remoteOk.current = true;
      if (!r.exists) { void savePlazaProgress(stateRef.current).catch(() => {}); return; }
      const merged = mergeGameStates(stateRef.current, parseGameState(r.progress));
      stateRef.current = merged;
      setState(merged);
      try { localStorage.setItem(STORE_KEY, JSON.stringify(merged)); } catch { /* ignore */ }
    }).catch(() => { /* 服务端不可用:只用本机进度 */ });
    return () => { alive = false; };
  }, []);
  /** 存本机 + 2 秒防抖存服务端 */
  const persist = useCallback((s: GameState) => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* 隐私模式 */ }
    if (!remoteOk.current) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { void savePlazaProgress(stateRef.current).catch(() => {}); }, 2000);
  }, []);

  const toast = useCallback((icon: string, text: string, tone: GameToast['tone'] = 'info') => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, icon, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const flashEmotion = useCallback((name: string, ms = 2200) => {
    const h = optsRef.current.handle;
    if (!h) return;
    h.setEmotion({ [name]: 0.9 });
    if (emotionTimer.current) window.clearTimeout(emotionTimer.current);
    emotionTimer.current = window.setTimeout(() => optsRef.current.handle?.setEmotion({}), ms);
  }, []);

  /** 记一笔,顺便处理任务完成 / 升级的反馈 */
  const record = useCallback((e: GameEvent) => {
    const step = applyGameEvent(stateRef.current, e);
    stateRef.current = step.state;
    setState(step.state);
    persist(step.state);
    const h = optsRef.current.handle;
    for (const q of step.completed) {
      toast(q.emoji, `任务完成:${q.label} +${QUEST_XP} 经验`, 'quest');
      h?.floatText(`${q.emoji} 任务完成!`, '#9dffcb');
    }
    if (step.levelUp) {
      const lv = levelOf(step.state.xp);
      toast('⬆️', `升到 ${lv.level} 级 · ${lv.title}`, 'level');
      h?.floatText(`Lv.${lv.level}!`, '#ffc93d');
      h?.setAction('clap');
      flashEmotion('happy');
      optsRef.current.celebrate();
    } else if (step.completed.length) {
      h?.setAction('clap');
      flashEmotion('happy');
    }
    return step;
  }, [toast, flashEmotion, persist]);

  const stopOverview = useCallback(() => {
    if (overviewTimer.current) { window.clearTimeout(overviewTimer.current); overviewTimer.current = null; }
    optsRef.current.handle?.setOverview(false);
    setOverviewState(false);
  }, [setOverviewState]);

  const toggleOverview = useCallback(() => {
    const h = optsRef.current.handle;
    if (!h) return;
    if (overviewTimer.current) { window.clearTimeout(overviewTimer.current); overviewTimer.current = null; }
    // 副作用不能放进 setState 的 updater(StrictMode 下会跑两遍)
    const on = !overviewRef.current;
    h.setOverview(on);
    setOverviewState(on);
  }, [setOverviewState]);

  /** 在当前地标互动(F 键 / 提示卡按钮) */
  const interact = useCallback(() => {
    const id = zoneRef.current;
    const o = optsRef.current;
    const h = o.handle;
    if (!id || !h) return;
    const z = findZone(o.def ?? DEFAULT_WORLD, id);
    if (!z) return;
    record({ kind: 'interact', zone: id });
    switch (zoneProp(z)) {
      case 'dance':
        o.setDancing(!o.dancing);
        if (!o.dancing) { h.floatText('🎶 一起跳!', '#ff9be8'); o.celebrate(); }
        return;
      case 'stars':
        setOverviewState(true);
        h.setOverview(true);
        if (overviewTimer.current) window.clearTimeout(overviewTimer.current);
        overviewTimer.current = window.setTimeout(() => { overviewTimer.current = null; stopOverview(); }, 6000);
        break;
      case 'wish':
        h.floatText('🌟 愿望已送达', '#9be8ff');
        h.setAction('pray');
        break;
      default:
        // 感悟地标:她停下来想一想;其它地标:指一下
        h.setAction(zoneFeed(z) === 'insight' ? 'think' : 'point');
    }
    if (z.prompt) {
      if (o.busy) { toast('⏳', '她还在说话,等她说完再试'); return; }
      o.sendText(z.prompt);
    }
  }, [record, stopOverview, toast, setOverviewState]);

  const onWorldEvent = useCallback((e: WorldEvent) => {
    const h = optsRef.current.handle;
    switch (e.type) {
      case 'orb':
        record({ kind: 'orb', golden: e.golden });
        if (e.golden) flashEmotion('happy', 1500); // 只笑一下:边走边举双臂欢呼很别扭
        break;
      case 'zone': {
        const prev = zoneRef.current;
        zoneRef.current = e.zone;
        setZone(e.zone);
        const def = optsRef.current.def ?? DEFAULT_WORLD;
        const prevZone = findZone(def, prev);
        // 离开舞池就不跳了
        if (prevZone && zoneProp(prevZone) === 'dance' && e.zone !== prev && optsRef.current.dancing) optsRef.current.setDancing(false);
        const z = findZone(def, e.zone);
        if (e.zone && z) {
          const first = !stateRef.current.visited.includes(e.zone);
          const insight = zoneFeed(z) === 'insight';
          record({ kind: 'visit', zone: e.zone, insight });
          if (first) h?.setAction(insight ? 'think' : 'wave');
        }
        break;
      }
      case 'poke': {
        const now = performance.now();
        pokeTimes.current = [...pokeTimes.current.filter((t) => now - t < 4000), now];
        const r = pokeReaction(pokeCount.current++, pokeTimes.current.length);
        h?.setAction(r.action);
        flashEmotion(r.emotion);
        h?.floatText(r.text, r.emotion === 'angry' ? '#ff8a80' : '#fff');
        record({ kind: 'poke' });
        break;
      }
      case 'interact':
        interact();
        break;
    }
  }, [record, flashEmotion, interact]);

  useEffect(() => () => {
    if (emotionTimer.current) window.clearTimeout(emotionTimer.current);
    if (overviewTimer.current) window.clearTimeout(overviewTimer.current);
    if (saveTimer.current) { window.clearTimeout(saveTimer.current); void savePlazaProgress(stateRef.current).catch(() => {}); }
  }, []);

  return {
    state, zone, toasts, overview, toast,
    /** 当前所在地标的完整信息(按当前场景查) */
    zoneInfo: findZone(opts.def ?? DEFAULT_WORLD, zone),
    level: levelOf(state.xp),
    onWorldEvent, interact, record, toggleOverview,
    goHome: () => optsRef.current.handle?.walkTo(0, 0.6),
  };
}

export type WorldGame = ReturnType<typeof useWorldGame>;

/**
 * scene-ui/useRoom.ts — 创世:每人一间房
 *
 * 房间就是一个 kind = 'room' 的 WorldDef(key = "room:<房主 uid>"),和星光广场、感悟庭院一样从场景列表里去。
 *   - 进世界就读我的房间(第一次读时服务端自动建一间书斋),列表里永远有「我的房间」;
 *   - 串门:enter(ownerId) 读那个人的房间(没开放会失败),加进列表再切过去;?room=<uid> 链接直达;
 *   - 保存设置(名字、外壳、泼溅对齐、时辰天气、开不开放)后就地刷新这个 WorldDef。
 * 摆放还是 useWorldObjects 管(场景 key 就是房间 key),这里不碰。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getMyRoom, getRoom, listPublicRooms, roomOwnerOf, roomSceneKey, updateMyRoom, visitRoom, type RoomTab,
  type RoomPatch, type WorldRoom,
} from '@/apis/world';
import { mediaUrl } from '@/lib/media';
import { WORLD_ASSET_BASE } from '../vrm/world/realKit';
import type { WorldDef } from '../vrm/world/worldLayout';

/** 泼溅文件的完整地址 */
export function splatUrlOf(file: string | undefined | null): string | undefined {
  return file ? mediaUrl(`${WORLD_ASSET_BASE}/${file}`) : undefined;
}

export function roomToDef(r: WorldRoom): WorldDef {
  const splatFile = r.template === 'splat' ? r.splat?.file : undefined;
  return {
    key: roomSceneKey(r.ownerId),
    name: r.name || `${r.owner?.nickname || '访客'}的小屋`,
    intro: r.intro || undefined,
    kind: 'room',
    stage: 'studio',
    zones: [],
    env: { time: r.palette?.time || undefined, weather: r.palette?.weather || undefined },
    room: {
      ownerId: r.ownerId,
      ownerName: r.owner?.nickname || '',
      mine: !!r.mine,
      // 泼溅还没选好 / 被删了:退回书斋,别给一间空房
      template: r.template === 'splat' && !splatFile ? 'study' : r.template,
      splatUrl: splatUrlOf(splatFile),
      splatLiteUrl: splatFile ? splatUrlOf(r.splat?.lite) : undefined,
      splatKey: r.splatKey || undefined,
      shell: r.shell,
    },
  };
}

function errMsg(e: unknown, fallback: string): string {
  const m = (e as { message?: string })?.message;
  return typeof m === 'string' && m && m.length < 60 ? m : fallback;
}

export function useRoom(enabled: boolean) {
  const [mine, setMine] = useState<WorldRoom | null>(null);
  /** 串门去过的房间(本次会话),按房主 uid */
  const [visited, setVisited] = useState<Record<string, WorldRoom>>({});
  const [publicRooms, setPublicRooms] = useState<WorldRoom[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadMine = useCallback(async () => {
    try {
      const r = await getMyRoom();
      setMine(r);
      setError(null);
      return r;
    } catch (e) {
      setError(errMsg(e, '房间读取失败'));
      return null;
    }
  }, []);
  useEffect(() => { if (enabled) void loadMine(); }, [enabled, loadMine]);

  const loadPublic = useCallback(async (tab: RoomTab = 'hot') => {
    try { setPublicRooms(await listPublicRooms(30, tab)); } catch { setPublicRooms([]); }
  }, []);

  /** 读某人的房间(串门);返回场景 key,失败抛出带原因的错误 */
  const enter = useCallback(async (ownerId: string): Promise<string> => {
    if (mine && mine.ownerId === ownerId) return roomSceneKey(ownerId);
    const r = await getRoom(ownerId);
    setVisited((v) => ({ ...v, [ownerId]: r }));
    if (!r.mine) void visitRoom(ownerId).catch(() => { /* 访客数不要紧 */ });
    return roomSceneKey(ownerId);
  }, [mine]);

  const save = useCallback(async (patch: RoomPatch): Promise<WorldRoom> => {
    const r = await updateMyRoom(patch);
    setMine(r);
    return r;
  }, []);

  const defs = useMemo(() => {
    const out: WorldDef[] = [];
    if (mine) out.push(roomToDef(mine));
    for (const r of Object.values(visited)) if (!mine || r.ownerId !== mine.ownerId) out.push(roomToDef(r));
    return out;
  }, [mine, visited]);

  /** 创世二期:房间设置变了(服务端推过来的;推给所有人时 mine 都是 false,这里按房主纠正) */
  const applyRemote = useCallback((r: WorldRoom) => {
    if (!r?.ownerId) return;
    setMine((m) => (m && m.ownerId === r.ownerId ? { ...r, mine: true } : m));
    setVisited((v) => (v[r.ownerId] ? { ...v, [r.ownerId]: { ...r, mine: false } } : v));
  }, []);

  /** 八期:换了封面(不重读房间,只改这一项) */
  const setCover = useCallback((cover: string) => { setMine((m) => (m ? { ...m, cover } : m)); }, []);

  /** 某个场景 key 对应的房间(不是房间 / 还没读过 = null) */
  const roomOf = useCallback((key: string): WorldRoom | null => {
    const owner = roomOwnerOf(key);
    if (!owner) return null;
    if (mine?.ownerId === owner) return mine;
    return visited[owner] ?? null;
  }, [mine, visited]);

  return { mine, defs, publicRooms, loadPublic, enter, save, roomOf, reload: loadMine, error, applyRemote, setCover };
}

export type RoomState = ReturnType<typeof useRoom>;

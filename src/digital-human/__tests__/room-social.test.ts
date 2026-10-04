import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { defaultStartLocal, eventWhen } from '../scene-ui/RoomSocial';
import { visitedAgo } from '../scene-ui/Genesis';
import { useRoomSocket } from '../scene-ui/useRoomSocket';
import type { RoomFrame, RoomSocket, RoomSocketStatus } from '@/lib/world/roomSocket';
import type { VrmStageHandle } from '../VrmStage';
import type { WorldDef } from '../vrm/world/worldLayout';

describe('event time text', () => {
  const now = new Date(2026, 9, 1, 15, 30);
  const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).toISOString();
  it('says today / tomorrow / date, or live', () => {
    expect(eventWhen({ startAt: at(1, 20), endAt: at(1, 21), live: false }, now)).toBe('今天 20:00');
    expect(eventWhen({ startAt: at(2, 9, 5), endAt: at(2, 10), live: false }, now)).toBe('明天 09:05');
    expect(eventWhen({ startAt: at(8, 19, 30), endAt: at(8, 21), live: false }, now)).toBe('10月8日 19:30');
    expect(eventWhen({ startAt: at(1, 15), endAt: at(1, 16), live: true }, now)).toBe('进行中');
  });
  it('defaults the form to the next whole hour', () => {
    expect(defaultStartLocal(now)).toBe('2026-10-01T16:00');
    expect(defaultStartLocal(new Date(2026, 9, 1, 23, 40))).toBe('2026-10-02T00:00');
  });
  it('says when I last visited', () => {
    const t = Date.UTC(2026, 9, 1, 12);
    expect(visitedAgo(new Date(t - 30_000).toISOString(), t)).toBe('刚去过');
    expect(visitedAgo(new Date(t - 3 * 3600_000).toISOString(), t)).toBe('上次 3 小时前');
    expect(visitedAgo(new Date(t - 2 * 86400_000).toISOString(), t)).toBe('上次 2 天前');
    expect(visitedAgo(undefined, t)).toBe('');
  });
});

describe('room socket event frame', () => {
  it('toasts when a room event starts', () => {
    let emit: (f: RoomFrame) => void = () => {};
    const sock = { join: vi.fn(), leave: vi.fn(), close: vi.fn(), say: vi.fn(), sendState: vi.fn(), voice: vi.fn(), vmute: vi.fn(), sendBinary: vi.fn() };
    const toast = vi.fn();
    const def: WorldDef = { key: 'room:1', name: 'x', kind: 'room', stage: 'studio', zones: [], room: { ownerId: '1', ownerName: '', mine: false, template: 'study' } };
    renderHook(() => useRoomSocket({
      handle: { setRoomPeers: vi.fn(), getWorldSnapshot: vi.fn(() => null) } as unknown as VrmStageHandle,
      def, enabled: true, applyEdit: vi.fn(), applyRoom: vi.fn(), onKick: vi.fn(), toast,
      makeSocket: (f: (fr: RoomFrame) => void, _s: (st: RoomSocketStatus) => void) => { emit = f; return sock as unknown as RoomSocket; },
    }));
    act(() => emit({ t: 'event', phase: 'start', event: { id: '9', title: '茶会', endAt: '' } }));
    expect(toast).toHaveBeenCalledWith('🎉', '「茶会」开始了');
  });
});

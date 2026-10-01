import { describe, expect, it } from 'vitest';
import { lodByDistance, lodIndex } from '../vrm/world/worldObjects';
import { roomToDef } from '../scene-ui/useRoom';
import { roomUsage } from '../scene-ui/RoomEditor';
import { assetBytes, type WorldPlacement, type WorldRoom } from '@/apis/world';

describe('LOD by distance', () => {
  it('picks near / mid / far by distance, later for bigger things', () => {
    expect(lodByDistance(3, 1)).toBe(0);
    expect(lodByDistance(10, 1)).toBe(1);
    expect(lodByDistance(30, 1)).toBe(2);
    // 6 米大的东西:边界放大 4 倍
    expect(lodByDistance(10, 6)).toBe(0);
    expect(lodByDistance(40, 6)).toBe(1);
  });

  it('does not flicker near a boundary', () => {
    expect(lodByDistance(8.4, 1, 0)).toBe(0); // 刚过 8 米,还在 10% 缓冲里:留在近档
    expect(lodByDistance(9, 1, 0)).toBe(1);
    expect(lodByDistance(7.6, 1, 1)).toBe(1);
    expect(lodByDistance(7, 1, 1)).toBe(0);
    expect(lodByDistance(19, 1, 2)).toBe(2);
  });

  it('maps to a file index with the quality offset', () => {
    expect(lodIndex(0, 3, 'high')).toBe(0);
    expect(lodIndex(0, 3, 'low')).toBe(1);
    expect(lodIndex(2, 3, 'low')).toBe(2);
    expect(lodIndex(2, 2, 'high')).toBe(1); // 只有两档
    expect(lodIndex(1, 0, 'high')).toBe(-1);
    expect(lodIndex(-1, 3, 'high')).toBe(0);
  });
});

const room = (over: Partial<WorldRoom>): WorldRoom => ({
  ownerId: '7', name: '', intro: '', template: 'splat', splatKey: 'u7_x',
  shell: { x: 0, y: 0, z: 0, scale: 1, rotX: 0, rotY: 0, rotZ: 0 }, palette: {}, visibility: 'public',
  version: 1, visits: 0, items: 0, mine: false, owner: { id: '7', nickname: '阿青' }, ...over,
} as WorldRoom);

describe('splat lite tier', () => {
  it('passes the lite file through to the room def', () => {
    const d = roomToDef(room({ splat: { key: 'u7_x', file: 'uploads/u7_x/src.spz', lite: 'uploads/u7_x/lite.spz' } as WorldRoom['splat'] }));
    expect(d.room?.splatUrl).toContain('/qq-media/world/uploads/u7_x/src.spz');
    expect(d.room?.splatLiteUrl).toContain('/qq-media/world/uploads/u7_x/lite.spz');
    const plain = roomToDef(room({ splat: { key: 'u7_x', file: 'uploads/u7_x/src.spz' } as WorldRoom['splat'] }));
    expect(plain.room?.splatLiteUrl).toBeUndefined();
  });
});

describe('room budget', () => {
  it('counts each asset once, by its nearest tier', () => {
    const pl = (id: string, key: string, asset: WorldPlacement['asset']): WorldPlacement => ({ id, ownerId: '1', sceneKey: 'room:1', assetKey: key, label: '', x: 0, y: 0, z: 0, rotY: 0, scale: 1, public: false, asset });
    const chair = { key: 'chair', nameZh: '椅子', status: 'ready' as const, file: 'models/chair.glb', height: 1, footprint: 0.6, bytes: 3 << 20, lods: [{ file: 'models/chair.lod0.glb', tris: 2000, bytes: 1 << 20 }] };
    const lamp = { key: 'lamp', nameZh: '灯', status: 'ready' as const, file: 'models/lamp.glb', height: 1, footprint: 0.3, bytes: 2 << 20 };
    expect(assetBytes(chair)).toBe(1 << 20);
    expect(assetBytes(lamp)).toBe(2 << 20);
    const u = roomUsage([pl('1', 'chair', chair), pl('2', 'chair', chair), pl('3', 'lamp', lamp)]);
    expect(u.n).toBe(3);
    expect(u.mb).toBeCloseTo(3);
  });
});

import { describe, expect, it } from 'vitest';
import { ROOM_SIZES, clampToWorld, roomBounds, spawnOrbs, worldEnv, type WorldDef } from '../vrm/world/worldLayout';
import { roomToDef } from '../scene-ui/useRoom';
import { colorSlotOf } from '../vrm/avatarCustomize';
import type { WorldRoom } from '@/apis/world';

const room = (over: Partial<WorldRoom> = {}): WorldRoom => ({
  ownerId: '7', name: '小屋', intro: '', template: 'study', splatKey: '', shell: { x: 0, y: 0, z: 0, scale: 1, rotX: 0, rotY: 0, rotZ: 0 },
  palette: {}, visibility: 'private', version: 1, visits: 0, items: 0, mine: true, owner: { id: '7', nickname: '阿青' }, ...over,
});

describe('roomToDef', () => {
  it('turns a room into a kind=room WorldDef keyed by owner', () => {
    const d = roomToDef(room());
    expect(d.key).toBe('room:7');
    expect(d.kind).toBe('room');
    expect(d.zones).toEqual([]);
    expect(d.room?.mine).toBe(true);
    expect(d.room?.template).toBe('study');
  });
  it('falls back to the study when a splat room has no splat file', () => {
    const d = roomToDef(room({ template: 'splat', splatKey: 'gone' }));
    expect(d.room?.template).toBe('study');
    expect(d.room?.splatUrl).toBeUndefined();
  });
  it('keeps the splat url when the file is there', () => {
    const d = roomToDef(room({ template: 'splat', splatKey: 'u7_x', splat: { key: 'u7_x', file: 'uploads/u7_x/src.spz' } as WorldRoom['splat'] }));
    expect(d.room?.template).toBe('splat');
    expect(d.room?.splatUrl).toContain('/qq-media/world/uploads/u7_x/src.spz');
  });
  it('carries time and weather into env', () => {
    const d = roomToDef(room({ palette: { time: 'dusk', weather: 'snow' } }));
    expect(worldEnv(d)).toMatchObject({ time: 'dusk', weather: 'snow', grass: false, style: 'stylized' });
  });
});

describe('room geometry', () => {
  const def: WorldDef = roomToDef(room({ template: 'courtyard' }));
  it('clamps to the room rectangle, not the plaza circle', () => {
    const b = ROOM_SIZES.courtyard;
    const p = clampToWorld(100, -100, def);
    expect(p.x).toBeLessThan(b.hx);
    expect(p.x).toBeGreaterThan(b.hx - 1);
    expect(p.z).toBeGreaterThan(-b.hz);
    expect(p.z).toBeLessThan(-b.hz + 1);
    // 房间里面的点原样返回
    expect(clampToWorld(1, 2, def)).toEqual({ x: 1, z: 2 });
  });
  it('exposes bounds only for rooms', () => {
    expect(roomBounds(def)).toEqual(ROOM_SIZES.courtyard);
    expect(roomBounds({ ...def, kind: 'plaza' })).toBeNull();
  });
  it('spawns no orbs in rooms and defaults to daytime without weather', () => {
    expect(spawnOrbs(1, 10, def)).toEqual([]);
    expect(worldEnv(roomToDef(room()))).toMatchObject({ time: 'day', weather: 'none', grass: false });
  });
});

describe('colorSlotOf', () => {
  it('sorts VRoid and MakeHuman material names into slots', () => {
    expect(colorSlotOf('N00_000_Hair_00_HAIR (Instance)', 'Hair')).toBe('hair');
    expect(colorSlotOf('Human.long01', 'Human.long01_x')).toBe('hair');
    expect(colorSlotOf('N00_000_00_Body_00_SKIN', 'Body')).toBe('skin');
    expect(colorSlotOf('Human.body', 'Human_x')).toBe('skin');
    expect(colorSlotOf('N00_000_00_EyeIris_00_EYE', 'Face')).toBe('eyes');
    expect(colorSlotOf('hanfu_top', 'hanfu_top')).toBe('outfit');
    expect(colorSlotOf('N00_001_01_Tops_01_CLOTH', 'Body')).toBe('outfit');
  });
  it('leaves lashes, brows and shoes alone', () => {
    expect(colorSlotOf('Human.eyelashes02', 'Human.eyelashes02_x')).toBeNull();
    expect(colorSlotOf('Human.eyebrow001', 'Human.eyebrow001_x')).toBeNull();
    expect(colorSlotOf('N00_000_00_Shoes_01_CLOTH', 'Body')).toBeNull();
    expect(colorSlotOf('Human.shoes02', 'Human.shoes02_x')).toBeNull();
  });
});

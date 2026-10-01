import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import * as THREE from 'three';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { createObjectLayer, type PlacedObject } from '../vrm/world/worldObjects';
import { useRoomSocket } from '../scene-ui/useRoomSocket';
import { useObjectUse } from '../scene-ui/useObjectUse';
import type { RoomFrame, RoomSocket, RoomSocketStatus } from '@/lib/world/roomSocket';
import type { VrmStageHandle } from '../VrmStage';
import type { WorldDef } from '../vrm/world/worldLayout';

vi.mock('../vrm/world/realKit', () => ({
  createRealKit: () => ({ canKtx2: false, model: async () => new THREE.Group(), modelFile: async () => new THREE.Group(), dispose: () => undefined }),
}));
const api = vi.hoisted(() => ({
  listKinds: vi.fn(async () => [
    { key: 'door', name: '门', ownerId: '0', mine: false, visibility: 'public', rules: [{ on: 'use', do: [] }] },
    { key: 'u1.thing', name: '我的机关', ownerId: '1', mine: true, visibility: 'private', rules: [] },
  ]),
  saveKind: vi.fn(async () => { throw new Error('规则有问题:第 1 条规则的条件:表达式不完整'); }),
  deleteKind: vi.fn(async () => undefined),
  switchPlacement: vi.fn(),
}));
vi.mock('@/apis/world', () => api);
import { EntityPanel, KindsDrawer } from '../scene-ui/RoomEntities';

const ent = (over: Partial<PlacedObject>): PlacedObject => ({ id: 'e1', assetKey: '', x: 0, y: 0, z: 0, rotY: 0, scale: 1, status: 'ready', ...over });

describe('entities in the object layer', () => {
  it('draws a primitive for a model-less kind, lights it from props.emits, hides it', async () => {
    const parent = new THREE.Group();
    const layer = createObjectLayer(THREE, parent, { quality: 'low' });
    const cam = new THREE.PerspectiveCamera();
    layer.set([ent({ kind: 'star', look: { shape: 'sphere', color: '#ffe27a', size: [0.2, 0.2, 0.2] }, props: { solid: false, zone: { hx: 0.3 }, emits: { color: '#ffe27a', intensity: 1.5, radius: 2 } } })]);
    layer.tick(0, 1, cam);
    const meshes: THREE.Mesh[] = [];
    parent.traverse((o) => { if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry instanceof THREE.SphereGeometry) meshes.push(o as THREE.Mesh); });
    expect(meshes).toHaveLength(1);
    const lights: THREE.PointLight[] = [];
    parent.traverse((o) => { if ((o as THREE.PointLight).isPointLight) lights.push(o as THREE.PointLight); });
    expect(lights[0].intensity).toBeCloseTo(1.5);
    expect(lights[0].distance).toBeCloseTo(2);
    expect(layer.obstacles()).toEqual([]); // 不挡人
    // 藏起来:不显示、灯灭
    layer.upsert(ent({ kind: 'star', look: { shape: 'sphere', color: '#ffe27a', size: [0.2, 0.2, 0.2] }, props: { solid: false, visible: false, emits: { color: '#ffe27a', intensity: 0, radius: 2 } } }));
    layer.tick(0.1, 0.1, cam);
    expect(layer.groupOf('e1')!.visible).toBe(false);
    expect(lights[0].intensity).toBe(0);
    layer.dispose();
  });

  it('tweens rule-driven moves and blocks walking only when solid', async () => {
    const parent = new THREE.Group();
    const layer = createObjectLayer(THREE, parent, { quality: 'high' });
    layer.set([ent({ id: 'd', kind: 'door', look: { shape: 'box', size: [0.5, 1, 0.05] }, props: { solid: true } })]);
    layer.tick(0, 1);
    await new Promise((r) => setTimeout(r, 210));
    expect(layer.obstacles()).toHaveLength(1);
    layer.upsert(ent({ id: 'd', kind: 'door', look: { shape: 'box', size: [0.5, 1, 0.05] }, props: { solid: false }, rotY: Math.PI / 2, anim: 100 }));
    expect(layer.groupOf('d')!.rotation.y).toBeCloseTo(0); // 还没开始转
    await new Promise((r) => setTimeout(r, 130));
    layer.tick(1, 0.016);
    expect(layer.groupOf('d')!.rotation.y).toBeCloseTo(Math.PI / 2);
    await new Promise((r) => setTimeout(r, 210));
    expect(layer.obstacles()).toEqual([]);
    layer.dispose();
  });
});

describe('rule frames on the room socket', () => {
  const roomDef: WorldDef = { key: 'room:1', name: 'x', kind: 'room', stage: 'studio', zones: [], room: { ownerId: '1', ownerName: '', mine: true, template: 'study' } } as unknown as WorldDef;
  it('routes fx / tp / me / ruleErr and sends use', () => {
    let emit: (f: RoomFrame) => void = () => {};
    const sock = { join: vi.fn(), leave: vi.fn(), close: vi.fn(), say: vi.fn(), sendState: vi.fn(), noteLine: vi.fn(), lines: vi.fn(), use: vi.fn(() => true) };
    const handle = { setRoomPeers: vi.fn(), setPosition: vi.fn(), getWorldSnapshot: vi.fn(() => null) } as unknown as VrmStageHandle;
    const toast = vi.fn();
    const onEntitySay = vi.fn();
    const onTravel = vi.fn();
    const { result } = renderHook(() => useRoomSocket({
      handle, def: roomDef, enabled: true, applyEdit: vi.fn(), applyRoom: vi.fn(), onKick: vi.fn(), toast, onEntitySay, onTravel,
      makeSocket: (f: (fr: RoomFrame) => void, _s: (st: RoomSocketStatus) => void) => { emit = f; return sock as unknown as RoomSocket; },
    }));
    act(() => { emit({ t: 'fx', kind: 'toast', text: '⭐ 1' }); });
    expect(toast).toHaveBeenCalledWith('✨', '⭐ 1');
    act(() => { emit({ t: 'fx', kind: 'say', text: '叮', entity: 'b1' }); });
    expect(onEntitySay).toHaveBeenCalledWith('b1', '叮');
    act(() => { emit({ t: 'tp', x: -3, y: 0, z: 2 }); });
    expect(handle.setPosition).toHaveBeenCalledWith(-3, 2);
    act(() => { emit({ t: 'tp', space: 'room:12' }); });
    expect(onTravel).toHaveBeenCalledWith('room:12');
    act(() => { emit({ t: 'me', state: { stars: 2 } }); });
    expect(result.current.myState).toEqual({ stars: 2 });
    act(() => { emit({ t: 'ruleErr', errors: ['「x」的效果 spawn 出错:没有这个原型'] }); });
    expect(toast).toHaveBeenLastCalledWith('⚠️', expect.stringContaining('没有这个原型'));
    expect(result.current.use('e9')).toBe(true);
    expect(sock.use).toHaveBeenCalledWith('e9');
  });

  it('useObjectUse hands rule entities to the server', () => {
    const use = vi.fn(() => true);
    const { result } = renderHook(() => useObjectUse({ handle: null, rs: { peers: [], use }, items: [], toast: vi.fn() }));
    act(() => { result.current.onWorldEvent({ type: 'useObject', id: 'b1', kind: 'use', point: { x: 0, y: 0, z: 0 } }); });
    expect(use).toHaveBeenCalledWith('b1');
  });
});

describe('editor', () => {
  it('lists kinds, places one, and shows server validation errors', async () => {
    const onPlace = vi.fn();
    render(<KindsDrawer onPlace={onPlace} toast={vi.fn()} />);
    await screen.findByText('门');
    fireEvent.click(screen.getAllByRole('button', { name: '放一个' })[0]);
    expect(onPlace).toHaveBeenCalledWith(expect.objectContaining({ key: 'door' }));
    fireEvent.click(screen.getByRole('button', { name: '＋ 新原型' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '存' })); });
    await screen.findByText(/表达式不完整/);
  });

  it('edits an entity\'s state, rules and tags as JSON', async () => {
    const onSave = vi.fn(async () => undefined);
    render(<EntityPanel item={{ id: 'd', kind: 'door', state: { open: false }, rules: [], tags: ['door'], props: { usable: true, solid: true } } as never} onSave={onSave} />);
    fireEvent.click(screen.getByText('属性 / 规则'));
    const boxes = screen.getAllByRole('textbox');
    fireEvent.change(boxes[0], { target: { value: '{"open": true}' } });
    fireEvent.change(boxes[2], { target: { value: 'door, front' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '存' })); });
    expect(onSave).toHaveBeenCalledWith({ state: { open: true }, rules: [], tags: ['door', 'front'] });
    fireEvent.change(boxes[1], { target: { value: '[{oops' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '存' })); });
    await waitFor(() => expect(screen.getByText(/规则的 JSON 写错了/)).toBeTruthy());
  });
});

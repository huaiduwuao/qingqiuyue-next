import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { act, renderHook } from '@testing-library/react';
import { applySitPose, guessSeatHeight, interactOf, pickSeat, seatCount, sitDrop, type SeatSpot } from '../vrm/world/interact';
import { createObjectLayer, type PlacedObject } from '../vrm/world/worldObjects';
import { useObjectUse } from '../scene-ui/useObjectUse';
import type { VrmStageHandle } from '../VrmStage';

// 模型「加载」:按 key 拼几个盒子(脚底在 0)
function box(w: number, h: number, d: number, x: number, y0: number, z: number, name = 'wood') {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ name }));
  m.position.set(x, y0 + h / 2, z);
  return m;
}
const MODELS: Record<string, () => THREE.Object3D> = {
  // 椅子:座面顶在 0.45,靠背在 -Z
  chair: () => { const g = new THREE.Group(); g.add(box(0.5, 0.06, 0.5, 0, 0.39, 0), box(0.5, 0.55, 0.06, 0, 0.45, -0.22), box(0.05, 0.39, 0.05, 0.2, 0, 0.2)); return g; },
  // 长沙发:1.8 米宽,座面 0.42,靠背在 -Z
  sofa: () => { const g = new THREE.Group(); g.add(box(1.8, 0.42, 0.8, 0, 0, 0), box(1.8, 0.4, 0.15, 0, 0.42, -0.33)); return g; },
  // 凳子:一样高,没有靠背
  stool: () => box(0.4, 0.45, 0.4, 0, 0, 0),
  lamp: () => { const g = new THREE.Group(); g.add(box(0.1, 1.2, 0.1, 0, 0, 0), box(0.4, 0.3, 0.4, 0, 1.2, 0, 'lamp_shade')); return g; },
};
vi.mock('../vrm/world/realKit', () => ({
  createRealKit: () => {
    const make = async (key: string) => MODELS[key]();
    return { canKtx2: false, model: make, modelFile: make, dispose: () => undefined };
  },
}));
vi.mock('@/apis/world', () => ({}));

describe('interactOf', () => {
  // 椅子 / 灯是什么由服务端原型数据决定(kinds_seed.json 的 match),前端只看算好的属性
  it('reads sittable / usable props', () => {
    expect(interactOf({ sittable: true })).toBe('seat');
    expect(interactOf({ usable: true })).toBe('use');
    expect(interactOf({ sittable: true, usable: true })).toBe('seat');
    expect(interactOf({})).toBeNull();
    expect(interactOf(undefined)).toBeNull();
  });
});

describe('seat helpers', () => {
  const spot = (x: number): SeatSpot => ({ x, z: 0, y: 0.45, yaw: 0, approach: { x, z: 0.6 } });
  it('picks the nearest free seat', () => {
    const spots = [spot(-0.6), spot(0), spot(0.6)];
    expect(pickSeat(spots, [], { x: 0.5, z: 0 })?.x).toBe(0.6);
    expect(pickSeat(spots, [{ x: 0.61, z: 0.02 }], { x: 0.5, z: 0 })?.x).toBe(0);
    expect(pickSeat(spots, spots.map((s) => ({ x: s.x, z: s.z })), { x: 0, z: 0 })).toBeNull();
  });
  it('counts seats and guesses heights', () => {
    expect(seatCount(0.6)).toBe(1);
    expect(seatCount(1.8)).toBe(3);
    expect(seatCount(5)).toBe(4);
    expect(guessSeatHeight(0.44)).toBeCloseTo(0.44);
    expect(guessSeatHeight(1.0)).toBeCloseTo(0.45);
    expect(guessSeatHeight(1.6)).toBeCloseTo(0.52);
    expect(sitDrop(0.9, 0.45)).toBeCloseTo(0.37);
    expect(sitDrop(0.5, 0.6)).toBe(0);
  });
  it('bends thighs forward and knees back', () => {
    const bones: Record<string, THREE.Object3D> = {};
    for (const n of ['leftUpperLeg', 'leftLowerLeg', 'spine']) bones[n] = new THREE.Object3D();
    applySitPose(THREE, (n) => bones[n], 1);
    const e = (n: string) => new THREE.Euler().setFromQuaternion(bones[n].quaternion, 'XYZ');
    expect(e('leftUpperLeg').x).toBeLessThan(-1.3); // X− = 大腿往前抬
    expect(e('leftLowerLeg').x).toBeGreaterThan(1.3); // X+ = 屈膝
    applySitPose(THREE, (n) => bones[n], 0); // 0 = 不动
    expect(e('leftUpperLeg').x).toBeLessThan(-1.3);
  });
});

const placed = (over: Partial<PlacedObject>): PlacedObject => ({ id: 'p', assetKey: 'chair', x: 0, y: 0, z: 0, rotY: 0, scale: 1, status: 'ready', interact: 'seat', ...over });
async function layerWith(list: PlacedObject[]) {
  const parent = new THREE.Group();
  const layer = createObjectLayer(THREE, parent, { quality: 'high' });
  layer.set(list);
  await new Promise((r) => setTimeout(r, 0));
  layer.tick(0, 1);
  parent.updateMatrixWorld(true);
  return { layer, parent };
}

describe('seat spots', () => {
  it('finds the seat height and faces away from the back', async () => {
    const { layer } = await layerWith([placed({ id: 'c', x: 2, z: 1 })]);
    const [s] = layer.seatSpots('c', { x: 0, z: 0 });
    expect(s.y).toBeCloseTo(0.45, 2);
    expect(s.yaw).toBeCloseTo(0); // 靠背在 -Z → 面朝 +Z
    expect(s.approach.z).toBeGreaterThan(1.5);
    expect(s.x).toBeCloseTo(2);
  });
  it('turns with the chair', async () => {
    const { layer } = await layerWith([placed({ id: 'c', rotY: Math.PI / 2 })]);
    const [s] = layer.seatSpots('c', { x: 0, z: 0 });
    expect(Math.abs(Math.atan2(Math.sin(s.yaw - Math.PI / 2), Math.cos(s.yaw - Math.PI / 2)))).toBeLessThan(1e-6);
    expect(s.approach.x).toBeGreaterThan(0.5);
  });
  it('spreads seats along a sofa', async () => {
    const { layer } = await layerWith([placed({ id: 's', assetKey: 'sofa' })]);
    const spots = layer.seatSpots('s', { x: 0, z: 3 });
    expect(spots).toHaveLength(3);
    expect(spots.every((p) => Math.abs(p.y - 0.42) < 0.01)).toBe(true);
    expect(spots[0].x).toBeLessThan(spots[2].x);
  });
  it('a stool faces whoever walks up', async () => {
    const { layer } = await layerWith([placed({ id: 't', assetKey: 'stool' })]);
    expect(layer.seatSpots('t', { x: 0, z: -3 })[0].yaw).toBeCloseTo(Math.PI);
    expect(layer.seatSpots('t', { x: 0, z: 3 })[0].yaw).toBeCloseTo(0);
    expect(layer.seatSpots('t', { x: 0, z: 3 })[0].y).toBeCloseTo(0.45, 2);
  });
  it('only seats have spots', async () => {
    const { layer } = await layerWith([placed({ id: 'l', assetKey: 'lamp', interact: 'use', props: { emits: { color: '#ffc98a', intensity: 6, radius: 7 }, usable: true } })]);
    expect(layer.seatSpots('l', { x: 0, z: 0 })).toEqual([]);
  });
});

describe('lamps', () => {
  // 灯 = lamp 原型的实体:亮不亮看算好的 emits.intensity(开关是规则改状态 on)
  it('lights the nearest lamps from a fixed pool and follows on / off', async () => {
    const parent = new THREE.Group();
    const layer = createObjectLayer(THREE, parent, { quality: 'low' });
    const cam = new THREE.PerspectiveCamera();
    cam.position.set(0, 1.6, 4);
    layer.set([placed({ id: 'l1', assetKey: 'lamp', interact: 'use', x: 0, props: { emits: { color: '#ffc98a', intensity: 6, radius: 7 }, usable: true } }), placed({ id: 'l2', assetKey: 'lamp', interact: 'use', x: 6, props: { emits: { color: '#ffc98a', intensity: 6, radius: 7 }, usable: true } })]);
    await new Promise((r) => setTimeout(r, 0));
    layer.tick(0, 1, cam);
    const lights: THREE.PointLight[] = [];
    parent.traverse((o) => { if ((o as THREE.PointLight).isPointLight) lights.push(o as THREE.PointLight); });
    expect(lights).toHaveLength(1); // 流畅画质一个
    expect(lights[0].intensity).toBeGreaterThan(0);
    expect(lights[0].getWorldPosition(new THREE.Vector3()).x).toBeCloseTo(0, 1); // 离镜头近的那盏
    let shade: THREE.MeshStandardMaterial | null = null;
    parent.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (m?.name === 'lamp_shade' && o.parent?.parent?.userData.placementId === 'l1') shade = m; });
    expect(shade!.emissiveIntensity).toBeGreaterThan(1);
    // 关掉 l1:光源让给 l2,灯罩不亮了
    layer.upsert(placed({ id: 'l1', assetKey: 'lamp', interact: 'use', x: 0, props: { emits: { color: '#ffc98a', intensity: 0, radius: 7 }, usable: true } }));
    layer.tick(0.1, 0.1, cam);
    expect(lights[0].getWorldPosition(new THREE.Vector3()).x).toBeCloseTo(6, 1);
    expect(shade!.emissiveIntensity).toBe(1);
    // 两盏都关:光源熄灭,数量不变
    layer.upsert(placed({ id: 'l2', assetKey: 'lamp', interact: 'use', x: 6, props: { emits: { color: '#ffc98a', intensity: 0, radius: 7 }, usable: true } }));
    layer.tick(0.2, 0.1, cam);
    let n = 0;
    parent.traverse((o) => { if ((o as THREE.PointLight).isPointLight) n++; });
    expect(n).toBe(1);
    expect(lights[0].intensity).toBe(0);
  });
});

describe('useObjectUse', () => {
  function fakeHandle() {
    let pos = { x: 0, z: 3 };
    let sitting: SeatSpot | null = null;
    const spots: SeatSpot[] = [{ x: 0, z: 0, y: 0.45, yaw: 0, approach: { x: 0, z: 0.6 } }, { x: 0.6, z: 0, y: 0.45, yaw: 0, approach: { x: 0.6, z: 0.6 } }];
    const h = {
      getPosition: () => pos,
      seatSpots: vi.fn(() => spots),
      walkTo: vi.fn((x: number, z: number) => { pos = { x, z }; }),
      sitAt: vi.fn((s: SeatSpot) => { sitting = s; pos = { x: s.x, z: s.z }; }),
      standUp: vi.fn(() => { if (sitting) pos = sitting.approach; sitting = null; }),
      sitting: () => sitting,
    };
    return h;
  }
  it('walks to a free seat, sits, and stands up when clicked again', async () => {
    vi.useFakeTimers();
    const h = fakeHandle();
    const toast = vi.fn();
    const { result } = renderHook(() => useObjectUse({ handle: h as unknown as VrmStageHandle, rs: { peers: [{ id: '7', nickname: '', look: { base: '', params: {}, version: 0 }, x: 0, y: 0.45, z: 0, yaw: 0, a: 'sit' }] }, items: [], toast }));
    act(() => { result.current.onWorldEvent({ type: 'useObject', id: 'sofa', kind: 'seat', point: { x: 0, y: 0.4, z: 0 } }); });
    // 0 号座位有人坐:去 0.6 那个
    expect(h.walkTo).toHaveBeenCalledWith(0.6, 0.6);
    await act(async () => { vi.advanceTimersByTime(150); });
    expect(h.sitAt).toHaveBeenCalledWith(expect.objectContaining({ x: 0.6 }));
    expect(result.current.sittingOn).toBe('sofa');
    act(() => { result.current.onWorldEvent({ type: 'useObject', id: 'sofa', kind: 'seat', point: { x: 0.6, y: 0.4, z: 0 } }); });
    expect(h.standUp).toHaveBeenCalled();
    expect(result.current.sittingOn).toBeNull();
    expect(result.current.onWorldEvent({ type: 'poke' })).toBe(false);
    vi.useRealTimers();
  });
  it('hands usable things to the server, and sits + uses things that are both', () => {
    const h = fakeHandle();
    const use = vi.fn(() => true);
    const { result } = renderHook(() => useObjectUse({ handle: h as unknown as VrmStageHandle, rs: { peers: [], use }, items: [{ id: 'swing', props: { sittable: true, usable: true } } as never], toast: vi.fn() }));
    act(() => { result.current.onWorldEvent({ type: 'useObject', id: 'l', kind: 'use', point: { x: 0, y: 1, z: 0 } }); });
    expect(use).toHaveBeenCalledWith('l');
    act(() => { result.current.onWorldEvent({ type: 'useObject', id: 'swing', kind: 'seat', point: { x: 0, y: 0.4, z: 0 } }); });
    expect(use).toHaveBeenLastCalledWith('swing');
    expect(h.walkTo).toHaveBeenCalled();
  });

});

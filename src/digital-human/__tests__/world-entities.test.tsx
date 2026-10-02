import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import * as THREE from 'three';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { createObjectLayer, type PlacedObject } from '../vrm/world/worldObjects';
import { setMaterials } from '../vrm/world/materials';
import { fxSoundAt, useRoomSocket } from '../scene-ui/useRoomSocket';
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
  getSpaceRules: vi.fn(async () => ({ rules: [{ on: 'join', do: [{ toast: { text: '欢迎', to: 'actor' } }] }], state: { visits: 0 } })),
  saveSpaceRules: vi.fn(async (p: { rules: unknown[]; state: unknown }) => p),
  composeWorld: vi.fn(async () => ({ explain: '只有房主能开', rules: [{ on: 'use', if: 'actor.isOwner', do: [{ toggle: 'open' }] }], tags: ['mine'] })),
  switchPlacement: vi.fn(),
  listSounds: vi.fn(async () => []),
  getSound: vi.fn(async () => { throw new Error('not found'); }),
}));
vi.mock('@/apis/world', () => api);
import { EntityPanel, KindsDrawer, SpaceRulesPanel } from '../scene-ui/RoomEntities';
import { RuleListForm, effectKind, formable } from '../scene-ui/RuleForm';
import { ChoiceCard, InsightCard } from '../scene-ui/LifeSceneCards';

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

  it('draws an entity with a block material look', () => {
    setMaterials([{ id: 4, key: 'glass', name: '玻璃', color: '#bfe6ff', look: { opacity: 0.35 } }]);
    const parent = new THREE.Group();
    const layer = createObjectLayer(THREE, parent, { quality: 'low' });
    layer.set([ent({ id: 'g', kind: 'u1.window', look: { shape: 'box', size: [0.5, 0.5, 0.05], material: 4 } })]);
    const meshes: THREE.Mesh[] = [];
    parent.traverse((x) => { if ((x as THREE.Mesh).isMesh && (x as THREE.Mesh).geometry instanceof THREE.BoxGeometry) meshes.push(x as THREE.Mesh); });
    const m = meshes[0].material as THREE.MeshStandardMaterial;
    expect(m.transparent).toBe(true);
    expect(m.opacity).toBeCloseTo(0.35);
    expect('#' + m.color.getHexString()).toBe('#bfe6ff');
    layer.dispose();
  });

  it('lets glowing blocks share the light pool with lamps, nearest first', () => {
    const parent = new THREE.Group();
    const layer = createObjectLayer(THREE, parent, { quality: 'low' });
    const cam = new THREE.PerspectiveCamera();
    cam.position.set(0, 1.6, 4);
    layer.set([ent({ id: 'far', kind: 'star', x: 30, look: { shape: 'sphere', size: [0.2, 0.2, 0.2] }, props: { emits: { color: '#ffffff', intensity: 2, radius: 2 } } })]);
    layer.setExtraLights([{ x: 1, y: 0.5, z: 2, color: 0xff0000, intensity: 4, radius: 5 }]);
    layer.tick(0, 1, cam);
    const lights: THREE.PointLight[] = [];
    parent.traverse((o) => { if ((o as THREE.PointLight).isPointLight) lights.push(o as THREE.PointLight); });
    expect(lights).toHaveLength(1); // 流畅画质一个光源:给离镜头近的那簇积木
    expect(lights[0].color.getHex()).toBe(0xff0000);
    expect(lights[0].intensity).toBe(4);
    expect(lights[0].position.x).toBe(1);
    layer.setExtraLights([]);
    layer.tick(0.1, 0.1, cam);
    expect(lights[0].color.getHex()).toBe(0xffffff); // 积木拆了:光源回到那颗星星
    layer.dispose();
  });

  it('finds movable entities in front of you', async () => {
    const parent = new THREE.Group();
    const layer = createObjectLayer(THREE, parent, { quality: 'low' });
    layer.set([
      ent({ id: 'c', kind: 'crate', z: 2, look: { shape: 'box', size: [0.25, 0.25, 0.25] }, props: { solid: true, movable: true } }),
      ent({ id: 'w', kind: 'wall', x: 3, look: { shape: 'box', size: [0.5, 0.5, 0.5] }, props: { solid: true } }),
    ]);
    layer.tick(0, 1);
    await new Promise((r) => setTimeout(r, 210));
    expect(layer.movableAt(0, 2.3)).toBe('c');
    expect(layer.movableAt(3, 0)).toBeNull(); // 墙不是 movable
    expect(layer.movableAt(0, 3)).toBeNull();
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
    const sock = { join: vi.fn(), leave: vi.fn(), close: vi.fn(), say: vi.fn(), sendState: vi.fn(), noteLine: vi.fn(), lines: vi.fn(), use: vi.fn(() => true), choose: vi.fn(() => true), reflect: vi.fn(() => true) };
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
    act(() => { emit({ t: 'breath', left: 7, max: 10 }); });
    expect(result.current.breath).toEqual({ left: 7, max: 10 });
    act(() => { emit({ t: 'breath', left: -1 }); });
    expect(result.current.breath).toBeNull();
    act(() => { emit({ t: 'ruleErr', errors: ['「x」的效果 spawn 出错:没有这个原型'] }); });
    expect(toast).toHaveBeenLastCalledWith('⚠️', expect.stringContaining('没有这个原型'));
    expect(result.current.use('e9')).toBe(true);
    expect(sock.use).toHaveBeenCalledWith('e9');
    // 人生场景:出题 → 回答(收起)→ 感悟;到点按默认算的 chosen 也收起
    act(() => { emit({ t: 'choose', id: 'c1', text: '他转身要走,你……', options: [{ label: '叫住他' }, { label: '什么也不说' }], wait: 5000, default: 1 }); });
    expect(result.current.question?.options.length).toBe(2);
    act(() => { result.current.answer('c1', 0); });
    expect(sock.choose).toHaveBeenCalledWith('c1', 0);
    expect(result.current.question).toBeNull();
    act(() => { emit({ t: 'choose', id: 'c2', text: '?', options: [{ label: 'a' }] }); });
    act(() => { emit({ t: 'chosen', id: 'c1', index: 0 }); });
    expect(result.current.question?.id).toBe('c2'); // 别的题的 chosen 不动这道
    act(() => { emit({ t: 'chosen', id: 'c2', index: -1, auto: true }); });
    expect(result.current.question).toBeNull();
    act(() => { emit({ t: 'insight', text: '目送也是一种告别', axis: 'silence', feel: '目送', path: true }); });
    expect(result.current.insight).toMatchObject({ text: '目送也是一种告别', axis: 'silence', path: true });
    act(() => { result.current.dismissInsight(); });
    expect(result.current.insight).toBeNull();
    // 留给人推理:进来只知道藏着几样;发现一样;场景反问,自己写
    act(() => { emit({ t: 'found', count: 0, total: 3 }); });
    expect(result.current.explore).toEqual({ count: 0, total: 3 });
    expect(result.current.found).toBeNull();
    act(() => { emit({ t: 'found', count: 1, total: 3, key: '信', text: '抽屉里有一封信' }); });
    expect(result.current.explore).toEqual({ count: 1, total: 3 });
    expect(result.current.found).toMatchObject({ key: '信', text: '抽屉里有一封信' });
    act(() => { emit({ t: 'reflect', id: 'q1', text: '那一刻,你在想什么?' }); });
    expect(result.current.asked).toEqual({ id: 'q1', text: '那一刻,你在想什么?' });
    act(() => { result.current.answerReflect('q1', '想他', true); });
    expect(sock.reflect).toHaveBeenCalledWith('q1', '想他', true);
    act(() => { emit({ t: 'reflected', id: 'q1', path: true }); });
    expect(result.current.asked).toBeNull();
    expect(toast).toHaveBeenLastCalledWith('✍️', '记在你的心路上了');
    // 回声:选完以后,别人怎么选(按题的选项排,标出自己)
    act(() => { emit({ t: 'choose', id: 'c9', text: '往哪走?', options: [{ label: '左' }, { label: '右' }, { label: '原地' }] }); });
    act(() => { emit({ t: 'echo', id: 'c9', total: 3, counts: { 左: 2, 右: 1 }, mine: '右' }); });
    expect(result.current.echo).toEqual({ id: 'c9', text: '往哪走?', total: 3, rows: [{ label: '左', n: 2, mine: false }, { label: '右', n: 1, mine: true }, { label: '原地', n: 0, mine: false }] });
    act(() => { emit({ t: 'echoLines', id: 'q1', lines: ['像小时候'], total: 4, shared: true }); });
    expect(result.current.echoLines).toEqual({ id: 'q1', lines: ['像小时候'], total: 4, shared: true });
    act(() => { result.current.dismissEchoLines(); emit({ t: 'echoLines', id: 'q2', lines: [], total: 0, shared: false }); });
    expect(result.current.echoLines).toBeNull(); // 没人留过、自己也没分享:不弹
  });

  it('draws the choice card and the insight card', () => {
    const onAnswer = vi.fn();
    const { unmount } = render(<ChoiceCard q={{ id: 'c1', text: '明早的车,你……', options: [{ label: '回去', axis: 'spine' }, { label: '不回' }], wait: 3000, at: Date.now() }} onAnswer={onAnswer} />);
    expect(screen.queryByText(/底气/)).toBeNull(); // 选项不标维度
    expect(screen.getByText('不选,也是一种选择。')).toBeTruthy();
    fireEvent.click(screen.getByText('不回'));
    expect(onAnswer).toHaveBeenCalledWith(1);
    unmount();
    const onClose = vi.fn();
    render(<InsightCard insight={{ text: '留下的人,也在用自己的方式回家。', axis: 'edge', feel: '坚持', path: true, at: 1 }} onClose={onClose} />);
    expect(screen.getByText('坚持 · 偏向棱角')).toBeTruthy();
    expect(screen.getByText('已记在你的心路上 →').getAttribute('href')).toBe('/insight/path');
    fireEvent.click(screen.getByLabelText('收起'));
    expect(onClose).toHaveBeenCalled();
  });

  it('places rule sounds: the entity if it is still here, else the server\'s at, else nowhere', () => {
    const positionOf = (id: string) => (id === 'bell' ? { x: 1, y: 0.5, z: 2 } : null);
    expect(fxSoundAt({ entity: 'bell', at: { x: 9, y: 9, z: 9 } }, positionOf)).toEqual({ x: 1, y: 0.5, z: 2 });
    expect(fxSoundAt({ entity: 'gone', at: { x: 9, y: 0, z: 9 } }, positionOf)).toEqual({ x: 9, y: 0, z: 9 });
    expect(fxSoundAt({ at: { x: -3, y: 8, z: 0 } }, positionOf)).toEqual({ x: -3, y: 8, z: 0 }); // 空间规则:触发的人 / 写的坐标
    expect(fxSoundAt({}, positionOf)).toBeNull(); // 背景音乐
  });

  it('useObjectUse hands pushes to the room socket', () => {
    const push = vi.fn(() => true);
    const { result } = renderHook(() => useObjectUse({ handle: null, rs: { peers: [], push }, items: [], toast: vi.fn() }));
    act(() => { result.current.onWorldEvent({ type: 'push', id: 'c', dx: 0, dz: -1 }); });
    expect(push).toHaveBeenCalledWith('c', 0, -1);
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

  it('edits an entity\'s state (JSON), rules (form) and tags, and takes an AI draft', async () => {
    const onSave = vi.fn(async () => undefined);
    render(<EntityPanel item={{ id: 'd', kind: 'door', state: { open: false }, rules: [], tags: ['door'], props: { usable: true, solid: true } } as never} onSave={onSave} />);
    fireEvent.click(screen.getByText('属性 / 规则'));
    // 文本框:AI 那句话、原型、状态、标签(规则是表单,没有规则时没有文本框)
    const boxes = screen.getAllByRole('textbox');
    fireEvent.change(boxes[2], { target: { value: '{"open": true}' } });
    fireEvent.blur(boxes[2]);
    fireEvent.change(boxes[3], { target: { value: 'door, front' } });
    // 表单里加一条规则:被点 → 开 / 关
    fireEvent.click(screen.getByRole('button', { name: '＋ 加一条规则' }));
    fireEvent.change(screen.getByLabelText('加一个效果'), { target: { value: 'toggle' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '存' })); });
    expect(onSave).toHaveBeenCalledWith({ state: { open: true }, rules: [{ on: 'use', do: [{ toggle: 'open' }] }], tags: ['door', 'front'] });
    // 状态 JSON 写错:就地提示,不存
    fireEvent.change(boxes[2], { target: { value: '{oops' } });
    fireEvent.blur(boxes[2]);
    await waitFor(() => expect(screen.getByText(/JSON 写错了/)).toBeTruthy());
    // 一句话交给 AI:草稿填进编辑器(没存),人再点存
    fireEvent.change(boxes[0], { target: { value: '只有我能开' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '写' })); });
    await screen.findByText(/只有房主能开/);
    expect(api.composeWorld).toHaveBeenCalledWith('只有我能开', 'entity', expect.objectContaining({ kind: 'door' }));
    onSave.mockClear();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '存' })); });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ rules: [{ on: 'use', if: 'actor.isOwner', do: [{ toggle: 'open' }] }], tags: ['door', 'front', 'mine'] }));
  });

});

describe('rule form', () => {
  it('knows which effects it can draw and keeps the rest as JSON', () => {
    expect(effectKind({ if: 'x', then: [] })).toBe('if');
    expect(formable({ set: { open: 'true', target: 'actor' } })).toBe(true);
    expect(formable({ say: 'hi' })).toBe(true);
    expect(formable({ toast: { text: 'a', to: 'actor' } })).toBe(true);
    expect(formable({ teleport: { to: 'tag:x', target: 'actor' } })).toBe(false); // 表单没有 target 这一格
    expect(formable({ fly: 1 })).toBe(false);
    expect(formable({ sound: { name: 'amb_bell', at: { x: 1, y: 'actor.pos.y + 3', z: 0 } } })).toBe(true);
    expect(formable({ water: { rise: 0.2, material: '熔岩', at: 'actor' } })).toBe(true);
    expect(formable({ choose: { text: '?', wait: 5000, default: 1, options: [{ label: 'a', axis: 'spine', do: [] }, { label: 'b' }] } })).toBe(true);
    expect(formable({ choose: { text: '?', options: [{ label: 'a', to: 'x' }] } })).toBe(false);
    expect(formable({ insight: { text: '一句话', axis: 'heart', feel: '遗憾' } })).toBe(true);
  });

  it('edits a choice: options with axes, a default, nested effects', () => {
    let rules: { on: string; do: Record<string, unknown>[] }[] = [{ on: 'use', do: [] }];
    const rr = () => <RuleListForm rules={rules} scope="kind" onChange={(r) => { rules = r as typeof rules; }} />;
    const { rerender } = render(rr());
    fireEvent.change(screen.getAllByLabelText('加一个效果')[0], { target: { value: 'choose' } });
    rerender(rr());
    const ch = () => rules[0].do[0].choose as { options: { label: string; axis?: string; do?: unknown[] }[]; default?: number };
    expect(ch().options.map((o) => o.axis)).toEqual(['spine', 'silence']);
    fireEvent.change(screen.getByLabelText('选项 2 的维度'), { target: { value: 'smile' } });
    rerender(rr());
    expect(ch().options[1].axis).toBe('smile');
    fireEvent.change(screen.getByLabelText('到点没选'), { target: { value: '1' } });
    rerender(rr());
    expect(ch().default).toBe(1);
    // 选项 1 选了以后:加一句感悟
    fireEvent.change(screen.getAllByLabelText('加一个效果')[0], { target: { value: 'insight' } });
    rerender(rr());
    expect(ch().options[0].do).toEqual([{ insight: { text: '有些话,当时不说,就再也没有机会了' } }]);
    fireEvent.click(screen.getByText('＋ 再加一个选项'));
    rerender(rr());
    expect(ch().options.length).toBe(3);
    fireEvent.click(screen.getByLabelText('删掉选项 3'));
    expect(ch().options.length).toBe(2);
  });

  it('edits where a sound comes from and a water effect', () => {
    let rules: { on: string; do: Record<string, unknown>[] }[] = [{ on: 'use', do: [{ sound: 'amb_bell' }] }];
    const { rerender } = render(<RuleListForm rules={rules} scope="kind" onChange={(r) => { rules = r as typeof rules; }} />);
    const from = screen.getByLabelText('从哪儿传来') as HTMLSelectElement;
    fireEvent.change(from, { target: { value: 'none' } });
    expect(rules[0].do[0]).toEqual({ sound: { name: 'amb_bell', at: 'none' } });
    rerender(<RuleListForm rules={rules} scope="kind" onChange={(r) => { rules = r as typeof rules; }} />);
    fireEvent.change(screen.getByLabelText('从哪儿传来'), { target: { value: '__xyz' } });
    expect(rules[0].do[0]).toEqual({ sound: { name: 'amb_bell', at: { x: 'actor.pos.x', y: 3, z: 'actor.pos.z' } } });
    rerender(<RuleListForm rules={rules} scope="kind" onChange={(r) => { rules = r as typeof rules; }} />);
    fireEvent.change(screen.getByLabelText('从哪儿传来'), { target: { value: '' } });
    expect(rules[0].do[0]).toEqual({ sound: 'amb_bell' }); // 回到简写
    rerender(<RuleListForm rules={rules} scope="kind" onChange={(r) => { rules = r as typeof rules; }} />);
    fireEvent.change(screen.getAllByLabelText('加一个效果')[0], { target: { value: 'water' } });
    expect(rules[0].do[1]).toEqual({ water: { rise: 0.2 } });
    rerender(<RuleListForm rules={rules} scope="kind" onChange={(r) => { rules = r as typeof rules; }} />);
    fireEvent.change(screen.getByLabelText('抽掉'), { target: { value: 'true' } });
    expect(rules[0].do[1]).toEqual({ water: { rise: 0.2, drain: 'true' } });
  });

  it('edits nested effects and custom events', () => {
    let rules: { on: string; if?: string; do: Record<string, unknown>[] }[] = [{ on: 'my-signal', do: [{ wait: { ms: 1000, do: [] } }, { teleport: { to: 'tag:x', target: 'actor' } }] }];
    const { rerender } = render(<RuleListForm rules={rules} scope="kind" onChange={(r) => { rules = r as typeof rules; }} />);
    // 自定义事件名显示在输入框里
    expect(screen.getByDisplayValue('my-signal')).toBeTruthy();
    // 认不出的效果显示成 JSON
    expect(screen.getByDisplayValue(JSON.stringify({ teleport: { to: 'tag:x', target: 'actor' } }))).toBeTruthy();
    // wait 里面再加一个效果
    const adds = screen.getAllByLabelText('加一个效果');
    fireEvent.change(adds[0], { target: { value: 'say' } }); // 第一个是 wait 里面的
    expect(rules[0].do[0]).toEqual({ wait: { ms: 1000, do: [{ say: '你好' }] } });
    rerender(<RuleListForm rules={rules} scope="kind" onChange={(r) => { rules = r as typeof rules; }} />);
    // 点「只有房主」填条件
    fireEvent.click(screen.getByRole('button', { name: '只有房主' }));
    expect(rules[0].if).toBe('actor.isOwner');
  });

  it('space rules: loads, edits and saves', async () => {
    const toast = vi.fn();
    render(<SpaceRulesPanel toast={toast} />);
    fireEvent.click(screen.getByText(/整间房的规则/));
    await screen.findByDisplayValue('欢迎');
    // 空间能选的事件里有「有人进了房间」,没有「被点」
    const ev = screen.getByLabelText('事件') as HTMLSelectElement;
    const opts = Array.from(ev.options).map((o) => o.textContent);
    expect(opts).toContain('有人进了房间');
    expect(opts).not.toContain('被点');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '存' })); });
    expect(api.saveSpaceRules).toHaveBeenCalledWith({ rules: [{ on: 'join', do: [{ toast: { text: '欢迎', to: 'actor' } }] }], state: { visits: 0 } });
    expect(toast).toHaveBeenCalled();
  });
});

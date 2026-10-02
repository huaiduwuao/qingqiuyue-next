import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import * as THREE from 'three';
import { act, fireEvent, render, screen } from '@testing-library/react';

vi.mock('../vrm/world/realKit', () => ({
  createRealKit: () => ({ canKtx2: false, model: async () => new THREE.Group(), modelFile: async () => new THREE.Group(), dispose: () => undefined }),
}));
vi.mock('@/apis/world', () => ({
  composeWorld: vi.fn(),
  listSounds: vi.fn(async () => []),
  getSound: vi.fn(async () => { throw new Error('not found'); }),
  worldFileUrl: (p: string) => p,
}));
import { createPeerLayer, type RoomPeer } from '../vrm/world/peerAvatars';
import { createObjectLayer, type PlacedObject } from '../vrm/world/worldObjects';
import { EntityPanel } from '../scene-ui/RoomEntities';
import { formable, RuleListForm } from '../scene-ui/RuleForm';
import { EchoCard, EchoLinesCard, FoundCounter, ReflectCard } from '../scene-ui/ExploreCards';

const look = { base: '/none.vrm', params: {}, version: 1 };

describe('characters played by digital humans', () => {
  it('clicking a character body picks the entity it plays; others are just people', () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    // jsdom 没有 2D canvas:名牌 / 气泡的文字精灵给一个什么都不画的上下文
    const ctx2d = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : () => undefined), set: () => true });
    const gc = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx2d as never);
    const parent = new THREE.Group();
    const layer = createPeerLayer(THREE, parent, { resolveUrl: (b) => b });
    const peers: RoomPeer[] = [
      { id: 'ai:1', nickname: '父亲', ai: true, entity: 'e7', look, x: 0, y: 0, z: 0, yaw: 0, a: 'nod', e: 'sad' },
      { id: '2', nickname: '路人', look, x: 3, y: 0, z: 0, yaw: 0 },
    ];
    layer.set(peers);
    const cam = new THREE.PerspectiveCamera();
    for (let i = 0; i < 5; i++) layer.tick(i, 0.5, cam); // 淡入
    parent.updateMatrixWorld(true);
    const ray = (x: number) => { const r = new THREE.Raycaster(new THREE.Vector3(x, 0.8, 5), new THREE.Vector3(0, 0, -1)); r.camera = cam; return r; };
    expect(layer.pickEntity(ray(0))).toBe('e7');
    expect(layer.pickEntity(ray(3))).toBeNull();
    // 名牌只写名字(不带 🤖)
    const labels: string[] = [];
    parent.traverse((o) => { if ((o as THREE.Sprite).isSprite && o.userData.text) labels.push(o.userData.text as string); });
    if (labels.length) expect(labels).toContain('父亲');
    layer.dispose();
    gc.mockRestore();
  });

  it('does not draw the placement a character plays, and it is not clickable as a prop', () => {
    const parent = new THREE.Group();
    const layer = createObjectLayer(THREE, parent, { quality: 'low' });
    const cam = new THREE.PerspectiveCamera();
    const p: PlacedObject = { id: 'e7', assetKey: '', x: 0, y: 0, z: 0, rotY: 0, scale: 1, status: 'ready', kind: 'character', look: { shape: 'box', size: [0.2, 0.85, 0.2] }, props: { solid: false, usable: true, character: { name: '父亲' } } };
    layer.set([p]);
    layer.tick(0, 1, cam);
    expect(layer.groupOf('e7')!.visible).toBe(false);
    let boxes = 0;
    parent.traverse((o) => { if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry instanceof THREE.BoxGeometry) boxes++; });
    expect(boxes).toBe(0);
    parent.updateMatrixWorld(true);
    expect(layer.pickHit(new THREE.Raycaster(new THREE.Vector3(0, 0.8, 5), new THREE.Vector3(0, 0, -1)))).toBeNull();
    layer.dispose();
  });

  it('edits a character: name, look, voice, persona go into props.character', async () => {
    const onSave = vi.fn(async () => undefined);
    render(<EntityPanel item={{ id: 'e7', kind: 'character', state: {}, rules: [], tags: [], props: { solid: false, character: { name: '角色', avatar: 'avatars/face/real_f01.vrm', persona: '' } } } as never} onSave={onSave} />);
    fireEvent.click(screen.getByText('属性 / 规则'));
    fireEvent.change(screen.getByPlaceholderText('名字(父亲、阿婆……)'), { target: { value: '父亲' } });
    fireEvent.change(screen.getByLabelText('形象'), { target: { value: 'avatars/face/poet_mid.vrm' } });
    fireEvent.change(screen.getByLabelText('嗓音'), { target: { value: 'male' } });
    fireEvent.change(screen.getByPlaceholderText(/人设:他是谁/), { target: { value: '话少的父亲' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '存' })); });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ props: { character: { name: '父亲', avatar: 'avatars/face/poet_mid.vrm', voice: 'male', persona: '话少的父亲' } } }));
  });

  it('the rule form knows remember and a choice key', () => {
    expect(formable({ remember: { 站台: "'抱过'", target: 'actor' } })).toBe(true);
    expect(formable({ choose: { key: '站台', text: '?', options: [{ label: 'a' }] } })).toBe(true);
    let rules: { on: string; do: Record<string, unknown>[] }[] = [{ on: 'use', do: [{ choose: { text: '?', options: [{ label: 'a', do: [] }] } }] }];
    const rr = () => <RuleListForm rules={rules} scope="kind" onChange={(r) => { rules = r as typeof rules; }} />;
    const { rerender } = render(rr());
    fireEvent.change(screen.getByPlaceholderText('记作(下一场读 memory.名字)'), { target: { value: '站台' } });
    expect((rules[0].do[0].choose as { key?: string }).key).toBe('站台');
    rerender(rr());
    fireEvent.change(screen.getAllByLabelText('加一个效果')[1], { target: { value: 'remember' } });
    expect(rules[0].do[1]).toEqual({ remember: { 见过: 'true' } });
  });

  it('explore cards: a counter without answers, a found line, a question to answer yourself', () => {
    const { unmount } = render(<FoundCounter count={2} total={5} />);
    expect(screen.getByText('🔍 已发现 2 / 5')).toBeTruthy();
    unmount();
    const onAnswer = vi.fn();
    const onClose = vi.fn();
    render(<ReflectCard q={{ id: 'q1', text: '你说不想走,是在留下什么?' }} onAnswer={onAnswer} onClose={onClose} />);
    expect((screen.getByRole('button', { name: '写下' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText(/写下你自己的那句话/), { target: { value: '  留下我自己  ' } });
    fireEvent.click(screen.getByRole('button', { name: '写下' }));
    expect(onAnswer).toHaveBeenCalledWith('留下我自己', false); // 默认不分享
    fireEvent.click(screen.getByLabelText('匿名留给后来的人'));
    fireEvent.click(screen.getByRole('button', { name: '写下' }));
    expect(onAnswer).toHaveBeenLastCalledWith('留下我自己', true);
    fireEvent.click(screen.getByText('先不写'));
    expect(onClose).toHaveBeenCalled();
    expect(formable({ discover: { key: '信', text: '一封信' } })).toBe(true);
    expect(formable({ reflect: '你在想什么?' })).toBe(true);
    expect(formable({ reflect: { text: '?', axis: 'heart' } })).toBe(true);
    expect(formable({ reflect: { text: '?', key: '路口' } })).toBe(true);
  });

  it('echo cards: first one here, or how the others chose (you marked)', () => {
    const { unmount } = render(<EchoCard echo={{ total: 0, rows: [{ label: '左', n: 0, mine: true }] }} onClose={() => undefined} />);
    expect(screen.getByText('你是第一个停在这里的人。')).toBeTruthy();
    unmount();
    const r = render(<EchoCard echo={{ total: 3, rows: [{ label: '左', n: 2, mine: false }, { label: '右', n: 1, mine: true }] }} onClose={() => undefined} />);
    expect(screen.getByText('在这里停下过的 3 个人:')).toBeTruthy();
    expect(screen.getByText('· 右(你)')).toBeTruthy();
    r.unmount();
    render(<EchoLinesCard data={{ lines: ['像小时候放学'], total: 5, shared: true }} onClose={() => undefined} />);
    expect(screen.getByText('像小时候放学')).toBeTruthy();
    expect(screen.getByText('你写的那句,后来的人也会读到。')).toBeTruthy();
  });

  it('the rule form knows act', () => {
    expect(formable({ act: 'nod' })).toBe(true);
    expect(formable({ act: { anim: 'nod', expr: 'sad', face: 'actor', ms: 3000, target: 'tag:father' } })).toBe(true);
    expect(formable({ act: { anim: 'nod', dance: 1 } })).toBe(false);
  });
});

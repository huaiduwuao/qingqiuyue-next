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
import { formable } from '../scene-ui/RuleForm';

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

  it('the rule form knows act', () => {
    expect(formable({ act: 'nod' })).toBe(true);
    expect(formable({ act: { anim: 'nod', expr: 'sad', face: 'actor', ms: 3000, target: 'tag:father' } })).toBe(true);
    expect(formable({ act: { anim: 'nod', dance: 1 } })).toBe(false);
  });
});

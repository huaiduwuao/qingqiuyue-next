import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import * as THREE from 'three';
import { act, fireEvent, render, screen } from '@testing-library/react';

const api = vi.hoisted(() => ({
  listSounds: vi.fn(async () => [{ key: 'amb_stream', name: '流水', tags: '', category: 'ambient', file: 'sounds/amb_stream.ogg', duration: 20, loop: true, source: 'synth', license: 'CC0' }]),
  getSound: vi.fn(async (key: string) => {
    if (key === 'u7_secret') return { key, name: '房主私有的', tags: '', category: 'sfx', file: 'sounds/u7_secret.ogg', duration: 1, loop: false, source: 'upload', license: 'CC0', visibility: 'private' };
    throw new Error('not found');
  }),
  listMySounds: vi.fn(async () => [{ key: 'u1_bell', name: '我的铃', tags: '', category: 'sfx', file: 'sounds/u1_bell.ogg', duration: 1, loop: false, source: 'upload', license: 'CC0', visibility: 'private', mine: true }]),
  updateMySound: vi.fn(async () => undefined),
  deleteMySound: vi.fn(async () => undefined),
  uploadMySound: vi.fn(async () => ({})),
  worldFileUrl: (p: string) => '/qq-media/world/' + p,
}));
vi.mock('@/apis/world', () => api);
import { resolveSound, soundList, soundPropOf } from '../scene-ui/soundLib';
import { listenerOf } from '../scene-ui/useAmbientSounds';
import { MySounds } from '../scene-ui/MySounds';
import type { VrmStageHandle } from '../VrmStage';

describe('sound library', () => {
  it('reads the sound property in both shapes', () => {
    expect(soundPropOf('amb_fire')).toEqual({ key: 'amb_fire', volume: 0.8, radius: 6 });
    expect(soundPropOf({ key: 'amb_stream', volume: 0.5, radius: 10 })).toEqual({ key: 'amb_stream', volume: 0.5, radius: 10 });
    expect(soundPropOf({ volume: 1 })).toBeNull();
    expect(soundPropOf(undefined)).toBeNull();
  });

  it('loads the list once and asks for keys it does not know (someone else\'s private sound)', async () => {
    const a = await soundList();
    expect(a).toBe(await soundList());
    expect((await resolveSound('amb_stream'))?.name).toBe('流水');
    expect(api.getSound).not.toHaveBeenCalled();
    expect((await resolveSound('u7_secret'))?.name).toBe('房主私有的');
    await resolveSound('u7_secret');
    expect(api.getSound).toHaveBeenCalledTimes(1); // 问过一次就记住
    expect(await resolveSound('nope')).toBeNull();
  });

  it('puts the listener at the avatar\'s head facing where the camera looks', () => {
    const cam = new THREE.PerspectiveCamera();
    cam.position.set(0, 3, 5);
    cam.lookAt(0, 1, 0); // 朝 −z 看
    cam.updateMatrixWorld(true);
    const h = { getPosition: () => ({ x: 2, z: 1 }), getThree: () => ({ camera: cam }) } as unknown as VrmStageHandle;
    const l = listenerOf(h);
    expect(l.at).toEqual({ x: 2, y: 1.5, z: 1 });
    expect(l.forward.z).toBeLessThan(-0.5);
    expect(Math.abs(l.forward.x)).toBeLessThan(0.01);
    cam.lookAt(10, 3, 5); // 转去看 +x
    cam.updateMatrixWorld(true);
    expect(listenerOf(h).forward.x).toBeGreaterThan(0.9);
  });
});

describe('my sounds', () => {
  it('lists my uploads and toggles public / deletes', async () => {
    const toast = vi.fn();
    render(<MySounds toast={toast} />);
    fireEvent.click(screen.getByText(/我的声音/));
    await screen.findByText('我的铃');
    await act(async () => { fireEvent.click(screen.getByText('私有')); });
    expect(api.updateMySound).toHaveBeenCalledWith('u1_bell', { visibility: 'public' });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await act(async () => { fireEvent.click(screen.getByText('删')); });
    expect(api.deleteMySound).toHaveBeenCalledWith('u1_bell');
    confirm.mockRestore();
  });
});

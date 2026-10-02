import { describe, expect, it, vi } from 'vitest';

vi.mock('@/apis/world', () => ({
  listSounds: vi.fn(async () => [{ key: 'amb_stream', name: '流水', tags: '', category: 'ambient', file: 'sounds/amb_stream.ogg', duration: 20, loop: true, source: 'synth', license: 'CC0' }]),
  worldFileUrl: (p: string) => '/qq-media/world/' + p,
}));
import { soundList, soundPropOf } from '../scene-ui/soundLib';

describe('sound library', () => {
  it('reads the sound property in both shapes', () => {
    expect(soundPropOf('amb_fire')).toEqual({ key: 'amb_fire', volume: 0.8, radius: 6 });
    expect(soundPropOf({ key: 'amb_stream', volume: 0.5, radius: 10 })).toEqual({ key: 'amb_stream', volume: 0.5, radius: 10 });
    expect(soundPropOf({ volume: 1 })).toBeNull();
    expect(soundPropOf(undefined)).toBeNull();
  });
  it('loads the list once and looks sounds up by key', async () => {
    const a = await soundList();
    const b = await soundList();
    expect(a).toBe(b);
    expect(a.get('amb_stream')?.name).toBe('流水');
  });
});

import { describe, expect, it } from 'vitest';
import { normalizeClips, pickClip } from '../clip-avatar';

describe('2D clip selection', () => {
  const clips = normalizeClips({
    _note: 'ignored',
    idle: { url: '/idle.mp4', loop: true },
    speaking: { url: '/talk.mp4', loop: true },
    wave: { url: '/wave.mp4', loop: false },
    point: '/point.mp4',
  });

  it('normalizes string and object entries and drops _meta keys', () => {
    expect(Object.keys(clips).sort()).toEqual(['idle', 'point', 'speaking', 'wave']);
    expect(clips.point).toEqual({ url: '/point.mp4', loop: false });
  });

  it('prefers a one-shot action clip, then the speak state, then idle', () => {
    expect(pickClip(clips, 'speaking', 'wave')).toEqual({ key: 'wave', url: '/wave.mp4', loop: false });
    expect(pickClip(clips, 'speaking', 'dance')).toEqual({ key: 'speaking', url: '/talk.mp4', loop: true });
    expect(pickClip(clips, 'thinking')).toEqual({ key: 'idle', url: '/idle.mp4', loop: true });
    expect(pickClip(clips, 'idle', 'idle')?.key).toBe('idle');
    expect(pickClip({}, 'idle')).toBeNull();
  });
});

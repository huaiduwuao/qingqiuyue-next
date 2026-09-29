import { describe, expect, it } from 'vitest';
import { keyLightDir, modeHour, skyAt } from '../vrm/world/env/timeOfDay';
import { DEFAULT_WORLD, worldEnv } from '../vrm/world/worldLayout';
import { skyForHour } from '../vrm/world/env/realistic';

describe('time of day', () => {
  it('sun is up at noon and down at midnight', () => {
    expect(skyAt(12).sunElevation).toBeGreaterThan(0.9);
    expect(skyAt(0).sunElevation).toBeLessThan(0);
    expect(skyAt(0).night).toBe(1);
    expect(skyAt(13).night).toBe(0);
  });
  it('every hour gives finite colours and a unit sun vector', () => {
    for (let h = 0; h < 24; h += 0.25) {
      const s = skyAt(h);
      expect(Math.hypot(...s.sunDir)).toBeCloseTo(1, 5);
      for (const c of [s.zenith, s.horizon, s.fog, s.lightColor]) for (const v of c) expect(Number.isFinite(v)).toBe(true);
      expect(s.lightIntensity).toBeGreaterThan(0);
    }
  });
  it('wraps around midnight without a jump', () => {
    const a = skyAt(23.99), b = skyAt(0.01);
    expect(Math.abs(a.fog[0] - b.fog[0])).toBeLessThan(0.02);
  });
  it('key light switches to the moon at night and stays above the horizon', () => {
    expect(keyLightDir(skyAt(12))).toEqual(skyAt(12).sunDir);
    expect(keyLightDir(skyAt(0))[1]).toBeGreaterThan(0.3);
  });
  it('fixed modes map to fixed hours', () => {
    expect(modeHour('dusk')).toBeCloseTo(18.1);
    expect(modeHour('auto', new Date(2026, 8, 29, 7, 30))).toBeCloseTo(7.5);
  });
});

describe('scene environment defaults', () => {
  it('plaza is a night with fireflies and no grass; courts are dusk with petals and grass', () => {
    expect(worldEnv(DEFAULT_WORLD)).toEqual({ time: 'night', weather: 'fireflies', grass: false, style: 'stylized', assets: undefined });
    expect(worldEnv({ ...DEFAULT_WORLD, kind: 'insight' })).toEqual({ time: 'dusk', weather: 'petals', grass: true, style: 'stylized', assets: undefined });
    expect(worldEnv({ ...DEFAULT_WORLD, env: { time: 'day', grass: true } })).toMatchObject({ time: 'day', grass: true });
  });
  it('realistic style is opt-in per scene', () => {
    expect(worldEnv({ ...DEFAULT_WORLD, env: { style: 'realistic' } }).style).toBe('realistic');
    expect(worldEnv({ ...DEFAULT_WORLD, env: { style: 'bogus' as never } }).style).toBe('stylized');
  });
  it('each hour maps to one of the four HDRI skies', () => {
    expect(skyForHour(6)).toBe('morning');
    expect(skyForHour(12)).toBe('day');
    expect(skyForHour(18)).toBe('dusk');
    expect(skyForHour(23)).toBe('night');
    expect(skyForHour(2)).toBe('night');
  });
});

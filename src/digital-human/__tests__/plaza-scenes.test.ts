import { describe, expect, it } from 'vitest';
import { parseColor, toCharacter, toWorldDef } from '../scene-ui/usePlazaScenes';
import {
  DEFAULT_WORLD, applyGameEvent, clampToWorld, emptyGameState, findZone, spawnOrbs, zoneAt, zoneFeed, zoneProp,
  type WorldDef,
} from '../vrm/world/worldLayout';
import type { PlazaScene } from '@/apis/plaza';

const court: PlazaScene = {
  id: '9', key: 'court-wound', name: '心脉庭院', intro: '', kind: 'insight', group: 'wound', stage: 'garden',
  palette: { ground: '#0d0b1c', path: '#b9a6ff', accent: 'nope' },
  landmarks: [
    { id: 'parting', label: '离别', emoji: '🍃', hint: '', actionLabel: '聊聊离别', x: -6.1, z: -7.3, radius: 2.2, solidRadius: 0.9, color: '#9b6bff', prop: 'pavilion', feed: 'insight', themeKey: 'parting' },
    { id: 'regret', label: '遗憾', emoji: '🍂', hint: '', actionLabel: '聊聊遗憾', x: 6.1, z: -7.3, radius: 2.2, solidRadius: 0.9, color: '', prop: 'stele', feed: 'insight', themeKey: 'regret' },
  ],
  status: 'published', sort: 1,
};

describe('scene conversion', () => {
  it('parses colors strictly', () => {
    expect(parseColor('#ff00aa')).toBe(0xff00aa);
    expect(parseColor('red')).toBeUndefined();
    expect(parseColor(undefined)).toBeUndefined();
  });
  it('turns a court row into a world def', () => {
    const d = toWorldDef(court);
    expect(d).toMatchObject({ key: 'court-wound', kind: 'insight', group: 'wound', stage: 'garden' });
    expect(d.palette).toEqual({ ground: 0x0d0b1c, path: 0xb9a6ff, accent: undefined });
    expect(d.zones[0]).toMatchObject({ id: 'parting', prop: 'pavilion', feed: 'insight', themeKey: 'parting', color: 0x9b6bff });
    // 颜色留空的地标给默认色,不是 NaN
    expect(Number.isFinite(d.zones[1].color)).toBe(true);
  });
  it('falls back to the plaza landmarks when a scene has none', () => {
    expect(toWorldDef({ ...court, landmarks: [] }).zones).toBe(DEFAULT_WORLD.zones);
  });
  it('keeps poet names empty for auto casting', () => {
    const c = toCharacter({ id: '1', sceneKey: 'court-wound', name: '', title: '诗人', kind: 'poet', poet: '', themeKey: 'parting', groupKey: '', lines: [], x: 1, z: 2, color: '', status: 'published', sort: 0 });
    expect(c).toMatchObject({ id: '1', kind: 'poet', name: '', themeKey: 'parting', x: 1, z: 2 });
    expect(c.poet).toBeUndefined();
  });
});

describe('geometry follows the current scene', () => {
  const def: WorldDef = toWorldDef(court);
  it('finds zones and solids of the court, not the plaza', () => {
    expect(zoneAt(-6.1, -7.3, def)?.id).toBe('parting');
    expect(zoneAt(8, 2, def)).toBeNull(); // 星光广场的点唱机不在这里
    const p = clampToWorld(-6.1, -7.3, def);
    expect(Math.hypot(p.x + 6.1, p.z + 7.3)).toBeGreaterThanOrEqual(0.9);
    expect(findZone(def, 'regret')?.label).toBe('遗憾');
  });
  it('spawns orbs outside the court landmarks', () => {
    for (const o of spawnOrbs(7, 14, def)) {
      for (const z of def.zones) expect(Math.hypot(o.x - z.x, o.z - z.z)).toBeGreaterThan(z.solidRadius);
    }
  });
  it('infers prop and feed for plaza zones without the fields', () => {
    const jukebox = DEFAULT_WORLD.zones.find((z) => z.id === 'jukebox')!;
    expect(zoneProp(jukebox)).toBe('jukebox');
    expect(zoneFeed(jukebox)).toBe('jukebox');
    expect(zoneFeed({ ...jukebox, id: 'custom', feed: undefined })).toBe('none');
  });
});

describe('insight quests', () => {
  const day = '2026-09-30';
  it('ponder counts distinct insight landmarks only', () => {
    let st = emptyGameState(day);
    for (const [zone, insight] of [['parting', true], ['parting', true], ['jukebox', false], ['regret', true]] as const) {
      st = applyGameEvent(st, { kind: 'visit', zone, insight }, day).state;
    }
    expect(st.quests.ponder).toBe(2);
  });
  it('meet completes after talking to two characters', () => {
    let st = emptyGameState(day);
    st = applyGameEvent(st, { kind: 'talk', character: 'a' }, day).state;
    const step = applyGameEvent(st, { kind: 'talk', character: 'b' }, day);
    expect(step.completed.map((q) => q.id)).toContain('meet');
  });
});

describe('dedupeBio', () => {
  it('drops whole-paragraph repeats only', async () => {
    const { dedupeBio } = await import('../scene-ui/PlazaPeople');
    const p = '白居易，字樂天，下邽人。貞元中，擢進士第，補校書郎。';
    expect(dedupeBio(p + ' ' + p + ' ' + p)).toBe(p);
    expect(dedupeBio(p)).toBe(p);
    expect(dedupeBio('短')).toBe('短');
  });
});

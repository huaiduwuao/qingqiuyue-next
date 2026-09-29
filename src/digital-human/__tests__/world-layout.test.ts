import { describe, expect, it } from 'vitest';
import {
  QUESTS, QUEST_XP, STAGE_CLEAR_RADIUS, WORLD_RADIUS, WORLD_ZONES,
  applyGameEvent, clampToWorld, emptyGameState, mergeGameStates, levelOf, orbsInReach, parseGameState, pokeReaction,
  spawnOrbs, zoneApproachPoint, zoneAt,
} from '../vrm/world/worldLayout';

describe('clampToWorld', () => {
  it('keeps points inside the plaza', () => {
    const p = clampToWorld(100, 0);
    expect(Math.hypot(p.x, p.z)).toBeLessThan(WORLD_RADIUS);
  });
  it('pushes the avatar out of solid landmarks', () => {
    for (const z of WORLD_ZONES.filter((zn) => zn.solidRadius > 0)) {
      const p = clampToWorld(z.x, z.z);
      expect(Math.hypot(p.x - z.x, p.z - z.z)).toBeGreaterThanOrEqual(z.solidRadius);
    }
  });
  it('leaves open ground alone', () => {
    expect(clampToWorld(1, 1)).toEqual({ x: 1, z: 1 });
  });
});

describe('zones', () => {
  it('are inside the plaza and do not overlap the stage or each other', () => {
    for (const z of WORLD_ZONES) {
      expect(Math.hypot(z.x, z.z) + z.radius).toBeLessThan(WORLD_RADIUS);
      expect(Math.hypot(z.x, z.z) - z.radius).toBeGreaterThan(STAGE_CLEAR_RADIUS);
      for (const o of WORLD_ZONES) {
        if (o === z) continue;
        expect(Math.hypot(z.x - o.x, z.z - o.z)).toBeGreaterThan(z.radius + o.radius);
      }
    }
  });
  it('approach point is reachable and counts as being in the zone', () => {
    for (const z of WORLD_ZONES) {
      const p = zoneApproachPoint(z);
      expect(clampToWorld(p.x, p.z)).toEqual(p);
      expect(zoneAt(p.x, p.z)?.id).toBe(z.id);
    }
  });
  it('the stage centre is no zone', () => {
    expect(zoneAt(0, 0)).toBeNull();
  });
});

describe('orbs', () => {
  it('spawn deterministically, off the stage and out of landmarks', () => {
    const a = spawnOrbs(42);
    expect(spawnOrbs(42)).toEqual(a);
    for (const o of a) {
      expect(Math.hypot(o.x, o.z)).toBeGreaterThanOrEqual(STAGE_CLEAR_RADIUS);
      expect(Math.hypot(o.x, o.z)).toBeLessThan(WORLD_RADIUS);
      for (const z of WORLD_ZONES) expect(Math.hypot(o.x - z.x, o.z - z.z)).toBeGreaterThan(z.solidRadius);
    }
  });
  it('are picked up only within reach', () => {
    const orbs = [{ id: 1, x: 5, z: 5, golden: false }];
    expect(orbsInReach(5.3, 5.2, orbs)).toHaveLength(1);
    expect(orbsInReach(7, 7, orbs)).toHaveLength(0);
  });
});

describe('game state', () => {
  const day = '2026-09-29';
  it('orbs give xp and finish the collection quest', () => {
    let st = emptyGameState(day);
    let completed = 0;
    for (let i = 0; i < 12; i++) {
      const step = applyGameEvent(st, { kind: 'orb', golden: false }, day);
      st = step.state;
      completed += step.completed.length;
    }
    expect(completed).toBe(1);
    expect(st.orbsTotal).toBe(12);
    expect(st.xp).toBe(12 * 10 + QUEST_XP);
    // 完成后不再重复领奖
    expect(applyGameEvent(st, { kind: 'orb', golden: false }, day).completed).toHaveLength(0);
  });
  it('explore quest counts distinct zones only', () => {
    let st = emptyGameState(day);
    for (const zone of ['dance', 'dance', 'wish', 'books'] as const) st = applyGameEvent(st, { kind: 'visit', zone }, day).state;
    expect(st.quests.explore).toBe(3);
    expect(st.visited).toEqual(['dance', 'wish', 'books']);
  });
  it('a new day resets quests but keeps xp', () => {
    let st = emptyGameState(day);
    st = applyGameEvent(st, { kind: 'interact', zone: 'dance' }, day).state;
    expect(st.done).toContain('dance');
    const next = applyGameEvent(st, { kind: 'poke' }, '2026-09-30').state;
    expect(next.done).toEqual([]);
    expect(next.xp).toBe(st.xp);
    expect(next.quests.poke).toBe(1);
  });
  it('levels up with growing thresholds', () => {
    expect(levelOf(0)).toMatchObject({ level: 1, into: 0, need: 100 });
    expect(levelOf(100)).toMatchObject({ level: 2, into: 0, need: 200 });
    expect(levelOf(350).level).toBe(3);
    const step = applyGameEvent({ ...emptyGameState(day), xp: 95 }, { kind: 'orb', golden: false }, day);
    expect(step.levelUp).toBe(true);
  });
  it('parses junk from storage safely', () => {
    expect(parseGameState('nope', day)).toEqual(emptyGameState(day));
    const st = parseGameState({ day, xp: -5, orbsTotal: 'x', quests: { orbs: 3, bad: 'y' }, done: ['orbs', 7], visited: ['dance', 'mars'] }, day);
    expect(st).toMatchObject({ xp: 0, orbsTotal: 0, quests: { orbs: 3, bad: 0 }, done: ['orbs'], visited: ['dance'] });
  });
  it('every quest has a reachable target', () => {
    for (const q of QUESTS) expect(q.target).toBeGreaterThan(0);
  });
});

describe('poke', () => {
  it('cycles reactions and gets annoyed on a burst', () => {
    expect(pokeReaction(0, 1).action).not.toBe(pokeReaction(1, 1).action);
    expect(pokeReaction(3, 5).text).toBe('别戳啦!');
  });
});

describe('mergeGameStates', () => {
  it('keeps the best of local and server progress', () => {
    const day = '2026-09-29';
    const a = { ...emptyGameState(day), xp: 300, orbsTotal: 5, quests: { orbs: 5, poke: 1 }, done: ['dance'], visited: ['dance' as const] };
    const b = { ...emptyGameState(day), xp: 120, orbsTotal: 9, quests: { orbs: 2, chat: 3 }, done: ['chat'], visited: ['wish' as const] };
    const m = mergeGameStates(a, b, day);
    expect(m).toMatchObject({ xp: 300, orbsTotal: 9, quests: { orbs: 5, poke: 1, chat: 3 } });
    expect(m.done.sort()).toEqual(['chat', 'dance']);
    expect(m.visited.sort()).toEqual(['dance', 'wish']);
  });
  it('drops quests from a previous day on either side', () => {
    const old = { ...emptyGameState('2026-09-28'), xp: 50, quests: { orbs: 9 }, done: ['orbs'] };
    const m = mergeGameStates(old, emptyGameState('2026-09-29'), '2026-09-29');
    expect(m).toMatchObject({ xp: 50, quests: {}, done: [] });
  });
});

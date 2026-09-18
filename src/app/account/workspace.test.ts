import { describe, expect, it } from 'vitest';
import { resolveTab } from './components/useUrlTab';
import {
  CONTENT_HOME_TAB,
  CONTENT_TAB_ALIASES,
  CONTENT_TAB_IDS,
  STAFF_TAB_IDS,
  contentNavFor,
} from './content/navigation';
import { REWARD_HOME_TAB, REWARD_NAV, REWARD_TAB_IDS } from './reward/navigation';
import { buildOnboardingSteps, onboardingProgress } from './content/_components/onboarding';

describe('resolveTab', () => {
  it('accepts known tabs and falls back for missing or unknown ones', () => {
    expect(resolveTab('works', CONTENT_TAB_IDS, CONTENT_HOME_TAB)).toBe('works');
    expect(resolveTab(null, CONTENT_TAB_IDS, CONTENT_HOME_TAB)).toBe(CONTENT_HOME_TAB);
    expect(resolveTab('co-create', CONTENT_TAB_IDS, CONTENT_HOME_TAB)).toBe(CONTENT_HOME_TAB);
  });

  it('maps legacy per-type publish ids to the unified publish page', () => {
    expect(resolveTab('novel-publish', CONTENT_TAB_IDS, CONTENT_HOME_TAB, CONTENT_TAB_ALIASES)).toBe('hd-publish');
  });
});

describe('content navigation', () => {
  const ids = (isStaff: boolean) => contentNavFor(isStaff).flatMap((g) => g.items.map((i) => i.id));

  it('hides the review workbench from creators and shows it to staff', () => {
    expect(STAFF_TAB_IDS.has('hd-review')).toBe(true);
    expect(ids(false)).not.toContain('hd-review');
    expect(ids(true)).toContain('hd-review');
  });

  it('gives every entry a one-line description for first-time users', () => {
    for (const item of contentNavFor(true).flatMap((g) => g.items)) {
      expect(item.description, item.id).toBeTruthy();
    }
  });
});

describe('reward navigation', () => {
  it('has unique tab ids and a valid home tab', () => {
    const all = REWARD_NAV.flatMap((g) => g.items.map((i) => i.id));
    expect(new Set(all).size).toBe(all.length);
    expect(REWARD_TAB_IDS.has(REWARD_HOME_TAB)).toBe(true);
  });

  it('keeps the demand → realization → team line and drops the template-only pages', () => {
    for (const t of ['demands', 'board', 'realizations', 'teams']) expect(REWARD_TAB_IDS.has(t)).toBe(true);
    // 「意境」「项目」两页读的是模板留下的空表,已删除;意境现在是内容社区里的意境(/topic)
    for (const t of ['conceptions', 'projects']) expect(REWARD_TAB_IDS.has(t)).toBe(false);
  });
});

describe('creator onboarding', () => {
  it('marks steps done from real data and reports progress', () => {
    const fresh = buildOnboardingSteps({ hasAvatar: false, hasNickname: true });
    expect(onboardingProgress(fresh)).toEqual({ done: 0, total: 4, complete: false });

    const steps = buildOnboardingSteps({ hasAvatar: true, hasNickname: true, totalWorks: 3, paidWorks: 1, invited: 2 });
    expect(onboardingProgress(steps).complete).toBe(true);
  });

  it('points every pending step at a real destination', () => {
    for (const step of buildOnboardingSteps({ hasAvatar: false, hasNickname: false })) {
      const target = step.action.tab ?? step.action.href;
      expect(target, step.id).toBeTruthy();
      if (step.action.tab) expect(CONTENT_TAB_IDS.has(step.action.tab)).toBe(true);
    }
  });
});

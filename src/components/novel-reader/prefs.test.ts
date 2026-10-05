import { describe, expect, it } from 'vitest';
import { CUSTOM_NIGHT_ID, NIGHT_THEMES, customNightTheme, isNightTheme, themeOf } from './prefs';

describe('夜间配色', () => {
  it('预设和自定义都算夜间,日间主题不算', () => {
    expect(NIGHT_THEMES.every((t) => isNightTheme(t.id) && t.dark)).toBe(true);
    expect(isNightTheme(CUSTOM_NIGHT_ID)).toBe(true);
    expect(isNightTheme('default')).toBe(false);
  });

  it('自定义配色由底色 + 字色推出整套,非法值回落默认', () => {
    const t = themeOf(CUSTOM_NIGHT_ID, { paper: '#102030', text: '#a0b0c0' });
    expect(t).toMatchObject({ id: CUSTOM_NIGHT_ID, paper: '#102030', text: '#a0b0c0', dark: true });
    expect(customNightTheme({ paper: 'oops', text: '' }).paper).toBe('#1c1b19');
  });

  it('底色挑成浅色时按日间处理', () => {
    expect(customNightTheme({ paper: '#f0f0f0', text: '#333333' }).dark).toBe(false);
  });
});

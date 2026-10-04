import { beforeEach, describe, expect, it } from 'vitest';
import { loadWallpaperPrefs, saveWallpaperPrefs } from './wallpaperPrefs';

describe('wallpaperPrefs', () => {
  beforeEach(() => localStorage.clear());

  it('按用户分开存取', () => {
    saveWallpaperPrefs(1, { favorites: ['a'], mine: [{ id: 'b', appliedTo: 'home', setAt: 'x' }] });
    expect(loadWallpaperPrefs(1).favorites).toEqual(['a']);
    expect(loadWallpaperPrefs(1).mine[0].appliedTo).toBe('home');
    expect(loadWallpaperPrefs(2)).toEqual({ favorites: [], mine: [] });
    expect(loadWallpaperPrefs(null)).toEqual({ favorites: [], mine: [] });
  });

  it('脏数据不抛错', () => {
    localStorage.setItem('qq-wallpaper-prefs:1', '{bad');
    expect(loadWallpaperPrefs(1)).toEqual({ favorites: [], mine: [] });
    localStorage.setItem('qq-wallpaper-prefs:1', JSON.stringify({ favorites: [1, 'x'], mine: [{ id: 'y', appliedTo: 'bogus' }] }));
    expect(loadWallpaperPrefs(1)).toEqual({ favorites: ['x'], mine: [] });
  });
});

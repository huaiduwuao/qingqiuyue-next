import { describe, expect, it, vi } from 'vitest';
import {
  compareVersions,
  fetchLatestRelease,
  isNewerVersion,
  LATEST_MANIFEST_URL,
  LATEST_RELEASE_API,
  parseGithubRelease,
  parseManifest,
} from './appUpdate';

describe('compareVersions', () => {
  it('compares numerically, not lexically', () => {
    expect(compareVersions('1.1.10', '1.1.9')).toBeGreaterThan(0);
    expect(compareVersions('1.10.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('2.0.0', '10.0.0')).toBeLessThan(0);
    expect(compareVersions('1.1.4', '1.1.4')).toBe(0);
  });

  it('ignores the v prefix and build metadata', () => {
    expect(compareVersions('v1.1.4', '1.1.4')).toBe(0);
    expect(compareVersions('1.1.4+abc', '1.1.4')).toBe(0);
  });

  it('orders pre-releases per semver 2.0', () => {
    const ordered = [
      '1.0.0-alpha',
      '1.0.0-alpha.1',
      '1.0.0-alpha.beta',
      '1.0.0-beta',
      '1.0.0-beta.2',
      '1.0.0-beta.11',
      '1.0.0-rc.1',
      '1.0.0',
    ];
    for (let i = 0; i < ordered.length - 1; i++) {
      expect(compareVersions(ordered[i], ordered[i + 1]), `${ordered[i]} < ${ordered[i + 1]}`).toBeLessThan(0);
      expect(compareVersions(ordered[i + 1], ordered[i])).toBeGreaterThan(0);
    }
  });

  it('treats unparsable input as equal (never nags)', () => {
    expect(compareVersions('garbage', '1.0.0')).toBe(0);
    expect(isNewerVersion('', '1.0.0')).toBe(false);
  });
});

describe('parsers', () => {
  it('reads the Tauri static manifest', () => {
    expect(parseManifest({ version: 'v1.1.4', notes: 'n', pub_date: '2026-09-23T00:00:00Z', platforms: {} })).toEqual({
      version: '1.1.4',
      notes: 'n',
      date: '2026-09-23T00:00:00Z',
    });
    expect(parseManifest({ notes: 'x' })).toBeNull();
  });

  it('reads the GitHub release API and skips drafts / pre-releases', () => {
    expect(parseGithubRelease({ tag_name: 'v1.2.0', body: 'b' })?.version).toBe('1.2.0');
    expect(parseGithubRelease({ tag_name: 'v1.2.0', prerelease: true })).toBeNull();
    expect(parseGithubRelease({ tag_name: 'nightly' })).toBeNull();
  });
});

describe('fetchLatestRelease', () => {
  it('prefers the API and falls back to latest.json', async () => {
    const ok = vi.fn(async (url: string) => {
      if (url === LATEST_RELEASE_API) return { tag_name: 'v1.1.5', body: 'api' };
      throw new Error('unexpected');
    });
    await expect(fetchLatestRelease(ok)).resolves.toMatchObject({ version: '1.1.5', notes: 'api' });

    const fallback = vi.fn(async (url: string) => {
      if (url === LATEST_RELEASE_API) throw new Error('HTTP 403');
      if (url === LATEST_MANIFEST_URL) return { version: '1.1.6', notes: 'json' };
      throw new Error('unexpected');
    });
    await expect(fetchLatestRelease(fallback)).resolves.toMatchObject({ version: '1.1.6', notes: 'json' });

    await expect(fetchLatestRelease(async () => { throw new Error('offline'); })).rejects.toThrow(/offline/);
  });
});

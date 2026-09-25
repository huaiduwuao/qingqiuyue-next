import { afterEach, describe, expect, it, vi } from 'vitest';
import { md5 } from './md5';
import { getPath, render, wbiQuery } from './engine';
import { DEFAULT_RULES, matchProvider, validateRules } from './rules';
import { parseSidx } from './dash';

describe('md5', () => {
  it('matches known digests', () => {
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(md5('The quick brown fox jumps over the lazy dog')).toBe('9e107d9d372bb6826bd81d3542a419d6');
    // UTF-8
    expect(md5('中文')).toBe('a7bac2239fcdcb3a067903d8077c4a07');
  });
});

describe('templates', () => {
  it('renders vars and filters', () => {
    const vars = { img: 'https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png', b4: 'a/b=' };
    expect(render('{{img|basename}}', vars)).toBe('7cd084941338484aae1ad9425b84077c');
    expect(render('{{b4|urlencode}}', vars)).toBe('a%2Fb%3D');
    expect(render('x={{missing}}', vars)).toBe('x=');
  });
  it('reads dotted paths with array indexes', () => {
    expect(getPath({ data: [{ cid: 42 }] }, 'data.0.cid')).toBe(42);
    expect(getPath({ data: null }, 'data.x')).toBeUndefined();
  });
});

describe('wbi signing', () => {
  afterEach(() => vi.useRealTimers());
  it('sorts params, strips !\'()*, appends wts and w_rid', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1702204169 * 1000);
    const mixin = DEFAULT_RULES.providers[0].steps.find((s) => s.sign)!.sign!.mixin;
    // 公开文档里的样例:img/sub key 与参数
    const q = wbiQuery({ foo: '114', bar: '514', zab: '1919810' }, '7cd084941338484aae1ad9425b84077c', '4932caff0ff746eab6f01bf08b70ac45', mixin);
    expect(q).toBe('bar=514&foo=114&wts=1702204169&zab=1919810&w_rid=8f6f2b5b3d485fe1886cec6a0be8c5d4');
  });
});

describe('rules', () => {
  it('built-in rules validate and match Bilibili pages', () => {
    expect(validateRules(DEFAULT_RULES)?.providers.length).toBe(1);
    expect(matchProvider('https://www.bilibili.com/video/BV1Lyem67ED9')?.groups[0]).toBe('BV1Lyem67ED9');
    expect(matchProvider('https://www.bilibili.com/bangumi/play/ep1')).toBeNull();
    expect(matchProvider('https://evil.com/?u=https://www.bilibili.com/video/BV1Lyem67ED9')).toBeNull();
  });
  it('drops providers with broken regex or non-https steps', () => {
    const bad = {
      schema: 1,
      version: 'x',
      providers: [
        { ...DEFAULT_RULES.providers[0], id: 'a', match: ['('] },
        { ...DEFAULT_RULES.providers[0], id: 'b', steps: [{ id: 's', url: 'http://x' }] },
        { ...DEFAULT_RULES.providers[0], id: 'c' },
      ],
    };
    expect(validateRules(bad)?.providers.map((p) => p.id)).toEqual(['c']);
    expect(validateRules({ schema: 2 })).toBeNull();
  });
});

describe('sidx', () => {
  it('parses a version-0 sidx box', () => {
    // size 44, 'sidx', v0, flags, ref id 1, timescale 1000, earliest 0, first_offset 0, reserved, count 1,
    // ref: size 5000, duration 2000, sap
    const buf = new ArrayBuffer(44);
    const dv = new DataView(buf);
    dv.setUint32(0, 44);
    [0x73, 0x69, 0x64, 0x78].forEach((c, i) => dv.setUint8(4 + i, c));
    dv.setUint32(12, 1);
    dv.setUint32(16, 1000);
    dv.setUint32(20, 0);
    dv.setUint32(24, 0);
    dv.setUint16(30, 1);
    dv.setUint32(32, 5000);
    dv.setUint32(36, 2000);
    dv.setUint32(40, 0x90000000);
    const segs = parseSidx(buf, 1000);
    expect(segs).toEqual([{ start: 1044, end: 6043, t0: 0, t1: 2 }]);
  });
});

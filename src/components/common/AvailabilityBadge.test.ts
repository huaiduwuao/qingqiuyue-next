import { describe, it, expect } from 'vitest';
import { specOf } from './AvailabilityBadge';

// 角标的全部判断都在 specOf 里。这里钉住的是**措辞**,不是实现:
// 说错一个词,用户就会带着错误预期点进去。
describe('specOf', () => {
  it('没判定过 / 不适用的内容不挂角标', () => {
    // 一屏里每张卡片都挂着标签,等于没有标签;而 unknown 时说什么都是猜。
    expect(specOf('unknown')).toBeNull();
    expect(specOf('not_applicable')).toBeNull();
    expect(specOf(undefined)).toBeNull();
  });

  it('站内能用的标绿', () => {
    expect(specOf('playable')).toMatchObject({ label: '站内可播', tone: 'good' });
    expect(specOf('embeddable')).toMatchObject({ label: '站内可看', tone: 'good' });
    expect(specOf('readable')).toMatchObject({ label: '站内可读', tone: 'good' });
  });

  it('只有目录的书说"仅目录",绝不说成可读', () => {
    // 线上 422 本书是这个状态:目录齐全、正文一个字都没有。这正是用户
    // 点进去看到空白页的那一类。
    const spec = specOf('catalog_only');
    expect(spec?.label).toBe('仅目录');
    expect(spec?.tone).toBe('external');
  });

  it('部分可读要报出具体章数,而不是含糊的"部分"', () => {
    // 20/900 和 880/900 对用户是完全不同的决定。
    expect(specOf('partial_text', 20, 900)?.label).toBe('站内 20/900 章');
    // 拿不到数字时才退回含糊说法。
    expect(specOf('partial_text')?.label).toBe('部分章节可读');
  });

  it('不是故障的情况不用警示色,也不带"修复"字样', () => {
    // 带宽限制、未开播、未收录正文都不是故障 —— 用红色/"修复中"会制造
    // 一堆永远修不完、也不该修的预期。
    for (const s of ['bandwidth_limited', 'live_offline', 'external_only', 'catalog_only'] as const) {
      const spec = specOf(s);
      expect(spec?.tone).not.toBe('broken');
      expect(spec?.label).not.toContain('修复');
    }
  });

  it('确实坏了的才标红', () => {
    expect(specOf('pending_repair')).toMatchObject({ label: '修复中', tone: 'broken' });
  });
});

import { describe, expect, it } from 'vitest';
import type { Shot } from '@/apis/shortdrama';
import { groupShots } from './StoryboardSection';

const s = (id: number, beat: number, sub: number, action = ''): Shot => ({ id, no: id, beat, sub_no: sub, beat_text: `段落${beat}`, action } as unknown as Shot);

describe('groupShots', () => {
  it('同一镜头号的连续分镜归一组,组文案取剧本原文', () => {
    const g = groupShots([s(1, 1, 1), s(2, 1, 2), s(3, 2, 1)]);
    expect(g.map((x) => x.shots.map((y) => y.id))).toEqual([[1, 2], [3]]);
    expect(g[0].text).toBe('段落1');
  });
  it('旧分镜(没有镜头号)每个分镜自成一组,组文案用分镜描述', () => {
    const g = groupShots([s(1, 0, 0, '甲'), s(2, 0, 0, '乙')]);
    expect(g.map((x) => x.text)).toEqual(['甲', '乙']);
  });
});

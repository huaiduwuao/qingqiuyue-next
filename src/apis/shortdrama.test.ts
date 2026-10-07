import { describe, expect, it } from 'vitest';
import { estimateCost, type Capabilities, type Capability } from './shortdrama';

const cap = (minCost: number, available = true): Capability => ({ available, workflows: available ? ['wf'] : [], minCost });
const caps = (t2i: Capability, i2i: Capability, i2v: Capability): Capabilities => ({
  capabilities: { t2i, i2i, t2v: cap(0, false), i2v },
  llm_ready: true,
});

describe('estimateCost', () => {
  it('3 集 × 60 秒:镜头 12~30/集,定妆 + 场景 6~12 张;镜头走图生图单价,出片另算', () => {
    const e = estimateCost(caps(cap(10), cap(20), cap(50)), 3, 60)!;
    expect(e.imageCount).toEqual([6 + 36, 12 + 90]);
    expect(e.image).toEqual([6 * 10 + 36 * 20, 12 * 10 + 90 * 20]);
    expect(e.video).toEqual([36 * 50, 90 * 50]);
  });

  it('没有图生图就按文生图算镜头,没有图生视频出片为 0', () => {
    const e = estimateCost(caps(cap(10), cap(0, false), cap(0, false)), 1, 30)!;
    expect(e.image).toEqual([(3 + 2) * 10 + 6 * 10, (6 + 2) * 10 + 15 * 10]);
    expect(e.video).toEqual([0, 0]);
  });

  it('出图全不可用时不给预估', () => {
    expect(estimateCost(caps(cap(0, false), cap(0, false), cap(50)), 3, 60)).toBeNull();
    expect(estimateCost(undefined, 3, 60)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import {
  demandPayDiamonds,
  diamondsToYuan,
  FEN_PER_DIAMOND,
  fenToDiamonds,
  formatDiamonds,
  formatDiamondsShort,
  MIN_WITHDRAW_DIAMONDS,
  taskRewardDiamonds,
  yuanToDiamonds,
} from './wallet';

// 钱包按钻石记账:1 钻 = 10 分(后端 walletapp.FenPerDiamond),最低提现 10 钻 = ¥1
describe('diamondsToYuan', () => {
  it('按 1 钻 = ¥0.1 换算', () => {
    expect(FEN_PER_DIAMOND).toBe(10);
    expect(diamondsToYuan(10)).toBe('1');
    expect(diamondsToYuan(15)).toBe('1.5');
    expect(diamondsToYuan(1)).toBe('0.1');
    expect(diamondsToYuan(0)).toBe('0');
    expect(diamondsToYuan(10000)).toBe('1000');
  });

  it('最低提现 10 钻 = ¥1', () => {
    expect(diamondsToYuan(MIN_WITHDRAW_DIAMONDS)).toBe('1');
  });
});

// 悬赏统一按钻石:新接口给 *Diamonds 字段,老数据只有按元的 pay / reward、按分的 *Cents
describe('悬赏金额换算', () => {
  it('优先用钻石字段,没有时把元折成钻', () => {
    expect(demandPayDiamonds({ payDiamonds: 155, pay: 99 })).toBe(155);
    expect(demandPayDiamonds({ pay: 12.5 })).toBe(125);
    expect(demandPayDiamonds({ pay: '30' })).toBe(300);
    expect(demandPayDiamonds({})).toBe(0);
    expect(taskRewardDiamonds({ rewardDiamonds: 15, reward: 1 })).toBe(15);
    expect(taskRewardDiamonds({ reward: 30 })).toBe(300);
    expect(yuanToDiamonds(0.1)).toBe(1);
  });

  it('分 → 钻(团队收入、实现成交额)', () => {
    expect(fenToDiamonds(1500)).toBe(150);
    expect(fenToDiamonds(undefined)).toBe(0);
  });

  it('展示文本', () => {
    expect(formatDiamonds(1234)).toBe('1,234 钻');
    expect(formatDiamonds(undefined)).toBe('0 钻');
    expect(formatDiamondsShort(860)).toBe('860 钻');
    expect(formatDiamondsShort(12345)).toBe('1.2 万钻');
    expect(formatDiamondsShort(20000)).toBe('2 万钻');
  });
});

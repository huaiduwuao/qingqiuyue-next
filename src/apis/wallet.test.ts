import { describe, expect, it } from 'vitest';
import { diamondsToYuan, FEN_PER_DIAMOND, MIN_WITHDRAW_DIAMONDS } from './wallet';

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

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { RelativeTime } from './RelativeTime';

describe('RelativeTime', () => {
  it('毫秒时间戳', () => {
    const { container } = render(<RelativeTime ts={Date.now() - 5 * 60_000} autoRefresh={false} />);
    expect(container.textContent).toBe('5 分钟前');
  });

  it('ISO 字符串也能显示(以前 Number(iso) = NaN,什么都不显示)', () => {
    const iso = new Date(Date.now() - 3 * 3_600_000).toISOString();
    const { container } = render(<RelativeTime ts={iso} autoRefresh={false} />);
    expect(container.textContent).toBe('3 小时前');
  });

  it('「YYYY-MM-DD HH:mm:ss」按本地时间解析', () => {
    const d = new Date(Date.now() - 2 * 86_400_000);
    const p = (n: number) => String(n).padStart(2, '0');
    const s = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    const { container } = render(<RelativeTime ts={s} autoRefresh={false} />);
    expect(container.textContent).toBe('2 天前');
  });
});

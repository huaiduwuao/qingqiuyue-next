import { describe, expect, it } from 'vitest';
import type { WorksItem } from '@/apis/creator';
import { toWorksTableRows } from './rows';

function work(id: string | number, title: string): WorksItem {
  return {
    id,
    title,
    contentType: 'NOVEL',
    coverUrl: '',
    readNum: 0,
    agreeNum: 0,
    commentNum: 0,
    status: 'PUBLISH',
  };
}

describe('toWorksTableRows', () => {
  it('keeps exact string BIGINT IDs as DataGrid row IDs', () => {
    const rows = toWorksTableRows([
      work('1785000000000000023', '山海小食堂'),
      work('1785000000000000022', '长安妖市'),
    ], 1);

    expect(rows.map((row) => row.id)).toEqual([
      '1785000000000000023',
      '1785000000000000022',
    ]);
    expect(rows.map((row) => row.contentId)).toEqual([
      '1785000000000000023',
      '1785000000000000022',
    ]);
  });

  it('assigns unique fallback keys when a legacy response has already lost BIGINT precision', () => {
    // This is exactly what JSON.parse produced for 23 distinct production IDs.
    const rounded = Number('1785000000000000023');
    expect(Number.isSafeInteger(rounded)).toBe(false);

    const rows = toWorksTableRows([
      work(rounded, '山海小食堂'),
      work(rounded, '长安妖市'),
      work(rounded, '青丘妖闻录'),
    ], 2);

    expect(new Set(rows.map((row) => row.id)).size).toBe(3);
    expect(rows.map((row) => row.id)).toEqual([
      'legacy:2:0',
      'legacy:2:1',
      'legacy:2:2',
    ]);
  });
});

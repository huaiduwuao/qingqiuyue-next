import { describe, expect, it } from 'vitest';
import { detailRoutesFor, getDetailRoute } from './contentRoute';

describe('detailRoutesFor', () => {
  it('maps content types to distinct detail routes and drops unknown types', () => {
    expect(detailRoutesFor(['SHORT_DRAMA'])).toEqual(['/detail/teleplay-detail']);
    // 电视剧和短剧共用一个详情页,只预取一次
    expect(detailRoutesFor(['FILM', 'TELEPLAY', 'SHORT_DRAMA', 'NOPE'])).toEqual([
      '/detail/film-detail',
      '/detail/teleplay-detail',
    ]);
    expect(detailRoutesFor([])).toEqual([]);
  });
});

describe('getDetailRoute', () => {
  it('preserves an unsafe BIGINT string exactly', () => {
    expect(getDetailRoute('VIDEO', '1783965387403893903')).toBe(
      '/detail/video-detail?id=1783965387403893903',
    );
  });

  it('routes persisted PICTURE works to the image detail page', () => {
    expect(getDetailRoute('PICTURE', '1783965388044120646')).toBe(
      '/detail/image-detail?id=1783965388044120646',
    );
  });
});

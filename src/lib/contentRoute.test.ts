import { describe, expect, it } from 'vitest';
import { getDetailRoute } from './contentRoute';

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

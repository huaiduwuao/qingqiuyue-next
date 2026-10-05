import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const desktop = { value: false };
vi.mock('@/lib/clientAuth', () => ({ isDesktopClient: () => desktop.value }));
vi.mock('@/apis/availability', () => ({
  peekAvailability: () => ({ axis: 'play', status: 'resolvable', ok: true, appOnly: true }),
  loadAvailability: () => Promise.resolve({ axis: 'play', status: 'resolvable', ok: true, appOnly: true }),
}));

import { PlayTag } from './PlayTag';

describe('PlayTag appOnly', () => {
  beforeEach(() => {
    desktop.value = false;
  });

  it('网页上取片要带 Referer 的标「App 可看」', () => {
    render(<PlayTag id="1" contentType="ANIMATION" />);
    expect(screen.getByText('App 可看')).toBeTruthy();
  });

  it('客户端里照常「站内可播」', () => {
    desktop.value = true;
    render(<PlayTag id="1" contentType="ANIMATION" />);
    expect(screen.getByText('站内可播')).toBeTruthy();
  });
});

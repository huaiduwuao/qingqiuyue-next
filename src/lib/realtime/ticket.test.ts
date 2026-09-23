import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();
vi.mock('@/lib/api/client', () => ({ adminClient: (...args: unknown[]) => post(...args) }));

import { getRealtimeTicket, withTicket } from './ticket';

describe('realtime ticket', () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({ ticket: 't/1' });
  });

  it('asks core-api for a one-time ticket', async () => {
    await expect(getRealtimeTicket()).resolves.toBe('t/1');
    expect(post).toHaveBeenCalledWith('/realtime/ticket', { method: 'POST' });
  });

  it('throws when no ticket comes back', async () => {
    post.mockResolvedValue({});
    await expect(getRealtimeTicket()).rejects.toThrow();
  });

  it('appends the ticket and drops leftover credentials', async () => {
    expect(await withTicket('wss://gw.example/ws/notify')).toBe('wss://gw.example/ws/notify?ticket=t%2F1');
    expect(await withTicket('/api/avatar/ws?sid=1&token=old')).toBe('/api/avatar/ws?sid=1&ticket=t%2F1');
    expect(await withTicket('ws://h:1/x?session_id=s#frag')).toBe('ws://h:1/x?ticket=t%2F1#frag');
  });
});

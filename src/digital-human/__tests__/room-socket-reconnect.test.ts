import { afterEach, describe, expect, it, vi } from 'vitest';

// 换票:第一次永远不回(卡住),之后正常
let calls = 0;
vi.mock('@/lib/realtime/ticket', () => ({
  getRealtimeTicket: vi.fn(() => {
    calls++;
    return calls === 1 ? new Promise<string>(() => undefined) : Promise.resolve('tk' + calls);
  }),
}));

class FakeWS {
  static OPEN = 1;
  static made: FakeWS[] = [];
  readyState = 0;
  binaryType = '';
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) { FakeWS.made.push(this); }
  send(s: string) { this.sent.push(s); }
  close() { this.readyState = 3; }
}

describe('RoomSocket reconnect', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('does not get stuck when a ticket request hangs, and old attempts are dropped after close', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeWS);
    const { RoomSocket } = await import('@/lib/world/roomSocket');
    const statuses: string[] = [];
    const sock = new RoomSocket(() => undefined, (s) => statuses.push(s));
    sock.join('1');
    expect(statuses).toEqual(['connecting']);
    // 卡住的那次换票 8 秒后算失败,退避 1 秒再试
    await vi.advanceTimersByTimeAsync(8000);
    expect(statuses.at(-1)).toBe('reconnecting');
    await vi.advanceTimersByTimeAsync(1100);
    expect(FakeWS.made).toHaveLength(1);
    expect(FakeWS.made[0].url).toContain('ticket=tk2');
    const ws = FakeWS.made[0];
    ws.readyState = 1;
    ws.onopen?.();
    expect(statuses.at(-1)).toBe('open');
    expect(ws.sent.some((s) => s.includes('"join"'))).toBe(true);
    // 关掉以后再进别的房间:立刻能连(不会被「正在连接」挡住)
    sock.leave();
    sock.join('2');
    await vi.advanceTimersByTimeAsync(10);
    expect(FakeWS.made).toHaveLength(2);
  });
});

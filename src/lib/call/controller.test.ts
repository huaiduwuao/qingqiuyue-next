import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/realtime', () => ({
  realtime: { send: vi.fn(() => true), getStatus: () => 'open' },
  deviceId: () => 'dev-1',
}));
vi.mock('@/apis/call', () => ({
  inviteCall: vi.fn(),
  acceptCall: vi.fn(),
  endCall: vi.fn(() => Promise.resolve()),
  getIceServers: vi.fn(() => Promise.resolve([])),
}));
vi.mock('./ring', () => ({ startRing: vi.fn(), stopRing: vi.fn() }));

import { inviteCall, endCall } from '@/apis/call';
import { startRing } from './ring';
import { startCall, hangup, accept, onCallEvent, useCall } from './controller';

function fakeStream() {
  const track = { kind: 'audio', enabled: true, stop: vi.fn() };
  return { track, stream: { getTracks: () => [track], getAudioTracks: () => [track], getVideoTracks: () => [] } as unknown as MediaStream };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const peer = { userId: '2', nickname: 'B' };

describe('call controller 异步竞态', () => {
  let getUserMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    getUserMedia = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
    (globalThis as unknown as { RTCPeerConnection: unknown }).RTCPeerConnection = function () {};
    useCall.setState({ phase: 'idle', callId: '', localStream: null });
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('邀请在路上时取消:不再起回铃,并通知服务端 cancel', async () => {
    const { stream, track } = fakeStream();
    getUserMedia.mockResolvedValue(stream);
    const inv = deferred<{ callId: string; online: boolean; busy: boolean; iceServers: [] }>();
    vi.mocked(inviteCall).mockReturnValue(inv.promise as never);

    const p = startCall(peer, 'audio');
    await vi.waitFor(() => expect(useCall.getState().phase).toBe('outgoing'));
    await hangup();
    expect(track.stop).toHaveBeenCalled();

    inv.resolve({ callId: 'c1', online: true, busy: false, iceServers: [] });
    await p;
    expect(startRing).not.toHaveBeenCalled();
    expect(endCall).toHaveBeenCalledWith('c1', 'cancel');
  });

  it('连点两次呼叫:第二条流立即关掉', async () => {
    const a = fakeStream();
    const b = fakeStream();
    getUserMedia.mockResolvedValueOnce(a.stream).mockResolvedValueOnce(b.stream);
    vi.mocked(inviteCall).mockReturnValue(new Promise(() => {}) as never);

    const p1 = startCall(peer, 'audio');
    const p2 = startCall(peer, 'audio');
    await expect(p2).rejects.toThrow('正在通话中');
    void p1;
    expect(useCall.getState().localStream).toBe(a.stream);
    expect(b.track.stop).toHaveBeenCalled();
    expect(a.track.stop).not.toHaveBeenCalled();
  });

  it('接听时授权弹窗期间对方取消:拿到的麦克风立即关掉', async () => {
    const { stream, track } = fakeStream();
    const gum = deferred<MediaStream>();
    getUserMedia.mockReturnValue(gum.promise);
    await onCallEvent({ type: 'call.invite', data: { callId: 'c9', fromUserId: '2', nickname: 'B', media: 'audio' } } as never);
    expect(useCall.getState().phase).toBe('incoming');

    const p = accept();
    await onCallEvent({ type: 'call.end', data: { callId: 'c9', by: '2', result: 'cancel' } } as never);
    gum.resolve(stream);
    await p;
    expect(track.stop).toHaveBeenCalled();
    expect(useCall.getState().localStream).toBeNull();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { decodeDown, encodeUp, relayFrame, FLAG_END, VOICE_KIND } from '@/lib/world/voice/packet';
import { VoiceGate, rmsDb } from '@/lib/world/voice/gate';
import { LevelTimeline, mouthOpen, scheduleChunk } from '@/lib/world/voice/jitter';
import { useRoomSocket } from '../scene-ui/useRoomSocket';
import type { RoomFrame, RoomSocket, RoomSocketStatus } from '@/lib/world/roomSocket';
import type { VrmStageHandle } from '../VrmStage';
import type { WorldDef } from '../vrm/world/worldLayout';

describe('voice packets', () => {
  it('round-trips through the server relay', () => {
    const frames = [new Uint8Array([1, 2, 3]), new Uint8Array(300).fill(7)];
    const up = encodeUp({ seq: 65535, end: true, frames });
    expect(up[0]).toBe(VOICE_KIND);
    expect(up[1] & FLAG_END).toBe(FLAG_END);
    const down = relayFrame(up, '12345');
    const d = decodeDown(down.buffer.slice(down.byteOffset, down.byteOffset + down.byteLength) as ArrayBuffer);
    expect(d?.id).toBe('12345');
    expect(d?.packet.seq).toBe(65535);
    expect(d?.packet.end).toBe(true);
    expect(d?.packet.frames.map((f) => Array.from(f.slice(0, 3)))).toEqual([[1, 2, 3], [7, 7, 7]]);
    expect(d?.packet.frames[1].length).toBe(300);
  });

  it('matches the Go relay byte layout', () => {
    // voice_test.go: 上行 [1, 0,0,7, 1, 0,2, AA,BB] → 下行 [1, 1,'1', 0,0,7, 1, 0,2, AA,BB]
    const up = encodeUp({ seq: 7, end: false, frames: [new Uint8Array([0xaa, 0xbb])] });
    expect(Array.from(up)).toEqual([1, 0, 0, 7, 1, 0, 2, 0xaa, 0xbb]);
    expect(Array.from(relayFrame(up, '1'))).toEqual([1, 1, 49, 0, 0, 7, 1, 0, 2, 0xaa, 0xbb]);
  });

  it('rejects truncated or foreign frames', () => {
    expect(decodeDown(new Uint8Array([2, 1, 49, 0, 0, 0, 0]))).toBeNull();
    expect(decodeDown(new Uint8Array([1, 5, 49]))).toBeNull();
    // 声明一帧 10 字节,实际只有 2 字节
    expect(decodeDown(new Uint8Array([1, 1, 49, 0, 0, 1, 1, 0, 10, 1, 2]))).toBeNull();
  });
});

describe('voice gate', () => {
  const frame = (amp: number) => new Float32Array(960).map((_, i) => amp * Math.sin(i / 3));

  it('measures loudness in dBFS', () => {
    expect(rmsDb(new Float32Array(960))).toBe(-120);
    expect(rmsDb(frame(1))).toBeGreaterThan(-4);
    expect(rmsDb(frame(0.01))).toBeLessThan(-40);
  });

  it('opens on speech after the attack frames, holds through short pauses, then closes', () => {
    const g = new VoiceGate();
    for (let i = 0; i < 50; i++) expect(g.push(-65).open).toBe(false);
    expect(g.push(-20).open).toBe(false);
    const r = g.push(-20);
    expect(r).toMatchObject({ open: true, opened: true });
    // 句中停顿 200ms:不断
    for (let i = 0; i < 10; i++) expect(g.push(-65).open).toBe(true);
    g.push(-22);
    // 安静 450ms 以上:关
    let closed = false;
    for (let i = 0; i < 30 && !closed; i++) closed = g.push(-65).closed;
    expect(closed).toBe(true);
    expect(g.open).toBe(false);
  });

  it('adapts to a noisy room so the fan does not hold the gate open', () => {
    const g = new VoiceGate();
    for (let i = 0; i < 400; i++) g.push(-40);
    expect(g.thresholdDb).toBeGreaterThan(-40);
    expect(g.push(-40).open).toBe(false);
    g.push(-18);
    expect(g.push(-18).open).toBe(true);
  });
});

describe('jitter scheduling', () => {
  it('starts a buffer ahead, chains, and drops when far ahead', () => {
    const a = scheduleChunk(10, 0, 0.02)!;
    expect(a.reset).toBe(true);
    expect(a.start).toBeCloseTo(10.12);
    const b = scheduleChunk(10.01, a.next, 0.02)!;
    expect(b.start).toBeCloseTo(a.next);
    expect(b.reset).toBe(false);
    expect(scheduleChunk(10, 10.7, 0.02)).toBeNull();
    // 落后了(断了一阵)→ 重新起头
    expect(scheduleChunk(12, 10.5, 0.02)?.reset).toBe(true);
  });

  it('answers the mouth level at a time', () => {
    const t = new LevelTimeline();
    t.push(1, 1.02, 0.5);
    t.push(1.02, 1.04, 0.8);
    expect(t.at(1.01)).toBe(0.5);
    expect(t.at(1.03)).toBe(0.8);
    expect(t.at(1.05)).toBe(0);
    expect(t.until).toBeCloseTo(1.04);
    expect(mouthOpen(0)).toBe(0);
    expect(mouthOpen(0.5)).toBe(1);
    expect(mouthOpen(0.003)).toBe(0);
  });
});

const roomDef = (owner: string): WorldDef => ({ key: `room:${owner}`, name: 'x', kind: 'room', stage: 'studio', zones: [], room: { ownerId: owner, ownerName: '', mine: owner === '1', template: 'study' } });

describe('useRoomSocket voice', () => {
  function setup() {
    let emit: (f: RoomFrame) => void = () => {};
    let bin: (b: ArrayBuffer) => void = () => {};
    const sock = { join: vi.fn(), leave: vi.fn(), close: vi.fn(), say: vi.fn(() => true), sendState: vi.fn(), voice: vi.fn(() => true), vmute: vi.fn(() => true), sendBinary: vi.fn(() => true), noteLine: vi.fn(), lines: vi.fn(() => true) };
    const handle = {
      setRoomPeers: vi.fn(), peerSay: vi.fn(), floatText: vi.fn(), setPosition: vi.fn(),
      getWorldSnapshot: vi.fn(() => ({ x: 0, z: 5, yaw: 0, camYaw: 0, orbs: [], zone: null, peers: [], characters: [] })),
    } as unknown as VrmStageHandle;
    const hook = renderHook(() => useRoomSocket({
      handle, def: roomDef('1'), enabled: true, applyEdit: vi.fn(), applyRoom: vi.fn(), onKick: vi.fn(), toast: vi.fn(),
      makeSocket: (f: (fr: RoomFrame) => void, _s: (st: RoomSocketStatus) => void, b: (x: ArrayBuffer) => void) => { emit = f; bin = b; return sock as unknown as RoomSocket; },
    }));
    return { hook, sock, emit: (f: RoomFrame) => act(() => emit(f)), bin: (b: ArrayBuffer) => bin(b) };
  }
  const look = { base: '', params: {}, version: 0 };

  it('tracks peers voice state, self mute and the room switch', () => {
    const t = setup();
    t.emit({ t: 'hello', you: '1', room: { ownerId: '1', version: 1, name: 'x', voice: true }, peers: [{ id: '7', nickname: '阿青', look, x: 0, y: 0, z: 0, yaw: 0, voice: 2 }] });
    expect(t.hook.result.current.roomVoice).toBe(true);
    expect(t.hook.result.current.isOwner).toBe(true);
    expect(t.hook.result.current.peers[0].voice).toBe(2);
    t.emit({ t: 'voice', id: '7', v: 2, muted: true });
    expect(t.hook.result.current.peers[0]).toMatchObject({ voice: 2, muted: true });
    t.emit({ t: 'voice', id: '1', v: 1, muted: true });
    expect(t.hook.result.current.selfMuted).toBe(true);
    t.emit({ t: 'room', room: { ownerId: '1', voiceOff: true } });
    expect(t.hook.result.current.roomVoice).toBe(false);
  });

  it('re-reports the voice state after every hello and routes binary frames', () => {
    const t = setup();
    act(() => t.hook.result.current.setVoiceState(2));
    expect(t.sock.voice).toHaveBeenLastCalledWith(2);
    t.sock.voice.mockClear();
    t.emit({ t: 'hello', you: '1', room: { ownerId: '1', version: 1, name: 'x' }, peers: [] });
    expect(t.sock.voice).toHaveBeenCalledWith(2);
    const got: ArrayBuffer[] = [];
    act(() => t.hook.result.current.setVoiceHandler((b) => got.push(b)));
    const buf = new Uint8Array([1, 1, 55, 0, 0, 0, 0]).buffer;
    t.bin(buf);
    expect(got).toEqual([buf]);
    act(() => t.hook.result.current.setVoiceHandler(null));
    t.bin(buf);
    expect(got).toHaveLength(1);
    t.hook.result.current.vmute('7', true);
    expect(t.sock.vmute).toHaveBeenCalledWith('7', true);
    t.hook.result.current.sendVoice(new Uint8Array([1]));
    expect(t.sock.sendBinary).toHaveBeenCalled();
  });
});

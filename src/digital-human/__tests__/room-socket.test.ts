import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRoomSocket } from '../scene-ui/useRoomSocket';
import type { RoomFrame, RoomSocket, RoomSocketStatus } from '@/lib/world/roomSocket';
import type { VrmStageHandle } from '../VrmStage';
import type { WorldDef } from '../vrm/world/worldLayout';

const roomDef = (owner: string): WorldDef => ({ key: `room:${owner}`, name: 'x', kind: 'room', stage: 'studio', zones: [], room: { ownerId: owner, ownerName: '', mine: owner === '1', template: 'study' } });

function setup() {
  let emit: (f: RoomFrame) => void = () => {};
  let status: (s: RoomSocketStatus) => void = () => {};
  const sock = { join: vi.fn(), leave: vi.fn(), close: vi.fn(), say: vi.fn(() => true), sendState: vi.fn(), noteLine: vi.fn(), lines: vi.fn(() => true) };
  const handle = {
    setRoomPeers: vi.fn(), peerSay: vi.fn(), floatText: vi.fn(), setPosition: vi.fn(),
    getWorldSnapshot: vi.fn(() => ({ x: 0, z: 1.2, yaw: 0, camYaw: 0, orbs: [], zone: null, peers: [], characters: [] })),
  } as unknown as VrmStageHandle;
  const opts = {
    handle, enabled: true,
    applyEdit: vi.fn(), applyRoom: vi.fn(), onKick: vi.fn(), toast: vi.fn(),
    makeSocket: (f: (fr: RoomFrame) => void, s: (st: RoomSocketStatus) => void) => { emit = f; status = s; return sock as unknown as RoomSocket; },
  };
  const hook = renderHook((p: { def: WorldDef }) => useRoomSocket({ ...opts, def: p.def }), { initialProps: { def: roomDef('1') } });
  return { hook, sock, handle, opts, emit: (f: RoomFrame) => act(() => emit(f)), status: (s: RoomSocketStatus) => act(() => status(s)) };
}

const look = { base: '', params: {}, version: 0 };

describe('useRoomSocket', () => {
  it('joins the room owner and tracks peers', () => {
    const t = setup();
    expect(t.sock.join).toHaveBeenCalledWith('1');
    t.emit({ t: 'hello', you: '1', room: { ownerId: '1', version: 1, name: 'x' }, peers: [{ id: '7', nickname: '阿青', look, x: 2, y: 0, z: 0, yaw: 0 }] });
    expect(t.hook.result.current.peers.map((p) => p.id)).toEqual(['7']);
    expect(t.hook.result.current.online).toBe(2);
    t.emit({ t: 'join', peer: { id: '8', nickname: '阿远', look, x: 0, y: 0, z: 0, yaw: 0 } });
    expect(t.hook.result.current.peers).toHaveLength(2);
    t.emit({ t: 'peers', list: [{ id: '7', x: 3, y: 0, z: -1, yaw: 1, m: true }] });
    expect(t.hook.result.current.peers.find((p) => p.id === '7')).toMatchObject({ x: 3, z: -1, m: true, nickname: '阿青' });
    // 停下:帧里没有 m / a,不能沿用上一帧
    t.emit({ t: 'peers', list: [{ id: '7', x: 3.2, y: 0, z: -1, yaw: 1 }] });
    expect(t.hook.result.current.peers.find((p) => p.id === '7')).toMatchObject({ m: false, a: undefined });
    t.emit({ t: 'leave', id: '8' });
    expect(t.hook.result.current.peers.map((p) => p.id)).toEqual(['7']);
    const last = (t.handle.setRoomPeers as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
    expect(last).toHaveLength(1);
  });

  it('steps aside when someone already stands on the spawn point', () => {
    const t = setup();
    t.emit({ t: 'hello', you: '1', room: { ownerId: '1', version: 1, name: 'x' }, peers: [{ id: '7', nickname: '阿青', look, x: 0.1, y: 0, z: 1.1, yaw: 0 }] });
    expect(t.handle.setPosition).toHaveBeenCalledTimes(1);
  });

  it('routes say / edit / room / kick frames', () => {
    const t = setup();
    t.emit({ t: 'hello', you: '1', room: { ownerId: '1', version: 1, name: 'x' }, peers: [] });
    t.emit({ t: 'say', id: '7', nickname: '阿青', text: '你好', ts: 1 });
    t.emit({ t: 'say', id: '1', nickname: '我', text: '欢迎', ts: 2 });
    expect(t.hook.result.current.chat.map((c) => [c.text, c.mine])).toEqual([['你好', false], ['欢迎', true]]);
    expect(t.handle.peerSay).toHaveBeenCalledWith('7', '你好');
    expect(t.handle.floatText).toHaveBeenCalled();
    t.emit({ t: 'edit', op: 'remove', version: 3, id: '42' });
    expect(t.opts.applyEdit).toHaveBeenCalledWith('remove', '42');
    t.emit({ t: 'edit', op: 'upsert', version: 4, placement: { id: '43' } });
    expect(t.opts.applyEdit).toHaveBeenCalledWith('upsert', { id: '43' });
    t.emit({ t: 'room', room: { ownerId: '1' } });
    expect(t.opts.applyRoom).toHaveBeenCalled();
    t.emit({ t: 'kick', msg: '关门了' });
    expect(t.opts.onKick).toHaveBeenCalledWith('关门了');
  });

  it('moves between rooms and public scenes (七期:广场也走集线器)', () => {
    const t = setup();
    t.hook.rerender({ def: { ...roomDef('1'), key: 'plaza', kind: 'plaza', room: undefined } });
    expect(t.sock.leave).toHaveBeenCalled();
    expect(t.sock.join).toHaveBeenLastCalledWith('plaza');
    expect(t.hook.result.current.space).toBe('scene');
    // 场景里谁来谁走不弹提示
    t.emit({ t: 'hello', you: '1', room: { ownerId: '', version: 0, name: 'plaza', scene: 'plaza' }, peers: [] });
    t.emit({ t: 'join', peer: { id: '8', nickname: '阿远', look, x: 0, y: 0, z: 0, yaw: 0 } });
    expect(t.opts.toast).not.toHaveBeenCalled();
    t.hook.rerender({ def: roomDef('2') });
    expect(t.sock.join).toHaveBeenLastCalledWith('2');
    expect(t.hook.result.current.space).toBe('room');
    // 关掉世界:断开
    t.hook.rerender({ def: { ...roomDef('2') } });
  });

  it('tracks scene lines and switches line (九期分线)', () => {
    const t = setup();
    t.hook.rerender({ def: { ...roomDef('1'), key: 'plaza', kind: 'plaza', room: undefined } });
    t.emit({ t: 'hello', you: '1', room: { ownerId: '', version: 0, name: 'plaza', scene: 'plaza', line: 2, lines: [{ line: 1, n: 50 }, { line: 2, n: 3 }] }, peers: [] });
    expect(t.hook.result.current.line).toBe(2);
    expect(t.hook.result.current.lines).toHaveLength(2);
    expect(t.sock.noteLine).toHaveBeenLastCalledWith(2);
    t.emit({ t: 'say', id: '8', nickname: '阿远', text: '二线的人好', ts: 1 });
    expect(t.hook.result.current.chat).toHaveLength(1);
    act(() => { t.hook.result.current.switchLine(1); });
    expect(t.sock.join).toHaveBeenLastCalledWith('plaza', 1);
    expect(t.hook.result.current.chat).toHaveLength(0);
    t.emit({ t: 'lines', scene: 'plaza', line: 1, lines: [{ line: 1, n: 50 }, { line: 2, n: 2 }] });
    expect(t.hook.result.current.line).toBe(1);
    expect(t.hook.result.current.refreshLines()).toBe(true);
    expect(t.sock.lines).toHaveBeenCalled();
  });

  it('reports sitting as a=sit with the seat height (十期)', () => {
    vi.useFakeTimers();
    const t = setup();
    const snap = vi.mocked(t.handle.getWorldSnapshot);
    act(() => { vi.advanceTimersByTime(120); });
    expect(t.sock.sendState).toHaveBeenLastCalledWith(expect.objectContaining({ y: 0 }));
    snap.mockReturnValue({ x: 0.6, z: 0, yaw: 0, camYaw: 0, orbs: [], zone: null, peers: [], characters: [], sit: 0.45 });
    act(() => { vi.advanceTimersByTime(120); });
    expect(t.sock.sendState).toHaveBeenLastCalledWith(expect.objectContaining({ a: 'sit', y: 0.45, m: false }));
    const n = t.sock.sendState.mock.calls.length;
    act(() => { vi.advanceTimersByTime(300); }); // 坐着不动:不重复报
    expect(t.sock.sendState.mock.calls.length).toBe(n);
    snap.mockReturnValue({ x: 0.6, z: 0, yaw: 0, camYaw: 0, orbs: [], zone: null, peers: [], characters: [], sit: null });
    act(() => { vi.advanceTimersByTime(120); }); // 站起来那一下也要报
    expect(t.sock.sendState).toHaveBeenLastCalledWith(expect.objectContaining({ y: 0, a: undefined }));
    vi.useRealTimers();
  });

  it('shows captions: own partial, everyone final', () => {
    const t = setup();
    t.emit({ t: 'hello', you: '1', room: { ownerId: '1', version: 1, name: 'x' }, peers: [{ id: '7', nickname: '阿青', look, x: 0, y: 0, z: 0, yaw: 0 }] });
    t.emit({ t: 'caption', id: '1', text: '你好', final: false });
    expect(t.hook.result.current.myCaption).toBe('你好');
    t.emit({ t: 'caption', id: '1', nickname: '我', text: '你好呀。', final: true, ts: 5 });
    expect(t.hook.result.current.myCaption).toBe('');
    t.emit({ t: 'caption', id: '7', nickname: '阿青', text: '欢迎欢迎。', final: true, ts: 6 });
    expect(t.hook.result.current.chat.map((c) => [c.text, c.mine, c.voice])).toEqual([['你好呀。', true, true], ['欢迎欢迎。', false, true]]);
    expect(t.handle.peerSay).toHaveBeenCalledWith('7', '欢迎欢迎。');
    expect(t.handle.floatText).toHaveBeenCalled();
    t.emit({ t: 'caption', id: '1', text: '', final: true, blocked: true });
    expect(t.hook.result.current.myCaption).toContain('敏感词');
  });

  it('says through the socket, trimmed and capped', () => {
    const t = setup();
    act(() => { t.hook.result.current.say('  hi  '); });
    expect(t.sock.say).toHaveBeenCalledWith('hi');
    expect(t.hook.result.current.say('   ')).toBe(false);
  });
});

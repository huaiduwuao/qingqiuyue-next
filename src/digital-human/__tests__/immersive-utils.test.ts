import { describe, expect, it } from 'vitest';
import type { ChatLogItem } from '../useChatAvatar';
import type { WorldDef } from '../vrm/world/worldLayout';
import {
  buildRoomState,
  conversationTitle,
  DEFAULT_TITLES,
  lastActiveChoicesIndex,
  nextTimeMode,
  readyGsAssets,
  relativeTime,
} from '../immersiveUtils';

describe('immersiveUtils', () => {
  it('relativeTime 按分钟 / 小时 / 天给相对时间', () => {
    const now = Date.parse('2026-10-04T12:00:00Z');
    expect(relativeTime('', now)).toBe('');
    expect(relativeTime('坏的', now)).toBe('');
    expect(relativeTime('2026-10-04T11:59:30Z', now)).toBe('刚刚');
    expect(relativeTime('2026-10-04T11:15:00Z', now)).toBe('45分钟前');
    expect(relativeTime('2026-10-04T09:00:00Z', now)).toBe('3小时前');
    expect(relativeTime('2026-09-30T12:00:00Z', now)).toBe('4天前');
    expect(relativeTime('2026-01-01T12:00:00Z', now)).toBe(new Date(Date.parse('2026-01-01T12:00:00Z')).toLocaleDateString('zh-CN'));
  });

  it('conversationTitle 压空白、截 50 字,空的叫新会话', () => {
    expect(conversationTitle('  你好\n  世界 ')).toBe('你好 世界');
    expect(conversationTitle('   ')).toBe('新会话');
    expect(conversationTitle('字'.repeat(60))).toBe('字'.repeat(50) + '…');
    expect(DEFAULT_TITLES.has('新会话')).toBe(true);
  });

  it('lastActiveChoicesIndex 只认这一轮最新的一组选项', () => {
    const log: ChatLogItem[] = [
      { who: 'choices', text: '' },
      { who: 'user', text: '问' },
      { who: 'ai', text: '答' },
      { who: 'choices', text: '' },
      { who: 'choices', text: '' },
      { who: 'ai', text: '还有' },
    ];
    expect(lastActiveChoicesIndex(log)).toBe(4);
    expect(lastActiveChoicesIndex([...log, { who: 'user', text: '又问' }])).toBe(-1);
    expect(lastActiveChoicesIndex([])).toBe(-1);
  });

  it('nextTimeMode 轮换', () => {
    expect(nextTimeMode('dawn')).toBe('day');
    expect(nextTimeMode('night')).toBe('auto');
    expect(nextTimeMode('auto')).toBe('dawn');
  });

  it('readyGsAssets 只要就绪带地址的 3DGS,当前的标出来', () => {
    expect(
      readyGsAssets([
        { id: 'a', name: 'A', mode: '3dgs', status: 'ready', active: true, assetUrl: '/a' },
        { id: 'b', name: 'B', mode: '3dgs', status: 'building', assetUrl: '/b' },
        { id: 'c', name: 'C', mode: 'vrm', status: 'ready', assetUrl: '/c' },
        { id: 'd', name: 'D', mode: '3dgs', status: 'ready' },
      ]),
    ).toEqual([{ id: 'a', name: 'A(当前)', assetUrl: '/a' }]);
  });

  it('buildRoomState 取整到一位、截 40 / 20 个', () => {
    const def = { key: 'room:1', name: '小屋', kind: 'room', zones: [], room: { ownerName: '阿月', mine: true, template: 'study' } } as unknown as WorldDef;
    const objects = Array.from({ length: 45 }, (_, i) => ({ id: `o${i}`, label: i === 0 ? '' : `物${i}`, asset: i === 0 ? { nameZh: '椅子' } : null, assetKey: 'chair', x: 1.234, z: -0.06, rotY: Math.PI / 2, scale: i === 1 ? 1.26 : 1 }));
    const peers = Array.from({ length: 25 }, (_, i) => ({ nickname: `人${i}`, x: 0.44, z: 0.45, owner: i === 0, ai: i === 1 }));
    const s = buildRoomState(def, { x: 2.26, z: -1 }, objects, peers);
    expect(s.name).toBe('小屋');
    expect(s.owner).toBe('阿月');
    expect(s.mine).toBe(true);
    expect(s.me).toEqual({ x: 2.3, z: -1 });
    expect(s.objects).toHaveLength(40);
    expect(s.objects[0]).toEqual({ id: 'o0', label: '椅子', x: 1.2, z: -0.1, deg: 90 });
    expect(s.objects[1]).toMatchObject({ label: '物1', scale: 1.3 });
    expect(s.people).toHaveLength(20);
    expect(s.people[0]).toEqual({ name: '人0', x: 0.4, z: 0.5, owner: true });
    expect(s.people[1]).toEqual({ name: '人1', x: 0.4, z: 0.5, ai: true });
    expect(buildRoomState(def, null, [], []).me).toEqual({ x: 0, z: 0 });
  });
});

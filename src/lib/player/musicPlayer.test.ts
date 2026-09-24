import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./resolveMusic', () => ({
  resolveMusicById: vi.fn(async () => ''),
  resolveTrackById: vi.fn(async (id: string) =>
    id.startsWith('broken') ? { src: '', preview: false } : { src: `https://cdn/${id}.mp3`, artist: '歌手', preview: false },
  ),
}));

import { currentTrack, musicPlayer, useMusicPlayer, type MusicTrack } from './musicPlayer';

const lazy = (id: string): MusicTrack => ({ id, title: `歌 ${id}`, src: '', href: `/detail/music-detail?id=${id}` });
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  // jsdom 的 <audio> 不会真播放
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(async () => {});
  vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(window.HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  musicPlayer.close();
  useMusicPlayer.setState({ shuffle: false, repeat: 'all' });
});

describe('播放队列', () => {
  it('setQueue 整个替换队列并记下来源;没有音源的歌轮到时才解析', async () => {
    musicPlayer.setQueue([lazy('a'), lazy('b'), lazy('a')], { source: { kind: 'playlist', name: '夜跑' } });
    const s = useMusicPlayer.getState();
    expect(s.queue.map((t) => t.id)).toEqual(['a', 'b']); // 去重
    expect(s.source?.name).toBe('夜跑');
    expect(s.queue[1].src).toBe(''); // b 还没轮到,不解析
    await flush();
    expect(currentTrack()?.src).toBe('https://cdn/a.mp3');
    expect(currentTrack()?.artist).toBe('歌手');
  });

  it('startIndex 指定从哪首开始', async () => {
    musicPlayer.setQueue([lazy('a'), lazy('b'), lazy('c')], { startIndex: 2 });
    await flush();
    expect(currentTrack()?.id).toBe('c');
  });

  it('enqueueMany 跳过已在队列里的,不打断当前播放', async () => {
    musicPlayer.setQueue([lazy('a')]);
    await flush();
    expect(musicPlayer.enqueueMany([lazy('a'), lazy('b'), lazy('c')])).toBe(2);
    expect(useMusicPlayer.getState().queue.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(currentTrack()?.id).toBe('a');
  });

  it('随机播放:一轮里每首只放一次', async () => {
    musicPlayer.setQueue([lazy('a'), lazy('b'), lazy('c'), lazy('d')], { startIndex: 0, shuffle: true });
    const played = ['a'];
    for (let i = 0; i < 3; i++) {
      musicPlayer.next();
      await flush();
      played.push(currentTrack()!.id);
    }
    expect([...played].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('取不到音源的歌报错后自动跳下一首', async () => {
    vi.useFakeTimers();
    musicPlayer.setQueue([lazy('broken'), lazy('b')]);
    await vi.advanceTimersByTimeAsync(0);
    expect(useMusicPlayer.getState().error).toContain('暂无可播放音源');
    expect(useMusicPlayer.getState().notice?.msg).toBe('《歌 broken》无法播放,已跳到下一首');
    await vi.advanceTimersByTimeAsync(1300);
    expect(currentTrack()?.id).toBe('b');
    vi.useRealTimers();
  });

  it('列表循环关着时,最后一首放不了就停,不绕回开头', async () => {
    vi.useFakeTimers();
    useMusicPlayer.setState({ repeat: 'off' });
    musicPlayer.setQueue([lazy('a'), lazy('broken')], { startIndex: 1 });
    await vi.advanceTimersByTimeAsync(1300);
    expect(currentTrack()?.id).toBe('broken');
    expect(useMusicPlayer.getState().notice?.msg).toContain('已是最后一首');
    vi.useRealTimers();
  });

  it('整个队列都放不了:试一遍后停下并提示', async () => {
    vi.useFakeTimers();
    musicPlayer.setQueue([lazy('broken1'), lazy('broken2'), lazy('broken3')]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(useMusicPlayer.getState().notice?.msg).toBe('连续 3 首都无法播放,已停止');
    expect(useMusicPlayer.getState().playing).toBe(false);
    vi.useRealTimers();
  });

  it('开播 20 秒还没出声就当放不了,跳下一首', async () => {
    vi.useFakeTimers();
    musicPlayer.setQueue([lazy('a'), lazy('b')]);
    await vi.advanceTimersByTimeAsync(0);
    // jsdom 里 play() 被 mock 掉,不会有 playing 事件 —— 手动把 paused 扳成 false 模拟"在等数据"
    vi.spyOn(window.HTMLMediaElement.prototype, 'paused', 'get').mockReturnValue(false);
    await vi.advanceTimersByTimeAsync(20000);
    expect(useMusicPlayer.getState().error).toBe('音源加载超时');
    await vi.advanceTimersByTimeAsync(1300);
    expect(currentTrack()?.id).toBe('b');
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('move 调整顺序时当前曲目不变', async () => {
    musicPlayer.setQueue([lazy('a'), lazy('b'), lazy('c')]);
    await flush();
    musicPlayer.move(0, 2);
    expect(useMusicPlayer.getState().queue.map((t) => t.id)).toEqual(['b', 'c', 'a']);
    expect(currentTrack()?.id).toBe('a');
  });
});

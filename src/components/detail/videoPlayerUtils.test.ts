import { describe, expect, it, vi } from 'vitest';
import {
  createTimeStore,
  hlsFatalMessage,
  isMp4Stream,
  isNetworkNotice,
  NETWORK_BLOCKED_NOTICE,
  OVERSEAS_ONLY_NOTICE,
  readVolume,
  saveVolume,
  typingTarget,
} from './videoPlayerUtils';

describe('videoPlayerUtils', () => {
  it('isNetworkNotice 只认两句网络提示', () => {
    expect(isNetworkNotice(NETWORK_BLOCKED_NOTICE)).toBe(true);
    expect(isNetworkNotice(OVERSEAS_ONLY_NOTICE)).toBe(true);
    expect(isNetworkNotice('解析失败')).toBe(false);
    expect(isNetworkNotice(null)).toBe(false);
  });

  it('typingTarget:输入框 / 可编辑区算,滑块不算', () => {
    const input = document.createElement('input');
    const range = document.createElement('input');
    range.type = 'range';
    const textarea = document.createElement('textarea');
    const div = document.createElement('div');
    expect(typingTarget(input)).toBe(true);
    expect(typingTarget(textarea)).toBe(true);
    expect(typingTarget(range)).toBe(false);
    expect(typingTarget(div)).toBe(false);
    expect(typingTarget(null)).toBe(false);
    expect(typingTarget(window)).toBe(false);
  });

  it('isMp4Stream 用原始 url / format 判断', () => {
    expect(isMp4Stream('https://a.com/x.mp4')).toBe(true);
    expect(isMp4Stream('https://a.com/x.MP4?e=1')).toBe(true);
    expect(isMp4Stream('https://a.com/x', 'mp4')).toBe(true);
    expect(isMp4Stream('https://a.com/x?mime_type=video_mp4')).toBe(true);
    expect(isMp4Stream('https://a.com/index.m3u8')).toBe(false);
    // 经代理包过的地址 "?" 被转义,不能当 mp4
    expect(isMp4Stream('/api/proxy?url=https%3A%2F%2Fa.com%2Fx.mp4%3Fe%3D1')).toBe(false);
  });

  it('hlsFatalMessage 按 details 给文案', () => {
    expect(hlsFatalMessage({ details: 'manifestLoadError' })).toBe('片源清单拉取失败');
    expect(hlsFatalMessage({ details: 'manifestParsingError' })).toBe('清单解析失败');
    expect(hlsFatalMessage({ details: 'levelLoadError' })).toBe('清晰度加载失败');
    expect(hlsFatalMessage({ details: 'fragmentLoadError', context: { url: 'u' } })).toBe('分片加载失败: u');
    expect(hlsFatalMessage({ details: 'fragmentLoadError' })).toBe('分片加载失败: ');
    expect(hlsFatalMessage({ details: 'other' })).toBe('播放失败，请尝试切换清晰度');
  });

  it('createTimeStore:值不变不通知,取消订阅后不再收到', () => {
    const s = createTimeStore();
    const fn = vi.fn();
    const off = s.subscribe(fn);
    s.set(1);
    s.set(1);
    expect(s.get()).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    s.set(2);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(s.get()).toBe(2);
  });

  it('音量存取:夹在 0–100,没存过是 100', () => {
    localStorage.removeItem('qq-video-volume');
    expect(readVolume()).toBe(100);
    saveVolume(42.6);
    expect(readVolume()).toBe(43);
    localStorage.setItem('qq-video-volume', '250');
    expect(readVolume()).toBe(100);
    localStorage.setItem('qq-video-volume', 'abc');
    expect(readVolume()).toBe(100);
    localStorage.removeItem('qq-video-volume');
  });
});

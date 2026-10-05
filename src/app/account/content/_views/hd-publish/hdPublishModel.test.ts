import { describe, it, expect } from 'vitest';
import type { ModuleContentItem } from '@/apis/module-content';
import type { HdVideo } from './data';
import {
  buildReviewHistory,
  computeHdStats,
  dedupeHdVideos,
  formatSize,
  mapApiReviewers,
  mapContentStatusToHd,
  moduleContentToHdVideo,
} from './hdPublishModel';

const NOW = 1_800_000_000_000;
const video = (over: Partial<HdVideo>): HdVideo => ({
  id: 'v',
  title: 't',
  cover: '',
  resolution: '1080P',
  fps: 30,
  hdr: false,
  duration: '00:00',
  sizeMB: 0,
  status: 'published',
  uploadedAt: NOW,
  subtitles: [],
  audioTracks: [],
  hasCover: false,
  ...over,
});

describe('hdPublishModel', () => {
  it('formatSize 小于 1GB 写 MB,否则写一位小数的 GB', () => {
    expect(formatSize(512)).toBe('512 MB');
    expect(formatSize(1024)).toBe('1.0 GB');
    expect(formatSize(1536)).toBe('1.5 GB');
  });

  it('mapContentStatusToHd 把内容状态归到 HD 流程状态,未知的算转码中', () => {
    expect(mapContentStatusToHd('REVIEWING')).toBe('reviewing');
    expect(mapContentStatusToHd('PUBLISH')).toBe('published');
    expect(mapContentStatusToHd('UN_PUBLISH')).toBe('review_failed');
    expect(mapContentStatusToHd('rejected')).toBe('review_failed');
    expect(mapContentStatusToHd('error')).toBe('failed');
    expect(mapContentStatusToHd(undefined)).toBe('transcoding');
    expect(mapContentStatusToHd('active')).toBe('transcoding');
  });

  it('dedupeHdVideos 按 id 去重、丢掉没 id 的,并补空字幕/音轨', () => {
    const out = dedupeHdVideos([
      { id: 1, title: 'a', resolution: '4K' },
      { id: '1', title: 'a2' },
      null,
      { title: 'no id' },
      { id: 2, title: 'b' },
    ]);
    expect(out.map((v) => v.id)).toEqual(['1', '2']);
    expect(out[0].title).toBe('a2');
    expect(out[0].subtitles).toEqual([]);
    expect(out[0].audioTracks).toEqual([]);
    expect(dedupeHdVideos(undefined)).toEqual([]);
  });

  it('moduleContentToHdVideo 给管理列表里的视频补默认值', () => {
    const v = moduleContentToHdVideo({ id: 9, title: '', status: 'PUBLISH', coverUrl: 'c.jpg', readNum: 3, agreeNum: 1, createTime: '2026-01-01T00:00:00Z' } as ModuleContentItem);
    expect(v).toMatchObject({ id: '9', title: '(无标题)', cover: 'c.jpg', hasCover: true, status: 'published', views: 3, likes: 1, resolution: '1080P' });
    expect(v.uploadedAt).toBe(new Date('2026-01-01T00:00:00Z').getTime());
    const bare = moduleContentToHdVideo({ id: 10 } as ModuleContentItem);
    expect(bare.hasCover).toBe(false);
    expect(bare.cover).toContain('gradient');
    expect(bare.audioTracks).toHaveLength(1);
  });

  it('computeHdStats 只算最近 24 小时的上传和审核', () => {
    const stats = computeHdStats(
      [
        video({ id: 'a', resolution: '4K', review: { checks: [], result: 'pass', startedAt: NOW - 600_000, completedAt: NOW - 300_000 } }),
        video({ id: 'b', resolution: '2K', status: 'transcoding', review: { checks: [], result: 'reject', startedAt: NOW - 200_000, completedAt: NOW - 100_000 } }),
        video({ id: 'c', uploadedAt: NOW - 2 * 86400000, review: { checks: [], result: 'pass', completedAt: NOW - 2 * 86400000 } }),
      ],
      3,
      NOW,
    );
    expect(stats).toMatchObject({ todayUploads: 2, hdCount: 2, fastChannelQuota: 3, fastChannelMonthly: 10, transcoding: 1, todayReviewed: 2, passRate: 50 });
    // 平均 (300s + 100s) / 2 = 200s ≈ 3 分钟
    expect(stats.avgReviewMin).toBe(3);
    expect(computeHdStats([], 5, NOW)).toMatchObject({ todayReviewed: 0, passRate: 0, avgReviewMin: 0 });
  });

  it('buildReviewHistory 只收有审核信息的,按完成/开始时间倒序', () => {
    const list = buildReviewHistory([
      video({ id: 'x' }),
      video({ id: 'old', review: { checks: [], completedAt: 100 } }),
      video({ id: 'new', review: { checks: [], startedAt: 300 } }),
      video({ id: 'mid', review: { checks: [], completedAt: 200 } }),
    ]);
    expect(list.map((r) => r.videoId)).toEqual(['new', 'mid', 'old']);
  });

  it('mapApiReviewers 兼容 records / list 两种分页字段', () => {
    const r = { id: 'r1', name: '甲', initials: 'J', avatarColor: '#000', team: 'T', level: 2 as const, title: 'x', reviewCount: 1, passRate: 90, online: true, currentLoad: 1, maxLoad: 3, specialties: [] };
    expect(mapApiReviewers({ records: [r] } as never)[0]).toMatchObject({ id: 'r1', level: 2, avgReviewSec: 300 });
    expect(mapApiReviewers({ list: [r] } as never)).toHaveLength(1);
    expect(mapApiReviewers(undefined)).toEqual([]);
  });
});

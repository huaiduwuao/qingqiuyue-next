import { describe, expect, it } from 'vitest';
import { parseNoticeInfo, systemNoticeView } from './systemNotice';

describe('parseNoticeInfo', () => {
  it('长整数 id 不丢精度', () => {
    expect(parseNoticeInfo('{"contentId":1234567890123456789}').contentId).toBe('1234567890123456789');
  });
  it('坏 JSON / 空值返回空对象', () => {
    expect(parseNoticeInfo('{oops')).toEqual({});
    expect(parseNoticeInfo('')).toEqual({});
    expect(parseNoticeInfo(null)).toEqual({});
  });
});

describe('systemNoticeView', () => {
  it('作品下架:没有类型时走按 id 的通用详情页', () => {
    const v = systemNoticeView({ title: '作品已被下架', info: '{"contentId":42}', createTime: '2026-10-04T10:00:00+08:00' });
    expect(v.link).toBe('/share/module-content-detail?id=42');
    expect(v.time).toBe('2026-10-04T10:00:00+08:00');
    expect(v.level).toBe('warning');
    expect(v.typeName).toBe('作品');
  });
  it('开播提醒:带类型走对应详情页', () => {
    const v = systemNoticeView({ title: '你预约的直播开播了', info: '{"contentId":7,"contentType":"LIVE"}' });
    expect(v.link).toMatch(/\?id=7$/);
    expect(v.link).not.toContain('module-content-detail');
    expect(v.level).toBe('success');
  });
  it('审核 / 活动 / 分发失败 / 举报', () => {
    expect(systemNoticeView({ title: '审核未通过', info: '{"reviewId":3,"contentId":5,"status":"rejected"}' }).link).toBe('/account/content?tab=hd-publish');
    expect(systemNoticeView({ title: '新活动上线:x', info: '{"activityId":9}' }).link).toBe('/account/content?tab=activity');
    expect(systemNoticeView({ title: '「抖音」发布失败', info: '{"kind":"share_task_failed","taskId":1}' }).link).toBe('/account/content?tab=share');
    const r = systemNoticeView({ title: '你的举报已处理', info: '{"reportId":1,"targetType":"user","targetId":2}' });
    expect(r.link).toBeNull();
    expect(r.typeName).toBe('举报');
  });
  it('运营通知自带 link 时保留', () => {
    expect(systemNoticeView({ title: '公告', link: 'https://qingqiuyue.com/x' }).link).toBe('https://qingqiuyue.com/x');
  });
});

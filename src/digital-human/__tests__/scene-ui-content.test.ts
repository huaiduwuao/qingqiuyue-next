import { describe, it, expect } from 'vitest';
import { scenePanelFromToolCall } from '../scene-ui/types';
import {
  cardShape,
  contentHref,
  normalizeChoices,
  normalizeContentRefs,
  rememberContentRefs,
} from '../scene-ui/content';

describe('作品引用', () => {
  it('雪花 id 保持字符串,不丢精度', () => {
    const [ref] = normalizeContentRefs([{ id: '1789576541780629508', contentType: 'music', title: '晴天' }]);
    expect(ref.id).toBe('1789576541780629508');
    expect(ref.contentType).toBe('MUSIC');
  });

  it('没有 id 或标题的条目丢掉,重复 id 只留一个', () => {
    const refs = normalizeContentRefs([
      { id: '1', contentType: 'FILM', title: 'A' },
      { id: '1', contentType: 'FILM', title: 'A again' },
      { contentType: 'FILM', title: 'no id' },
      { id: '2', contentType: 'FILM' },
      null,
    ]);
    expect(refs.map((r) => r.id)).toEqual(['1']);
  });

  it('模型只抄了 id 和标题时,封面和作者从搜索结果缓存里补', () => {
    rememberContentRefs(
      normalizeContentRefs([{ id: '900', contentType: 'MUSIC', title: '七里香', cover: 'https://img/x.jpg', author: '周杰伦' }]),
    );
    const panel = scenePanelFromToolCall(
      'ui_show_content',
      { title: '挑了一首', items: [{ id: '900', contentType: 'MUSIC', title: '七里香', note: '夏天的感觉' }] },
      'call_c',
    );
    expect(panel?.kind).toBe('content');
    if (panel?.kind !== 'content') return;
    expect(panel.items[0]).toMatchObject({ cover: 'https://img/x.jpg', author: '周杰伦', note: '夏天的感觉' });
  });

  it('空的作品面板不弹', () => {
    expect(scenePanelFromToolCall('ui_show_content', { title: 'x', items: [] }, 'c')).toBeNull();
  });

  it('详情页地址按类型走契约里的路由;不认识的类型没有地址', () => {
    expect(contentHref({ id: '5', contentType: 'MUSIC', title: 't' })).toBe('/detail/music-detail?id=5');
    expect(contentHref({ id: '5', contentType: 'SHORT_DRAMA', title: 't' })).toContain('?id=5');
    expect(contentHref({ id: '5', contentType: 'NOPE', title: 't' })).toBeNull();
  });

  it('卡片形状跟类型走', () => {
    expect(cardShape({ id: '1', contentType: 'MUSIC', title: 't' })).toBe('square');
    expect(cardShape({ id: '1', contentType: 'FILM', title: 't' })).toBe('poster');
    expect(cardShape({ id: '1', contentType: 'LIVE', title: 't' })).toBe('wide');
    expect(cardShape({ id: '1', contentType: 'NEWS', title: 't' })).toBe('text');
    expect(cardShape({ id: '1', contentType: 'PERSON', title: 't' })).toBe('avatar');
  });
});

describe('快捷选项', () => {
  it('send 缺省用 label;少于两个不显示;最多六个', () => {
    expect(normalizeChoices({ options: [{ label: '电影' }, { label: '动画', send: '我想看动画' }] })).toEqual({
      prompt: undefined,
      options: [
        { label: '电影', send: '电影' },
        { label: '动画', send: '我想看动画' },
      ],
    });
    expect(normalizeChoices({ options: [{ label: '只有一个' }] })).toBeNull();
    expect(normalizeChoices({ options: 'abcdefgh'.split('').map((label) => ({ label })) })?.options).toHaveLength(6);
  });
});

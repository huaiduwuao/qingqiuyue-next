import { describe, it, expect } from 'vitest';
import { parseResultTab, searchHref, toCreatorItems, toSearchItems, toTopicItems } from './searchModel';

describe('searchModel', () => {
  it('parseResultTab 只认三个子页签,其余回到 all', () => {
    expect(parseResultTab('content')).toBe('content');
    expect(parseResultTab('creator')).toBe('creator');
    expect(parseResultTab('topic')).toBe('topic');
    expect(parseResultTab('xx')).toBe('all');
    expect(parseResultTab(null)).toBe('all');
  });

  it('searchHref 带上关键词、AI 模式和筛选参数', () => {
    expect(searchHref('', false)).toBe('/search');
    expect(searchHref('三体', false)).toBe('/search?q=%E4%B8%89%E4%BD%93');
    expect(searchHref('a', true, 'tab=content&type=FILM')).toBe('/search?q=a&mode=ai&tab=content&type=FILM');
    expect(searchHref('', false, 'usable=1')).toBe('/search?usable=1');
  });

  it('toSearchItems 归一字段并推断命中位置', () => {
    const items = toSearchItems(
      {
        list: [
          { id: 1, title: 'Hello World', type: 'film', author: 'x', score: 0.5, usable: 1, reason: 'title-exact' },
          { id: 2, name: '无题', author: 'Hello 作者' },
          { id: 3, title: '别的', info: '简介', mergedCount: 2, variants: [{ id: 9, contentType: 'FILM' }] },
        ],
      },
      'hello',
    );
    expect(items[0]).toMatchObject({ id: 1, contentType: 'FILM', matchField: 'title', score: 0.5, usable: true, reason: 'title-exact' });
    expect(items[1]).toMatchObject({ id: 2, title: '无题', contentType: 'VIDEO', matchField: 'author', usable: false });
    expect(items[2]).toMatchObject({ subtitle: '简介', author: '清秋月', matchField: 'subtitle', mergedCount: 2 });
    expect(items[2].variants).toHaveLength(1);
    expect(toSearchItems(null, 'a')).toEqual([]);
    expect(toSearchItems([{ id: 5, title: 't' }], '')[0].matchField).toBe('subtitle');
  });

  it('toCreatorItems / toTopicItems 兜底默认值', () => {
    const [c] = toCreatorItems([{ id: 7, name: '', nickname: '昵称', avatar: 'a.png' } as never]);
    expect(c).toMatchObject({ id: 7, name: '昵称', bio: '', avatarGradient: 'url(a.png)', followers: 0, works: 0, verified: false, tags: [] });
    const [t] = toTopicItems([{ id: 8, title: '' } as never]);
    expect(t).toMatchObject({ id: 8, title: '话题', discussCount: 0, viewCount: 0, hot: false });
    expect(t.gradient).toContain('linear-gradient');
  });
});

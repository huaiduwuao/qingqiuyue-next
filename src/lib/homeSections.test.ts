import { describe, expect, it } from 'vitest';

import {
  BUILTIN_TYPE_SECTIONS,
  DEFAULT_SECTION_IDS,
  RECOMMEND_SECTION,
  builtinSection,
  keywordSectionId,
  makeKeywordSection,
  makeTagSection,
  makeTopicSection,
  makeTypeSection,
  parseSectionId,
  sectionQueryParams,
  tagSectionId,
  topicSectionId,
  typeSectionId,
} from './homeSections';

// 频道是用户自己攒的,id 会进 URL 和 localStorage 长期躺着。这里守的是
// "老链接还能开"和"每一格取到的是它该取的东西"——两者错了都不会报错,只会空。

describe('频道 id', () => {
  it('预置频道沿用老的 section 名,旧链接照样打开', () => {
    // ?section=game / novel / film 这些都是线上已经存在的地址
    for (const id of ['recommend', 'novel', 'comics', 'film', 'teleplay', 'entertainment', 'music', 'anime', 'news', 'game']) {
      expect(builtinSection(id), id).toBeTruthy();
      expect(parseSectionId(id)?.id, id).toBe(id);
    }
  });

  it('默认摆出来的频道都在预置清单里', () => {
    for (const id of DEFAULT_SECTION_IDS) {
      expect(builtinSection(id), id).toBeTruthy();
    }
  });

  it('预置清单里没有重复 id', () => {
    const ids = BUILTIN_TYPE_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('同一个来源加两次是同一格', () => {
    expect(typeSectionId('NOVEL')).toBe(typeSectionId('NOVEL'));
    expect(typeSectionId('NOVEL', 'xianxia')).not.toBe(typeSectionId('NOVEL'));
    expect(tagSectionId('仙侠')).toBe(makeTagSection('仙侠').id);
    expect(topicSectionId(5)).toBe(makeTopicSection(5, '追剧日常').id);
    expect(keywordSectionId(' 仙侠 ')).toBe(makeKeywordSection('仙侠').id);
  });
});

describe('parseSectionId:列表里没有的频道也要能渲染', () => {
  it('还原专题 / 关键词 / 标签 / 大类+题材', () => {
    expect(parseSectionId('topic:5')).toMatchObject({ kind: 'topic', topicId: '5' });
    expect(parseSectionId('kw:仙侠')).toMatchObject({ kind: 'keyword', keyword: '仙侠' });
    expect(parseSectionId('tag:仙侠')).toMatchObject({ kind: 'tag', tag: '仙侠' });
    expect(parseSectionId('tag:NOVEL:仙侠')).toMatchObject({ kind: 'tag', tag: '仙侠', contentType: 'NOVEL' });
    expect(parseSectionId('t:NOVEL:xianxia')).toMatchObject({ kind: 'type', contentType: 'NOVEL', genre: 'xianxia' });
  });

  it('标签本身带冒号时不会被当成大类前缀', () => {
    // 大类一律大写,小写的前半截说明这整串就是标签
    expect(parseSectionId('tag:a:b')).toMatchObject({ kind: 'tag', tag: 'a:b' });
  });

  it('认不出来的 id 返回 null(调用方回落到推荐)', () => {
    expect(parseSectionId('')).toBeNull();
    expect(parseSectionId('topic:')).toBeNull();
    expect(parseSectionId('kw:')).toBeNull();
    expect(parseSectionId('什么东西')).toBeNull();
  });

  it('makeXxx 造出来的频道都解析得回去', () => {
    for (const s of [
      makeTypeSection('FILM', '影视'),
      makeTagSection('美食'),
      makeTopicSection(12, '今天看了什么'),
      makeKeywordSection('仙侠'),
    ]) {
      expect(parseSectionId(s.id)?.kind, s.id).toBe(s.kind);
    }
  });
});

describe('sectionQueryParams:每一格取什么内容', () => {
  it('推荐流不带任何筛选(聚合流自己按类型轮取)', () => {
    expect(sectionQueryParams(RECOMMEND_SECTION)).toEqual({});
  });

  it('大类频道只带 contentType', () => {
    expect(sectionQueryParams(builtinSection('novel')!)).toEqual({ contentType: 'NOVEL' });
  });

  it('题材走 tag + 中文名:线上 metadata.genre 是逗号串,JSON_CONTAINS 查不到东西', () => {
    const s = makeTypeSection('NOVEL', '小说', 'xianxia', '仙侠');
    expect(s.label).toBe('小说·仙侠');
    expect(sectionQueryParams(s)).toEqual({ contentType: 'NOVEL', tag: '仙侠' });
    // 没有中文名时退回 code(拿不到内容也好过瞎猜)
    expect(sectionQueryParams(makeTypeSection('NOVEL', '小说', 'xianxia'))).toEqual({
      contentType: 'NOVEL',
      tag: 'xianxia',
    });
  });

  it('标签频道带 tag,关键词频道带 keyword', () => {
    expect(sectionQueryParams(builtinSection('game')!)).toEqual({ tag: '游戏' });
    expect(sectionQueryParams(makeTagSection('仙侠', 'NOVEL'))).toEqual({ contentType: 'NOVEL', tag: '仙侠' });
    expect(sectionQueryParams(makeKeywordSection('仙侠'))).toEqual({ keyword: '仙侠' });
  });

  it('专题频道不走内容列表接口(走专题收录),所以没有筛选参数', () => {
    expect(sectionQueryParams(makeTopicSection(5, '追剧日常'))).toEqual({});
  });

  it('老页签 游戏/美食/科技/知识/体育/财经 不再共用一个内容类型', () => {
    // 它们以前都映射到 VIDEO 或 ARTICLE,六个页签内容一模一样
    const params = ['game', 'food', 'tech', 'knowledge', 'sports', 'finance'].map(
      (id) => JSON.stringify(sectionQueryParams(builtinSection(id)!)),
    );
    expect(new Set(params).size).toBe(params.length);
  });
});

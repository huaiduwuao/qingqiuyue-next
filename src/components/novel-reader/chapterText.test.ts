import { describe, it, expect } from 'vitest';
import { extractParagraphs, splitParagraphs, wordCount, chapterQueryKey } from './chapterText';

describe('splitParagraphs', () => {
  it('按换行拆段,CRLF / CR 都认,空行丢掉', () => {
    expect(splitParagraphs('第一段\r\n\r\n第二段\r第三段\n\n\n')).toEqual(['第一段', '第二段', '第三段']);
  });

  it('去掉段首段尾的半角 / 全角 / 不换行空格,段中空格保留', () => {
    expect(splitParagraphs('　　他说 你好 \n  \t第二段　')).toEqual(['他说 你好', '第二段']);
  });

  it('只有空白时返回空数组', () => {
    expect(splitParagraphs(' \n　\n ')).toEqual([]);
  });
});

describe('extractParagraphs', () => {
  it('普通正文走换行分段', () => {
    expect(extractParagraphs('甲\n乙')).toEqual(['甲', '乙']);
  });

  it('legacy 整本 JSON:取各章 body 再分段,空 body 跳过', () => {
    const json = JSON.stringify({ chapters: [{ body: '一\n二' }, { body: '' }, { title: '无正文' }, { body: '三' }] });
    expect(extractParagraphs(json)).toEqual(['一', '二', '三']);
  });

  it('长得像 JSON 但解析失败:当普通正文', () => {
    expect(extractParagraphs('{"chapters": 坏的\n下一段')).toEqual(['{"chapters": 坏的', '下一段']);
  });

  it('JSON 但没有 chapters 数组:当普通正文', () => {
    expect(extractParagraphs('{"chapters": 1}')).toEqual(['{"chapters": 1}']);
  });
});

describe('wordCount / chapterQueryKey', () => {
  it('字数不算空白', () => {
    expect(wordCount('　　你好 世界\n！')).toBe(5);
  });

  it('滚动 / 分页两种模式共用同一个缓存键', () => {
    expect(chapterQueryKey('42')).toEqual(['novel-chapter', '42']);
  });
});

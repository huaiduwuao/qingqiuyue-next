import { describe, expect, it } from 'vitest';
import { scenePanelFromToolCall, SCENE_PANEL_TOOLS } from '../scene-ui/types';
import { summarizeDraftReport } from '@/apis/sourceSetup';

// ui_show_source_draft:接入助手试跑通过后弹出的草稿卡片(后端 engine/tools_source_setup.go)。
describe('ui_show_source_draft', () => {
  it('解析出草稿 id', () => {
    expect(scenePanelFromToolCall('ui_show_source_draft', { draft_id: ' 123 ' }, 'call-1')).toEqual({
      kind: 'source_draft', id: 'call-1', title: '接入草稿', subtitle: undefined, draftId: '123',
    });
  });

  it('没有草稿 id 不弹', () => {
    expect(scenePanelFromToolCall('ui_show_source_draft', { title: 'x' }, 'c')).toBeNull();
    expect(scenePanelFromToolCall('ui_show_source_draft', { draft_id: '  ' }, 'c')).toBeNull();
  });

  it('注册为场景面板工具', () => {
    expect(SCENE_PANEL_TOOLS.ui_show_source_draft).toBe('source_draft');
  });
});

describe('summarizeDraftReport', () => {
  it('小说报告', () => {
    const lines = summarizeDraftReport({
      kind: 'book',
      report: {
        search: { count: 3 },
        resolved: { title: '斗破苍穹' },
        catalog: { count: 1648, first: { title: '第一章' }, last: { title: '第1648章' } },
        chapter: { title: '第一章', length: 9000 },
      },
    });
    expect(lines).toEqual(['搜索到 3 条', '定位到「斗破苍穹」', '目录 1648 章:第一章 … 第1648章', '第 1 章「第一章」9000 字节']);
  });

  it('影视报告与出错', () => {
    const lines = summarizeDraftReport({
      kind: 'video',
      report: { search: { error: 'HTTP 403' }, resolve_error: '没有标题(+ 年份)对得上的结果' },
    });
    expect(lines).toEqual(['搜索出错:HTTP 403', '没有标题(+ 年份)对得上的结果']);
    expect(summarizeDraftReport({ kind: 'video', report: { episodes: { count: 2, first: [{ title: '第1集' }, { title: '第2集' }] } } }))
      .toEqual(['共 2 集:第1集、第2集']);
    expect(summarizeDraftReport({ kind: 'video', report: null })).toEqual([]);
  });
});

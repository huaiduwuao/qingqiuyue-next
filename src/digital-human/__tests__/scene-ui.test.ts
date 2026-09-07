import { describe, it, expect } from 'vitest';
import {
  scenePanelFromToolCall,
  SCENE_PANEL_TOOLS,
  SCENE_PANEL_DISMISS_TOOL,
} from '../scene-ui/types';
import { stripAvatarDirectives } from '../useChatAvatarWS';

describe('scenePanelFromToolCall', () => {
  it('把 ui_show_list 的参数转成列表面板', () => {
    const panel = scenePanelFromToolCall(
      'ui_show_list',
      {
        title: '搜到 2 个资源',
        subtitle: '按热度排序',
        items: [
          { id: 'a', title: '流浪地球', subtitle: '科幻 / 2019', action: '打开流浪地球' },
          { id: 'b', title: '三体', subtitle: '科幻 / 2023' },
        ],
      },
      'call_1',
    );
    expect(panel).toMatchObject({
      kind: 'list',
      id: 'call_1',
      title: '搜到 2 个资源',
      subtitle: '按热度排序',
    });
    expect(panel && panel.kind === 'list' && panel.items).toHaveLength(2);
  });

  it('ui_show_grid 的 columns 夹在 2-4 之间', () => {
    const wide = scenePanelFromToolCall('ui_show_grid', { title: 'x', columns: 9, items: [{ id: '1', title: 'a' }] }, 'c');
    const narrow = scenePanelFromToolCall('ui_show_grid', { title: 'x', columns: 1, items: [{ id: '1', title: 'a' }] }, 'c');
    const missing = scenePanelFromToolCall('ui_show_grid', { title: 'x', items: [{ id: '1', title: 'a' }] }, 'c');
    expect(wide && wide.kind === 'grid' && wide.columns).toBe(4);
    expect(narrow && narrow.kind === 'grid' && narrow.columns).toBe(2);
    expect(missing && missing.kind === 'grid' && missing.columns).toBe(3);
  });

  it('ui_show_form 保留字段并把未知类型退化成 text', () => {
    const panel = scenePanelFromToolCall(
      'ui_show_form',
      {
        title: '发布悬赏',
        submitText: '发布',
        fields: [
          { name: 'title', label: '标题', type: 'text', required: true },
          { name: 'detail', label: '详情', type: 'textarea' },
          { name: 'pay', label: '赏金', type: 'number' },
          { name: 'weird', label: '奇怪的', type: 'color-picker' },
        ],
      },
      'call_form',
    );
    expect(panel?.kind).toBe('form');
    if (panel?.kind !== 'form') throw new Error('expected form');
    expect(panel.fields.map((f) => f.type)).toEqual(['text', 'textarea', 'number', 'text']);
    expect(panel.submitText).toBe('发布');
    expect(panel.fields[0].required).toBe(true);
  });

  it('空列表 / 空表单不弹面板(宁可不弹也不弹个空板子)', () => {
    expect(scenePanelFromToolCall('ui_show_list', { title: 'x', items: [] }, 'c')).toBeNull();
    expect(scenePanelFromToolCall('ui_show_form', { title: 'x', fields: [] }, 'c')).toBeNull();
    expect(scenePanelFromToolCall('ui_show_list', { title: 'x' }, 'c')).toBeNull();
  });

  it('丢掉没有标题的条目,而不是渲染一排空白', () => {
    const panel = scenePanelFromToolCall(
      'ui_show_list',
      { title: 'x', items: [{ id: '1', title: 'ok' }, { id: '2' }, null, 'junk'] },
      'c',
    );
    expect(panel && panel.kind === 'list' && panel.items).toHaveLength(1);
  });

  it('非 UI 工具名返回 null', () => {
    expect(scenePanelFromToolCall('resource_search', { title: 'x' }, 'c')).toBeNull();
    expect(scenePanelFromToolCall('ui_show_list', undefined, 'c')).toBeNull();
  });

  it('工具名映射与后端 tools_ui.go 对齐', () => {
    expect(Object.keys(SCENE_PANEL_TOOLS).sort()).toEqual(
      ['ui_show_form', 'ui_show_grid', 'ui_show_list'],
    );
    expect(SCENE_PANEL_DISMISS_TOOL).toBe('ui_dismiss');
  });
});

describe('stripAvatarDirectives', () => {
  it('剥掉表情/动作/口型标签', () => {
    expect(stripAvatarDirectives('<emotion:happy/><action:wave/>你好呀')).toBe('你好呀');
    expect(stripAvatarDirectives('先想想<mouth:speak/>好了')).toBe('先想想好了');
  });

  it('不动普通文本里的尖括号', () => {
    expect(stripAvatarDirectives('a < b 且 c > d')).toBe('a < b 且 c > d');
  });

  it('保留标签之间的文字顺序', () => {
    expect(stripAvatarDirectives('<action:bow/>谢谢<emotion:happy/>你')).toBe('谢谢你');
  });

  // 这是旧正则最要命的一条:嵌套的 <ui:{...}/> 既解析不出来、也剥不掉,
  // 原始 JSON 直接漏进聊天气泡,还会被 TTS 一字一句念出来。
  it('剥掉带嵌套的 <ui:{json}/>,不把原始 JSON 漏给用户', () => {
    const s = '好的<ui:{"type":"modal","body":{"type":"list","content":{"items":[{"id":"1"}]}}}/>请看';
    expect(stripAvatarDirectives(s)).toBe('好的请看');
  });

  it('剥掉扁平的 iframe 指令', () => {
    const s = '<ui:{"type":"iframe","url":"https://a.com/x?a=1&b=2","title":"网页"}/>打开了';
    expect(stripAvatarDirectives(s)).toBe('打开了');
  });

  it('字符串里的花括号不影响配对', () => {
    const s = '<ui:{"type":"iframe","title":"a{b}c"}/>ok';
    expect(stripAvatarDirectives(s)).toBe('ok');
  });

  it('还没闭合的指令原样保留,等后续 chunk(不半途剥坏)', () => {
    const s = '好的<ui:{"type":"iframe","url":"htt';
    expect(stripAvatarDirectives(s)).toBe(s);
  });
});

import { describe, it, expect } from 'vitest';
import { scenePanelFromToolCall, SCENE_PANEL_TOOLS } from '../scene-ui/types';
import { isAvatarTool } from '../tools/dispatcher';

// ui_show_operation:ops_propose 之后数字人弹出的部署操作卡片(后端 engine/tools_ops.go)。
describe('ui_show_operation', () => {
  it('转成部署操作卡片,只带操作 id', () => {
    expect(scenePanelFromToolCall('ui_show_operation', { operation_id: ' op-1 ' }, 'call-1')).toEqual({
      kind: 'operation', id: 'call-1', title: '部署操作', subtitle: undefined, operationId: 'op-1',
    });
  });

  it('保留模型给的标题', () => {
    const p = scenePanelFromToolCall('ui_show_operation', { operation_id: 'op-2', title: '部署新版本' }, 'c');
    expect(p?.title).toBe('部署新版本');
  });

  it('没有 operation_id 不弹卡片', () => {
    expect(scenePanelFromToolCall('ui_show_operation', { title: 'x' }, 'c')).toBeNull();
    expect(scenePanelFromToolCall('ui_show_operation', { operation_id: '  ' }, 'c')).toBeNull();
  });

  it('注册为场景面板工具,不进形象 dispatcher', () => {
    expect(SCENE_PANEL_TOOLS.ui_show_operation).toBe('operation');
    for (const name of ['ui_show_operation', 'ops_propose', 'ops_fleet_status']) {
      expect(isAvatarTool(name)).toBe(false);
    }
  });
});

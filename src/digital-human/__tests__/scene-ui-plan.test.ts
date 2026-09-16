import { describe, expect, it } from 'vitest';
import { scenePanelFromToolCall, SCENE_PANEL_TOOLS } from '../scene-ui/types';
import { planProgress } from '../scene-ui/PlanPanel';

describe('ui_show_plan → plan panel', () => {
  it('normalizes steps and uses the plan id so updates replace the board', () => {
    const p = scenePanelFromToolCall('ui_show_plan', {
      id: 'deploy-1',
      title: '发布网站',
      steps: [
        { id: 'a', title: '跑测试', status: 'done' },
        { title: '构建镜像', status: 'running', detail: '第 3 分钟' },
        { title: '上线', status: 'weird' },
        { title: '' },
        'junk',
      ],
    }, 'call-9');
    expect(p).toEqual({
      kind: 'plan', id: 'deploy-1', title: '发布网站', subtitle: undefined,
      steps: [
        { id: 'a', title: '跑测试', status: 'done', detail: undefined },
        { id: 'step-1', title: '构建镜像', status: 'running', detail: '第 3 分钟' },
        { id: 'step-2', title: '上线', status: 'pending', detail: undefined },
      ],
    });
    const noId = scenePanelFromToolCall('ui_show_plan', { steps: [{ title: 'x', status: 'pending' }] }, 'call-2');
    expect(noId && noId.id).toBe('call-2');
    expect(noId && noId.title).toBe('任务进度');
  });

  it('refuses a board without steps', () => {
    expect(scenePanelFromToolCall('ui_show_plan', { title: 'x', steps: [] }, 'c')).toBeNull();
    expect(scenePanelFromToolCall('ui_show_plan', { title: 'x' }, 'c')).toBeNull();
  });

  it('is registered and reports progress', () => {
    expect(SCENE_PANEL_TOOLS.ui_show_plan).toBe('plan');
    expect(planProgress([
      { id: '1', title: 'a', status: 'done' },
      { id: '2', title: 'b', status: 'skipped' },
      { id: '3', title: 'c', status: 'running' },
      { id: '4', title: 'd', status: 'pending' },
    ])).toEqual({ done: 2, total: 4, percent: 50 });
    expect(planProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
  });
});

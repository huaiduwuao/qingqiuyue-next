import { describe, expect, it } from 'vitest';
import { scenePanelFromToolCall, SCENE_PANEL_TOOLS } from '../scene-ui/types';

describe('ui_show_run → run panel', () => {
  it('carries only the run id; title falls back', () => {
    expect(scenePanelFromToolCall('ui_show_run', { run_id: ' r-1 ' }, 'call-1')).toEqual({
      kind: 'run', id: 'call-1', title: '后台任务', subtitle: undefined, runId: 'r-1',
    });
    const p = scenePanelFromToolCall('ui_show_run', { run_id: 'r-2', title: '整理悬赏' }, 'c');
    expect(p && p.kind === 'run' && p.title).toBe('整理悬赏');
  });

  it('refuses to open without a run id', () => {
    expect(scenePanelFromToolCall('ui_show_run', { title: 'x' }, 'c')).toBeNull();
    expect(scenePanelFromToolCall('ui_show_run', { run_id: '  ' }, 'c')).toBeNull();
  });

  it('is registered as a scene panel tool', () => {
    expect(SCENE_PANEL_TOOLS.ui_show_run).toBe('run');
  });
});

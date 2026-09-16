import { describe, expect, it, vi } from 'vitest';
import { dispatchToolCall, dispatchToolCalls, isAvatarTool, type DigitalHumanSinks } from '../tools/dispatcher';
import { applyDispatchResults, buildSceneState, SCENE_ANCHORS } from '../scene-state';

function sinks(): DigitalHumanSinks & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    setEmotion: () => calls.push('emotion'),
    setViseme: () => {},
    setVisemeTimeline: () => {},
    setJawOpen: () => {},
    setAction: (n) => calls.push(`action:${n}`),
    speak: () => {},
    move: (t, o) => calls.push(`move:${typeof t === 'string' ? t : `${t.x},${t.z}`}:${o?.style}`),
    camera: (a) => calls.push(`camera:${a}`),
    setScene: (n) => calls.push(`scene:${n}`),
    setCameraPreset: (n) => calls.push(`preset:${n}`),
    setPose: (n) => calls.push(`pose:${n}`),
    setDancing: (on) => calls.push(`dance:${on}`),
    setDanceStyle: (s) => calls.push(`style:${s}`),
  };
}

describe('scene_act → sinks', () => {
  it('is an avatar tool, so it reaches the dispatcher', () => {
    expect(isAvatarTool('scene_act')).toBe(true);
    expect(isAvatarTool('resource_search')).toBe(false);
  });

  it('relays to the existing tools and keeps their validation', () => {
    const s = sinks();
    expect(dispatchToolCall({ name: 'scene_act', args: { action: 'play_action', name: 'wave' } }, s).ok).toBe(true);
    expect(dispatchToolCall({ name: 'scene_act', args: { action: 'play_action', name: 'moonwalk' } }, s)).toMatchObject({ ok: false, toolName: 'scene_act' });
    expect(dispatchToolCall({ name: 'scene_act', args: { action: 'move_to', target: 'left', style: 'run' } }, s).ok).toBe(true);
    expect(dispatchToolCall({ name: 'scene_act', args: { action: 'move_to', target: '1.5, -2' } }, s).ok).toBe(true);
    expect(dispatchToolCall({ name: 'scene_act', args: { action: 'move_to', target: 'moon' } }, s).ok).toBe(false);
    expect(dispatchToolCall({ name: 'scene_act', args: { action: 'camera', name: 'three' } }, s).ok).toBe(true);
    expect(dispatchToolCall({ name: 'scene_act', args: { action: 'camera', name: 'zoomIn' } }, s).ok).toBe(true);
    expect(dispatchToolCall({ name: 'scene_act', args: { action: 'scene', name: 'garden' } }, s).ok).toBe(true);
    expect(dispatchToolCall({ name: 'scene_act', args: { action: 'pose', name: 'sit' } }, s).ok).toBe(true);
    expect(dispatchToolCall({ name: 'scene_act', args: { action: 'dance', name: 'idol' } }, s).ok).toBe(true);
    expect(dispatchToolCall({ name: 'scene_act', args: { action: 'dance', name: 'stop' } }, s).ok).toBe(true);
    expect(dispatchToolCall({ name: 'scene_act', args: { action: 'fly' } }, s).ok).toBe(false);
    expect(s.calls).toEqual([
      'action:wave', 'move:left:run', 'move:1.5,-2:walk', 'preset:three', 'camera:zoomIn', 'scene:garden', 'pose:sit',
      'style:idol', 'dance:true', 'dance:false',
    ]);
  });

  it('snapshot only records what was actually executed', () => {
    const s = sinks();
    const results = dispatchToolCalls([
      { name: 'scene_act', args: { action: 'play_action', name: 'bow' } },
      { name: 'scene_act', args: { action: 'set_expression', name: 'happy' } },
      { name: 'scene_act', args: { action: 'move_to', target: 'right' } },
      { name: 'scene_act', args: { action: 'scene', name: 'neon' } },
      { name: 'scene_act', args: { action: 'camera', name: 'side' } },
      { name: 'scene_act', args: { action: 'play_action', name: 'nope' } },
    ], s);
    const snap = applyDispatchResults({}, results);
    expect(snap).toEqual({ action: 'bow', expression: 'happy', position: 'right', scene: 'neon', camera: 'side' });
    const state = buildSceneState(snap);
    expect(state.version).toBe(1);
    expect(state.anchors).toEqual(SCENE_ANCHORS);
    expect(state.avatar).toMatchObject({ action: 'bow', expression: 'happy', position: 'right' });
    expect(state.actions).toContain('wave');
    expect(state.expressions).toContain('happy');
    expect(state.scenes).toContain('garden');
    expect(state.cameras).toContain('three');
    expect(buildSceneState({}).avatar).toEqual({ action: 'idle', expression: 'neutral', position: 'center', model: undefined });
    vi.restoreAllMocks();
  });
});

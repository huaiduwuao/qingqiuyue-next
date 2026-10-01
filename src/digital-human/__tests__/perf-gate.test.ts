import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearVerdict, loadVerdict, quickCheck, saveVerdict } from '../perfGate';

function fakeGL(renderer: string | null) {
  const orig = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    if (tag !== 'canvas') return orig(tag);
    const c = orig('canvas') as HTMLCanvasElement;
    (c as any).getContext = () => (renderer === null ? null : {
      RENDERER: 0x1f01,
      getExtension: (n: string) => (n === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 0x9246 } : n === 'WEBGL_lose_context' ? { loseContext() {} } : null),
      getParameter: () => renderer,
    });
    return c;
  }) as typeof document.createElement);
}

afterEach(() => {
  vi.restoreAllMocks();
  clearVerdict();
  Object.defineProperty(navigator, 'deviceMemory', { value: undefined, configurable: true });
});

describe('digital human perf gate', () => {
  it('blocks when WebGL2 is unavailable', () => {
    fakeGL(null);
    const v = quickCheck();
    expect(v.blocked).toBe(true);
    expect(v.reason).toContain('WebGL2');
  });

  it('blocks software renderers (no hardware acceleration)', () => {
    fakeGL('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)');
    expect(quickCheck().blocked).toBe(true);
    vi.restoreAllMocks();
    fakeGL('llvmpipe (LLVM 15.0.7, 256 bits)');
    expect(quickCheck().reason).toBe('显卡在用软件渲染');
  });

  it('blocks devices with under 2 GB of memory', () => {
    fakeGL('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060)');
    Object.defineProperty(navigator, 'deviceMemory', { value: 1, configurable: true });
    expect(quickCheck().reason).toBe('设备内存不足');
  });

  it('lets a real GPU through', () => {
    fakeGL('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)');
    Object.defineProperty(navigator, 'deviceMemory', { value: 8, configurable: true });
    expect(quickCheck().blocked).toBe(false);
  });

  it('remembers a block for 3 days, then forgets it', () => {
    saveVerdict({ blocked: true, reason: '设备性能不够' });
    expect(loadVerdict()?.reason).toBe('设备性能不够');
    const raw = JSON.parse(localStorage.getItem('dh_perf_gate')!);
    localStorage.setItem('dh_perf_gate', JSON.stringify({ ...raw, at: Date.now() - 4 * 24 * 3600 * 1000 }));
    expect(loadVerdict()).toBeNull();
  });
});

/**
 * Mock 启动器。
 * mockEnabled === false 时,startMock() 立即 resolve 且不做任何事(生产环境 tree-shake 友好)。
 */

const rawMock = process.env.NEXT_PUBLIC_USE_MOCK;
export const mockEnabled = rawMock === '1' || rawMock === 'true';

let started = false;

/**
 * 注销可能残留的 mock service worker。
 * mock 关闭时(生产 / compose 构建)调用,确保浏览器里早先注册的
 * mockServiceWorker.js 不再拦截真实请求。
 */
export async function stopMock(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/mockServiceWorker.js');
    if (reg) await reg.unregister();
  } catch {
    /* 注销失败无所谓:SW 无激活客户端时本就放行 */
  }
}

export async function startMock(): Promise<void> {
  if (!mockEnabled) return;
  if (typeof window === 'undefined') return;
  if (started) return;
  started = true;

  try {
    const { worker } = await import('./browser');
    await worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: { url: '/mockServiceWorker.js' },
      quiet: true,
    });
  } catch (err) {
    console.error('[MSW] worker.start() failed:', err);
    throw err;
  }
}

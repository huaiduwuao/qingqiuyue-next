/**
 * Mock 启动器。
 * mockEnabled === false 时,startMock() 立即 resolve 且不做任何事(生产环境 tree-shake 友好)。
 */

const rawMock = process.env.NEXT_PUBLIC_USE_MOCK;
export const mockEnabled = rawMock === '1' || rawMock === 'true';

let started = false;

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

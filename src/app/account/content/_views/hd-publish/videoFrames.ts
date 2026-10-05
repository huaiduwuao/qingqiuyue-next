/**
 * 在浏览器里从视频文件均匀截几帧当封面候选(<video> + canvas,不经服务端)。
 *
 * 只有同源(站内 /qq-media/...)或带 CORS 头的视频能截:跨域没授权时视频要么加载失败,
 * 要么画布被污染、toBlob 抛 SecurityError —— 都按「截不了」处理,调用方退回上传图片。
 */

function waitFor(el: HTMLVideoElement, event: string, timeoutMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      el.removeEventListener(event, onOk);
      el.removeEventListener('error', onErr);
      signal?.removeEventListener('abort', onAbort);
    };
    const onOk = () => {
      cleanup();
      resolve();
    };
    const onErr = () => {
      cleanup();
      reject(new Error('视频加载失败'));
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException('aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('视频加载超时'));
    }, timeoutMs);
    el.addEventListener(event, onOk, { once: true });
    el.addEventListener('error', onErr, { once: true });
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export interface CaptureOptions {
  /** 截几帧,默认 4,均匀分布在片中(避开开头结尾的黑场) */
  count?: number;
  /** 输出最长边,默认 1280 */
  maxSize?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export async function captureVideoFrames(src: string, opts: CaptureOptions = {}): Promise<Blob[]> {
  const { count = 4, maxSize = 1280, timeoutMs = 15_000, signal } = opts;
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  try {
    const loaded = waitFor(video, 'loadeddata', timeoutMs, signal);
    video.src = src;
    await loaded;
    const duration = video.duration;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!Number.isFinite(duration) || duration <= 0 || !vw || !vh) return [];
    const scale = Math.min(1, maxSize / Math.max(vw, vh));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vw * scale);
    canvas.height = Math.round(vh * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];
    const frames: Blob[] = [];
    for (let i = 1; i <= count; i += 1) {
      const seeked = waitFor(video, 'seeked', timeoutMs, signal);
      video.currentTime = (duration * i) / (count + 1);
      await seeked;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      // 跨域未授权时这里抛 SecurityError
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
      if (blob) frames.push(blob);
    }
    return frames;
  } finally {
    video.removeAttribute('src');
    video.load();
  }
}

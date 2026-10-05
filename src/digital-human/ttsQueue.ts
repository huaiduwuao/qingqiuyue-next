/**
 * 语音:逐句合成、逐句播放,形象指令跟着声音走(从 useChatAvatarWS.ts 拆出,行为不变)。
 *
 * 一轮回复被切成若干「句」(Utterance):这句要念的文本 + 写在这句里的形象指令(表情/动作)。
 * 句子排队串行播放(共用一个 <audio>,不排队后一句会把前一句掐掉)。
 *
 * 同步的关键在 onStart:它在这句的音频真正响起来(audio 的 playing 事件)那一刻才触发,
 * 表情和动作都挂在它上面。以前指令是「文本流到就立刻执行」—— 模型 3 秒写完 5 句话,
 * 而 5 句话要念 20 秒,于是第 5 句的挥手在它开口前 17 秒就挥完了。口型则由 VrmStage
 * 直接分析这个 <audio> 的频谱驱动,三者因此共用同一个时钟:正在播放的声音。
 */
import type React from 'react';
import { devLog } from '@/lib/dev-log';
import { musicPlayer } from '@/lib/player/musicPlayer';
import { API_PREFIX } from '@/lib/api/prefix';
import { authFetch } from '@/lib/api/auth';

export interface Utterance {
  /** 送去合成的文本;空 = 这句没有可念的内容,只触发指令 */
  text: string;
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
  signal?: AbortSignal;
  /** 这句开始出声时触发(合成失败/无文本时立刻触发),保证只调一次 */
  onStart?: () => void;
  /** 提前发出的合成请求(上一句还在念的时候就开始合成下一句,句间不留空档) */
  res?: Promise<Response | null>;
}

const ttsQueue: Utterance[] = [];
let ttsRunning = false;
/** 队列念空时通知(同一时刻只有一个数字人在说话,单个回调够用) */
let onTTSIdle: (() => void) | null = null;

/** 挂上「队列念空」回调;返回的清理函数只在回调还是自己时才摘掉 */
export function setTTSIdleListener(cb: () => void): () => void {
  onTTSIdle = cb;
  return () => { if (onTTSIdle === cb) onTTSIdle = null; };
}

function requestTTS(text: string, signal?: AbortSignal): Promise<Response | null> {
  return authFetch(API_PREFIX + '/api/audio/speech', {
    method: 'POST',
    // /api/audio/* 在网关上要登录会话;authFetch 补 Authorization,401 时通知 AuthContext
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'tts',
      input: text,
      voice: 'default',
      stream: true, // 上游按句切分 chunked 返回,边收边播
      response_format: 'mp3',
    }),
    signal,
  })
    .then((r) => (r.ok && r.body ? r : null))
    .catch(() => null);
}

/** 队首两句提前合成:正在念的这句之后那句,在它念完之前就该准备好。 */
function prefetchTTS() {
  for (const job of ttsQueue.slice(0, 2)) {
    if (job.text && !job.res && !job.signal?.aborted) job.res = requestTTS(job.text, job.signal);
  }
}

export function enqueueTTS(job: Utterance) {
  ttsQueue.push(job);
  prefetchTTS();
  void runTTSQueue();
}

/** 打断时调:丢掉还没播的句子(它们的指令也一并作废)。 */
export function clearTTSQueue() {
  ttsQueue.length = 0;
  musicPlayer.duck(false);
}

async function runTTSQueue() {
  if (ttsRunning) return;
  ttsRunning = true;
  try {
    while (ttsQueue.length > 0) {
      const job = ttsQueue.shift()!;
      if (job.signal?.aborted) continue;
      prefetchTTS();
      await playUtterance(job);
      if (job.signal?.aborted) break;
    }
  } finally {
    ttsRunning = false;
    if (ttsQueue.length === 0) {
      musicPlayer.duck(false);
      onTTSIdle?.();
    }
  }
}

async function playUtterance(job: Utterance) {
  let started = false;
  const fireStart = () => {
    if (started || job.signal?.aborted) return;
    started = true;
    try { job.onStart?.(); } catch (e) { devLog.warn('[tts] onStart failed', e); }
  };
  // 她开口时把正在放的歌压低,说完(队列念空)再恢复 —— 不然「给你放这首」和歌同时响
  if (job.text) musicPlayer.duck(true);

  const audio = job.audioRef.current;
  const res = job.text && audio ? await (job.res ?? requestTTS(job.text, job.signal)) : null;
  if (!res || !audio || job.signal?.aborted) {
    // 没有声音可等(没文本 / 合成失败 / 静音环境):指令照常执行,不拖住后面的句子
    fireStart();
    return;
  }

  const onPlaying = () => fireStart();
  audio.addEventListener('playing', onPlaying, { once: true });
  try {
    const ended = waitForAudioEnd(audio, job.signal);
    await feedAudio(res, audio);
    // 兜底:浏览器拦了自动播放之类,playing 迟迟不来 —— 指令不能跟着一起丢
    const guard = setTimeout(fireStart, 4000);
    await ended;
    clearTimeout(guard);
    fireStart();
  } finally {
    audio.removeEventListener('playing', onPlaying);
  }
}

// 每个 <audio> 当前挂着的 object URL。换下一句时先 revoke 上一句的:
// 之前整段下载的 blob URL 从不释放,MediaSource 的只在 ended 时释放 ——
// 被打断(barge-in)的句子永远等不到 ended,每句都漏一份音频 Blob。
const audioObjectUrls = new WeakMap<HTMLAudioElement, string>();

function setObjectSrc(audio: HTMLAudioElement, obj: Blob | MediaSource): string {
  const prev = audioObjectUrls.get(audio);
  if (prev) URL.revokeObjectURL(prev);
  const url = URL.createObjectURL(obj);
  audioObjectUrls.set(audio, url);
  audio.src = url;
  return url;
}

/**
 * 把一次合成响应喂给 <audio>。优先 MediaSource 边收边播(首包到了就出声),
 * 不支持时整段下载后再播。resolve 表示「已经开始喂了」,不等播完。
 */
async function feedAudio(res: Response, audio: HTMLAudioElement): Promise<void> {
  const tryPlay = () => { if (audio.paused) audio.play().catch(() => {}); };
  const canStream = typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported?.('audio/mpeg');
  if (!canStream || !res.body) {
    try {
      const blob = await res.blob();
      setObjectSrc(audio, blob);
      tryPlay();
    } catch { /* TTS 失败不影响文本 */ }
    return;
  }

  const ms = new MediaSource();
  const url = setObjectSrc(audio, ms);
  // 短句可能一个 chunk 就结束:光靠「追加后看 readyState」会错过开播时机,canplay 再补一次
  audio.addEventListener('canplay', tryPlay, { once: true });
  const reader = res.body.getReader();

  ms.addEventListener('sourceopen', () => {
    let sb: SourceBuffer;
    try {
      sb = ms.addSourceBuffer('audio/mpeg');
    } catch {
      return;
    }
    // SourceBuffer 忙的时候 append 会抛错:排队,updateend 后再追加下一块
    const chunks: ArrayBuffer[] = [];
    let finished = false;
    const drain = () => {
      if (sb.updating) return;
      const next = chunks.shift();
      if (next) {
        try { sb.appendBuffer(next); } catch { /* 这块丢了就丢了 */ }
        return;
      }
      if (finished && ms.readyState === 'open') {
        try { ms.endOfStream(); } catch { /* ignore */ }
      }
    };
    sb.addEventListener('updateend', () => {
      if (audio.readyState >= 2) tryPlay();
      drain();
    });
    const pump = async () => {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const buf = new Uint8Array(value.byteLength);
          buf.set(value);
          chunks.push(buf.buffer as ArrayBuffer);
          drain();
        }
      } catch { /* 打断 / 断流 */ }
      finished = true;
      drain();
    };
    void pump();
  }, { once: true });

  audio.addEventListener('ended', () => {
    URL.revokeObjectURL(url);
    if (audioObjectUrls.get(audio) === url) audioObjectUrls.delete(audio);
  }, { once: true });
}

function waitForAudioEnd(audio: HTMLAudioElement, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      audio.removeEventListener('ended', finish);
      audio.removeEventListener('error', finish);
      audio.removeEventListener('playing', arm);
      signal?.removeEventListener('abort', finish);
      clearTimeout(timer);
      resolve();
    };
    // 开播前最多等 8s(首包一直不来就放弃这句);开播后按 60s 兜底,免得 ended 丢了卡死队列
    let timer = setTimeout(finish, 8_000);
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(finish, 60_000);
    };
    audio.addEventListener('playing', arm);
    audio.addEventListener('ended', finish);
    audio.addEventListener('error', finish);
    signal?.addEventListener('abort', finish);
  });
}

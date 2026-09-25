/**
 * 极简 DASH(SegmentBase)播放:把本地解析出来的音视频两路 m4s 通过 MediaSource 喂给 <video>。
 *
 * - 每路先取「初始化段 + sidx 索引」,解析 sidx 得到每个分段的字节范围和时长,支持拖动。
 * - 按当前播放位置往前缓冲 BUFFER_AHEAD 秒,落在后面太远的缓冲删掉,内存不会越吃越多。
 * - 取数据两级:浏览器 fetch(不带 Referer;B 站 mcdn 节点允许且带 CORS *)→ 原生请求(带规则给的
 *   Referer 等头;upos-*.bilivideo.com 必须这样)。哪个地址 + 哪种方式成功,后续分段就先用它。
 */

import { nativeAvailable, nativeFetch } from './native';
import type { DashTrack, LocalStream } from './engine';

const BUFFER_AHEAD = 30;
const KEEP_BEHIND = 30;
/** 一次请求最多合并这么多字节的连续分段 */
const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
/** 刚开始 / 刚拖动后的第一次请求小一点,先出画面 */
const FIRST_REQUEST_BYTES = 512 * 1024;

interface Segment {
  start: number;
  end: number; // 闭区间
  t0: number;
  t1: number;
}

type Mode = 'browser' | 'native';

/**
 * MediaSource 构造器。Safari/WebKit 新版本(macOS 客户端的 WKWebView、iOS)可能只有 ManagedMediaSource;
 * 用它时 <video> 必须关掉远程播放(disableRemotePlayback),否则不给开流。
 */
export function mediaSourceCtor(): { ctor: typeof MediaSource; managed: boolean } | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { MediaSource?: typeof MediaSource; ManagedMediaSource?: typeof MediaSource };
  if (w.MediaSource) return { ctor: w.MediaSource, managed: false };
  if (w.ManagedMediaSource) return { ctor: w.ManagedMediaSource, managed: true };
  return null;
}

class RangeFetcher {
  private order: Array<{ url: string; mode: Mode }>;
  constructor(urls: string[], private headers: Record<string, string>) {
    this.order = [];
    for (const url of urls) {
      this.order.push({ url, mode: 'browser' });
      if (nativeAvailable()) this.order.push({ url, mode: 'native' });
    }
  }

  async get(start: number, end: number, signal: AbortSignal): Promise<ArrayBuffer> {
    let lastErr: unknown = null;
    for (let i = 0; i < this.order.length; i++) {
      const c = this.order[i];
      try {
        const range = `bytes=${start}-${end}`;
        const res =
          c.mode === 'browser'
            ? await fetch(c.url, { headers: { Range: range }, referrerPolicy: 'no-referrer', credentials: 'omit', signal })
            : await nativeFetch(c.url, { headers: { ...this.headers, Range: range }, signal });
        if (res.status !== 206 && res.status !== 200) throw new Error(`HTTP ${res.status}`);
        let buf = await res.arrayBuffer();
        // 没理 Range 返回了整个文件:自己切
        if (res.status === 200 && buf.byteLength > end - start + 1) buf = buf.slice(start, end + 1);
        if (buf.byteLength !== end - start + 1) throw new Error('长度不对');
        // 成功的组合挪到最前,后续分段先用它
        if (i > 0) this.order.unshift(...this.order.splice(i, 1));
        return buf;
      } catch (e) {
        if (signal.aborted) throw e;
        lastErr = e;
      }
    }
    throw lastErr ?? new Error('没有可用的媒体地址');
  }
}

/** 解析 sidx(ISO/IEC 14496-12 8.16.3) */
export function parseSidx(buf: ArrayBuffer, sidxFileOffset: number): Segment[] {
  const dv = new DataView(buf);
  // 在给定范围里找 sidx 盒子
  let p = 0;
  while (p + 8 <= dv.byteLength) {
    const size = dv.getUint32(p);
    const type = String.fromCharCode(dv.getUint8(p + 4), dv.getUint8(p + 5), dv.getUint8(p + 6), dv.getUint8(p + 7));
    if (type === 'sidx') break;
    if (size < 8) throw new Error('sidx 解析失败');
    p += size;
  }
  if (p + 8 > dv.byteLength) throw new Error('找不到 sidx');
  const boxSize = dv.getUint32(p);
  const version = dv.getUint8(p + 8);
  const timescale = dv.getUint32(p + 16);
  let q = p + 20;
  let earliest: number;
  let firstOffset: number;
  if (version === 0) {
    earliest = dv.getUint32(q);
    firstOffset = dv.getUint32(q + 4);
    q += 8;
  } else {
    earliest = Number(dv.getBigUint64(q));
    firstOffset = Number(dv.getBigUint64(q + 8));
    q += 16;
  }
  q += 2; // reserved
  const count = dv.getUint16(q);
  q += 2;
  let offset = sidxFileOffset + p + boxSize + firstOffset;
  let t = earliest / timescale;
  const segs: Segment[] = [];
  for (let i = 0; i < count; i++) {
    const size = dv.getUint32(q) & 0x7fffffff;
    const dur = dv.getUint32(q + 4) / timescale;
    segs.push({ start: offset, end: offset + size - 1, t0: t, t1: t + dur });
    offset += size;
    t += dur;
    q += 12;
  }
  return segs;
}

class TrackLoader {
  sb!: SourceBuffer;
  segs: Segment[] = [];
  next = 0;
  done = false;
  private warm = false;
  private fetcher: RangeFetcher;
  private ctrl = new AbortController();

  constructor(private track: DashTrack, headers: Record<string, string>) {
    this.fetcher = new RangeFetcher(track.urls, headers);
  }

  /** 所有轨道的 SourceBuffer 必须在第一次 appendBuffer 之前建好,否则浏览器不让再加 */
  create(ms: MediaSource) {
    this.sb = ms.addSourceBuffer(`${this.track.mime}; codecs="${this.track.codecs}"`);
  }

  async open(): Promise<void> {
    const [i0, i1] = this.track.init;
    const [x0, x1] = this.track.index;
    const lo = Math.min(i0, x0);
    const hi = Math.max(i1, x1);
    const head = await this.fetcher.get(lo, hi, this.ctrl.signal);
    this.segs = parseSidx(head.slice(x0 - lo, x1 - lo + 1), x0);
    await this.append(head.slice(i0 - lo, i1 - lo + 1));
  }

  append(buf: ArrayBuffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const done = () => {
        this.sb.removeEventListener('updateend', done);
        this.sb.removeEventListener('error', fail);
        resolve();
      };
      const fail = () => {
        this.sb.removeEventListener('updateend', done);
        this.sb.removeEventListener('error', fail);
        reject(new Error('SourceBuffer 追加失败'));
      };
      this.sb.addEventListener('updateend', done);
      this.sb.addEventListener('error', fail);
      this.sb.appendBuffer(buf);
    });
  }

  remove(from: number, to: number): Promise<void> {
    if (to <= from) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => {
        this.sb.removeEventListener('updateend', done);
        resolve();
      };
      this.sb.addEventListener('updateend', done);
      try {
        this.sb.remove(from, to);
      } catch {
        this.sb.removeEventListener('updateend', done);
        resolve();
      }
    });
  }

  bufferedAhead(t: number): number {
    const b = this.sb.buffered;
    for (let i = 0; i < b.length; i++) if (b.start(i) <= t + 0.3 && b.end(i) > t) return b.end(i) - t;
    return 0;
  }

  seek(t: number) {
    this.ctrl.abort();
    this.ctrl = new AbortController();
    const i = this.segs.findIndex((s) => s.t1 > t);
    this.next = i < 0 ? this.segs.length : i;
    this.done = this.next >= this.segs.length;
    this.warm = false;
  }

  /** 取下一批连续分段并追加;没有可取的返回 false */
  async step(): Promise<boolean> {
    if (this.next >= this.segs.length) {
      this.done = true;
      return false;
    }
    const first = this.segs[this.next];
    let last = this.next;
    const limit = this.warm ? MAX_REQUEST_BYTES : FIRST_REQUEST_BYTES;
    while (last + 1 < this.segs.length && this.segs[last + 1].end - first.start + 1 <= limit) last++;
    const signal = this.ctrl.signal;
    const buf = await this.fetcher.get(first.start, this.segs[last].end, signal);
    if (signal.aborted) return true;
    await this.append(buf);
    // 追加期间用户拖动过:seek 已经改了 next,别用旧位置覆盖
    if (!signal.aborted) {
      this.next = last + 1;
      this.warm = true;
    }
    return true;
  }

  abort() {
    this.ctrl.abort();
  }
}

/**
 * HLS(m3u8,AcFun 这类不校验 Referer、带 CORS 的源):hls.js(MediaSource)或系统原生 HLS(Safari / iOS)。
 * 地址按顺序尝试:清单/分片拉不下来就换备用地址,全换完才算失败。
 */
function attachHls(video: HTMLVideoElement, urls: string[], onFatal: (err: Error) => void): () => void {
  let disposed = false;
  let hls: { destroy(): void } | null = null;
  let cleanupNative: (() => void) | null = null;
  const fail = (e: unknown) => {
    if (disposed) return;
    disposed = true;
    onFatal(e instanceof Error ? e : new Error(String(e)));
  };
  video.setAttribute('referrerpolicy', 'no-referrer');
  import('hls.js')
    .then(({ default: Hls }) => {
      if (disposed) return;
      if (Hls.isSupported()) {
        let i = 0;
        const start = () => {
          hls?.destroy();
          const h = new Hls({ enableWorker: true, lowLatencyMode: false });
          hls = h;
          h.on(Hls.Events.ERROR, (_event, data) => {
            if (!data.fatal || disposed) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR && i < urls.length - 1) {
              i += 1;
              start();
              return;
            }
            fail(new Error(`HLS ${data.details}`));
          });
          h.loadSource(urls[i]);
          h.attachMedia(video);
        };
        start();
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        let i = 0;
        const onErr = () => {
          if (++i < urls.length) video.src = urls[i];
          else fail(new Error('所有地址都放不出来'));
        };
        video.addEventListener('error', onErr);
        video.dataset.selfRecover = '1';
        cleanupNative = () => {
          video.removeEventListener('error', onErr);
          delete video.dataset.selfRecover;
        };
        video.src = urls[0];
      } else {
        fail(new Error('这个系统的 WebView 不支持 HLS'));
      }
    })
    .catch(fail);
  return () => {
    disposed = true;
    hls?.destroy();
    cleanupNative?.();
  };
}

/**
 * 把解析出的流(本地或服务端)挂到 <video> 上。返回清理函数。onFatal:这条流彻底放不出来(调用方退回外链播放器)。
 */
export function attachLocalStream(video: HTMLVideoElement, stream: LocalStream, onFatal: (err: Error) => void): () => void {
  let disposed = false;

  if (stream.kind === 'progressive') {
    // 整段 mp4:只有浏览器能直接取的地址才能这样放(<video> 请求没法带自定义头)
    video.setAttribute('referrerpolicy', 'no-referrer');
    let i = 0;
    const tryNext = () => {
      if (disposed) return;
      if (i >= stream.urls.length) {
        onFatal(new Error('所有地址都放不出来'));
        return;
      }
      video.src = stream.urls[i++];
    };
    const onErr = () => tryNext();
    video.addEventListener('error', onErr);
    // 地址出错由这里换备用地址、全换完才 onFatal;播放器自己的 error 处理看到这个标记就不插手
    video.dataset.selfRecover = '1';
    tryNext();
    return () => {
      disposed = true;
      video.removeEventListener('error', onErr);
      delete video.dataset.selfRecover;
    };
  }

  if (stream.kind === 'hls') return attachHls(video, stream.urls, onFatal);

  const MS = mediaSourceCtor();
  if (!MS) {
    onFatal(new Error('这个系统的 WebView 不支持 MediaSource'));
    return () => {};
  }
  if (MS.managed) (video as HTMLVideoElement & { disableRemotePlayback: boolean }).disableRemotePlayback = true;
  const ms = new MS.ctor();
  const objectUrl = URL.createObjectURL(ms);
  const loaders: TrackLoader[] = [new TrackLoader(stream.video, stream.mediaHeaders)];
  if (stream.audio) loaders.push(new TrackLoader(stream.audio, stream.mediaHeaders));
  let pumping = false;
  /** pump 跑着的时候又来了一次 seek:等它结束再按新位置跑一轮,避免两个 pump 同时往一个 SourceBuffer 里追加 */
  let repump = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const fail = (e: unknown) => {
    if (disposed) return;
    disposed = true;
    if (timer) clearInterval(timer);
    loaders.forEach((l) => l.abort());
    onFatal(e instanceof Error ? e : new Error(String(e)));
  };

  const pump = async () => {
    if (disposed || ms.readyState === 'closed') return;
    if (pumping) {
      repump = true;
      return;
    }
    pumping = true;
    try {
      const t = video.currentTime;
      for (const l of loaders) {
        if (disposed) break;
        // 身后太远的缓冲删掉
        if (t - KEEP_BEHIND > 1) await l.remove(0, t - KEEP_BEHIND);
        while (!disposed && !l.done && l.bufferedAhead(video.currentTime) < BUFFER_AHEAD) {
          if (!(await l.step())) break;
        }
      }
      if (!disposed && loaders.every((l) => l.done) && ms.readyState === 'open' && loaders.every((l) => !l.sb.updating)) {
        ms.endOfStream();
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) fail(e);
    } finally {
      pumping = false;
      if (repump && !disposed) {
        repump = false;
        void pump();
      }
    }
  };

  const onSeeking = () => {
    loaders.forEach((l) => l.seek(video.currentTime));
    void pump();
  };

  ms.addEventListener(
    'sourceopen',
    async () => {
      try {
        if (stream.duration > 0) ms.duration = stream.duration;
        loaders.forEach((l) => l.create(ms));
        await Promise.all(loaders.map((l) => l.open()));
        if (disposed) return;
        video.addEventListener('seeking', onSeeking);
        timer = setInterval(() => void pump(), 1000);
        void pump();
      } catch (e) {
        fail(e);
      }
    },
    { once: true },
  );
  video.src = objectUrl;

  return () => {
    disposed = true;
    if (timer) clearInterval(timer);
    loaders.forEach((l) => l.abort());
    video.removeEventListener('seeking', onSeeking);
    URL.revokeObjectURL(objectUrl);
  };
}

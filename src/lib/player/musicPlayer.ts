'use client';

/**
 * 全局音乐播放器。
 *
 * 以前 <audio> 挂在音乐详情页里,离开页面就停。现在整站只有一个 Audio 对象,
 * 模块级单例、不挂进任何页面的 DOM —— 路由怎么切都不会被卸载,直到用户自己关掉。
 * 播放队列 / 音量 / 循环模式存 localStorage,刷新后底栏还在(浏览器不允许无手势
 * 自动出声,所以恢复后是暂停态,点一下从上次的位置接着放)。
 *
 * 同一时刻只出一路声音(installMediaCoordinator):
 *  - 有声视频开播 → 暂停音乐;那条视频停了/没了 → 音乐自动接着放;
 *  - 例外:推荐流这类自动连播的视频(<video data-auto-mute="1">),音乐在放时静音开播,
 *    不打断音乐;用户点开它的声音才算"要看这条",这时再暂停音乐;
 *  - 用户主动放音乐 → 暂停正在出声的视频;
 *  - 多开标签页时,一个页签开始放,其它页签的音乐暂停。
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { resolveMusicById, resolveTrackById } from './resolveMusic';

export interface MusicTrack {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  cover?: string;
  /**
   * 可直接交给 <audio> 的地址(已过 mediaUrl)。
   * 空串 = 还没解析:整张歌单进队列时只有 id 和标题,轮到这首播时才去取(见 load)。
   */
  src: string;
  /** 详情页地址:点封面回去看歌词 */
  href: string;
  /** VIP 歌只有试听片段 */
  preview?: boolean;
}

/** 播放位置单独存(见 savePosition)。要放在 store 之前:persist 在 create() 里就同步恢复并读它 */
const POS_KEY = 'qq-music-pos';

export type RepeatMode = 'all' | 'one' | 'off';

/** 当前队列是从哪来的 —— 底栏显示「正在播放:歌单名」,点了能回去 */
export interface QueueSource {
  kind: 'playlist' | 'search' | 'assistant';
  name: string;
  href?: string;
}

interface MusicState {
  queue: MusicTrack[];
  /** 当前曲目在 queue 里的下标,-1 = 没有 */
  index: number;
  playing: boolean;
  buffering: boolean;
  currentTime: number;
  duration: number;
  /** 0–1 */
  volume: number;
  muted: boolean;
  repeat: RepeatMode;
  shuffle: boolean;
  source: QueueSource | null;
  /** 底栏收成悬浮唱片 */
  collapsed: boolean;
  error: string | null;
}

export const useMusicPlayer = create<MusicState>()(
  persist(
    (): MusicState => ({
      queue: [],
      index: -1,
      playing: false,
      buffering: false,
      currentTime: 0,
      duration: 0,
      volume: 0.8,
      muted: false,
      repeat: 'all',
      shuffle: false,
      source: null,
      collapsed: false,
      error: null,
    }),
    {
      name: 'qq-music-player',
      storage: createJSONStorage(() => localStorage),
      // currentTime 每秒变好几次,不走 persist(见 savePosition)
      partialize: (s) => ({
        queue: s.queue,
        index: s.index,
        duration: s.duration,
        volume: s.volume,
        muted: s.muted,
        repeat: s.repeat,
        shuffle: s.shuffle,
        source: s.source,
        collapsed: s.collapsed,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const pos = readPosition();
        const cur = state.queue[state.index];
        // localStorage 是同步恢复的,此刻还在 create() 里、useMusicPlayer 尚未赋值 —— 推迟一拍
        if (cur && pos?.id === cur.id) queueMicrotask(() => useMusicPlayer.setState({ currentTime: pos.t }));
      },
    },
  ),
);

export function currentTrack(s: MusicState = useMusicPlayer.getState()): MusicTrack | null {
  return s.queue[s.index] ?? null;
}

const set = useMusicPlayer.setState;
const get = useMusicPlayer.getState;

// ---------------------------------------------------------------------------
// 播放位置(单独存,节流)
// ---------------------------------------------------------------------------

function readPosition(): { id: string; t: number } | null {
  try {
    return JSON.parse(localStorage.getItem(POS_KEY) || 'null');
  } catch {
    return null;
  }
}

let lastPosSave = 0;
function savePosition(force = false) {
  const cur = currentTrack();
  if (!cur || !audio) return;
  const now = Date.now();
  if (!force && now - lastPosSave < 5000) return;
  lastPosSave = now;
  try {
    localStorage.setItem(POS_KEY, JSON.stringify({ id: cur.id, t: Math.floor(audio.currentTime) }));
  } catch {
    /* 隐私模式写不进去无所谓 */
  }
}

// ---------------------------------------------------------------------------
// Audio 单例
// ---------------------------------------------------------------------------

let audio: HTMLAudioElement | null = null;
/** 当前 src 对应的曲目 id —— 判断要不要重新 load */
let loadedId: string | null = null;
/** 每首歌只自动换一次链,防止坏地址来回打转 */
let refreshedId: string | null = null;
/** 数字人说话期间压低音量(见 musicPlayer.duck) */
let ducked = false;
/** load 后要跳到的位置(恢复进度 / 换链续播) */
let pendingSeek = 0;

function el(): HTMLAudioElement {
  if (audio) return audio;
  const a = new Audio();
  a.preload = 'metadata';
  const s = get();
  a.volume = s.volume;
  a.muted = s.muted;

  a.addEventListener('play', () => {
    set({ playing: true, error: null });
    announce();
    syncSession();
  });
  a.addEventListener('pause', () => {
    set({ playing: false });
    savePosition(true);
    syncSession();
  });
  a.addEventListener('waiting', () => set({ buffering: true }));
  a.addEventListener('playing', () => {
    failStreak = 0;
    set({ buffering: false });
  });
  a.addEventListener('canplay', () => set({ buffering: false }));
  a.addEventListener('loadedmetadata', () => {
    if (pendingSeek > 0 && pendingSeek < a.duration - 1) a.currentTime = pendingSeek;
    pendingSeek = 0;
    set({ duration: isFinite(a.duration) ? a.duration : 0 });
  });
  a.addEventListener('timeupdate', () => {
    set({ currentTime: a.currentTime });
    savePosition();
    syncPosition();
  });
  a.addEventListener('ended', onEnded);
  a.addEventListener('error', onError);
  audio = a;
  return a;
}

/** 连续多少首取不到音源 —— 整张歌单都放不了时要停下来,不能一直转圈 */
let failStreak = 0;
/** 随机播放:这一轮已经放过的曲目 id */
const shufflePlayed = new Set<string>();

function load(index: number, autoplay: boolean, startAt = 0) {
  const t = get().queue[index];
  if (!t) return;
  const a = el();
  loadedId = t.id;
  pendingSeek = startAt;
  shufflePlayed.add(t.id);
  set({ index, currentTime: startAt, duration: 0, error: null, buffering: autoplay });
  if (!t.src) {
    // 停掉上一首,免得解析期间旧歌还在响
    a.pause();
    a.removeAttribute('src');
    syncSession();
    void resolveAndLoad(t.id, autoplay, startAt);
    return;
  }
  a.src = t.src;
  syncSession();
  if (autoplay) start();
}

/** 队列里只有 id 的歌:取音源、补全信息,再真正加载。期间用户切走了就作废。 */
async function resolveAndLoad(id: string, autoplay: boolean, startAt: number) {
  let info: Awaited<ReturnType<typeof resolveTrackById>> | null = null;
  try {
    info = await resolveTrackById(id);
  } catch {
    info = null;
  }
  if (currentTrack()?.id !== id) return;
  if (!info?.src) {
    refreshedId = id; // 刚取过,onError 不用再取一次
    skipBroken(id, '这首歌暂无可播放音源(版权或平台限制)');
    return;
  }
  const { src, preview, ...meta } = info;
  const queue = get().queue.map((q) =>
    q.id === id
      ? {
          ...q,
          src,
          preview,
          title: q.title || meta.title || '未知歌曲',
          artist: q.artist || meta.artist,
          album: q.album || meta.album,
          cover: q.cover || meta.cover,
        }
      : q,
  );
  set({ queue });
  refreshedId = id;
  load(get().index, autoplay, startAt);
}

/** 这首放不了:报错,队列里还有别的就跳下一首;一连串都放不了就停。 */
function skipBroken(id: string, message: string) {
  set({ playing: false, buffering: false, error: message });
  failStreak += 1;
  const { queue } = get();
  if (queue.length <= 1 || failStreak >= Math.min(queue.length, 5)) {
    failStreak = 0;
    return;
  }
  setTimeout(() => {
    if (currentTrack()?.id !== id || !get().error) return;
    const n = pickNext(true);
    if (n >= 0) load(n, true);
  }, 1200);
}

/**
 * 下一首的下标,-1 = 到头了。wrap 为 true 时(用户手动切歌 / 跳过坏歌)总会绕回去。
 * 随机模式下每首歌一轮只放一次,一轮放完再重新洗。
 */
function pickNext(wrap: boolean): number {
  const { queue, index, shuffle, repeat } = get();
  if (queue.length === 0) return -1;
  if (!shuffle) {
    if (index < queue.length - 1) return index + 1;
    return wrap || repeat === 'all' ? 0 : -1;
  }
  if (queue.length === 1) return wrap || repeat === 'all' ? 0 : -1;
  let pool = queue.map((_, i) => i).filter((i) => i !== index && !shufflePlayed.has(queue[i].id));
  if (pool.length === 0) {
    if (!wrap && repeat !== 'all') return -1;
    shufflePlayed.clear();
    pool = queue.map((_, i) => i).filter((i) => i !== index);
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function start() {
  const a = el();
  interruptedBy = null;
  pauseAudibleVideos();
  a.play().catch((e: DOMException) => {
    // AbortError = 播放途中换了 src,正常;NotAllowedError = 没有用户手势
    if (e?.name !== 'AbortError') set({ playing: false, buffering: false });
  });
}

function onEnded() {
  const { repeat } = get();
  if (repeat === 'one') {
    el().currentTime = 0;
    start();
    return;
  }
  const n = pickNext(false);
  if (n >= 0) load(n, true);
  else set({ playing: false, currentTime: 0 });
}

async function onError() {
  const a = el();
  const t = currentTrack();
  if (!t || !a.src) return;
  // 签名直链过期 / 源站回收:重拉一次详情换新地址,从断点接着放
  if (refreshedId !== t.id) {
    refreshedId = t.id;
    const resumeAt = a.currentTime || get().currentTime;
    const wasPlaying = get().playing || !a.paused;
    try {
      const src = await resolveMusicById(t.id);
      if (src && currentTrack()?.id === t.id) {
        const queue = get().queue.map((q) => (q.id === t.id ? { ...q, src } : q));
        set({ queue });
        load(get().index, wasPlaying, resumeAt);
        return;
      }
    } catch {
      /* 落到下面报错 */
    }
  }
  skipBroken(t.id, '音源加载失败(可能已过期或受版权限制)');
}

// ---------------------------------------------------------------------------
// 对外操作
// ---------------------------------------------------------------------------

export const musicPlayer = {
  /** 立刻播放这首:已在队列里就跳过去,否则插到当前曲目后面 */
  play(track: MusicTrack) {
    const { queue, index } = get();
    const at = queue.findIndex((q) => q.id === track.id);
    if (at >= 0) {
      const queue2 = queue.slice();
      queue2[at] = { ...queue[at], ...track };
      set({ queue: queue2 });
      if (at === index && loadedId === track.id && audio?.src) {
        start();
        return;
      }
      load(at, true);
      return;
    }
    const insertAt = index < 0 ? 0 : index + 1;
    const queue2 = [...queue.slice(0, insertAt), track, ...queue.slice(insertAt)];
    set({ queue: queue2 });
    load(insertAt, true);
  },

  /** 加到队尾;队列原本为空时只放进去不自动开播 */
  enqueue(track: MusicTrack): boolean {
    return musicPlayer.enqueueMany([track]) > 0;
  },

  /** 批量加到队尾(已在队列里的跳过),返回实际加入的数量。曲目可以没有 src,轮到时再解析。 */
  enqueueMany(tracks: MusicTrack[]): number {
    const { queue, index } = get();
    const have = new Set(queue.map((q) => q.id));
    const fresh = tracks.filter((t) => t.id && !have.has(t.id) && have.add(t.id));
    if (fresh.length === 0) return 0;
    set({ queue: [...queue, ...fresh], index: index < 0 ? 0 : index });
    return fresh.length;
  },

  /**
   * 整个队列换成这些歌并开播 ——「播放全部」/ 播放歌单。曲目可以没有 src,轮到时再解析,
   * 所以一张 200 首的歌单也是点了就响,不用先把 200 个音源都取一遍。
   */
  setQueue(tracks: MusicTrack[], opts: { startIndex?: number; shuffle?: boolean; source?: QueueSource | null } = {}) {
    const seen = new Set<string>();
    const queue = tracks.filter((t) => t.id && !seen.has(t.id) && seen.add(t.id));
    if (queue.length === 0) return;
    const shuffle = opts.shuffle ?? get().shuffle;
    let at = Math.max(0, Math.min(queue.length - 1, opts.startIndex ?? 0));
    if (shuffle && opts.startIndex === undefined) at = Math.floor(Math.random() * queue.length);
    shufflePlayed.clear();
    failStreak = 0;
    loadedId = null;
    set({ queue, shuffle, source: opts.source ?? null });
    load(at, true);
  },

  toggleShuffle() {
    shufflePlayed.clear();
    const cur = currentTrack();
    if (cur) shufflePlayed.add(cur.id);
    set({ shuffle: !get().shuffle });
  },

  /** 队列里拖动排序 */
  move(from: number, to: number) {
    const { queue, index } = get();
    if (!queue[from] || !queue[to] || from === to) return;
    const curId = queue[index]?.id;
    const queue2 = queue.slice();
    const [item] = queue2.splice(from, 1);
    queue2.splice(to, 0, item);
    set({ queue: queue2, index: curId ? queue2.findIndex((q) => q.id === curId) : index });
  },

  toggle() {
    const a = el();
    const t = currentTrack();
    if (!t) return;
    if (loadedId !== t.id || !a.src) {
      load(get().index, true, get().currentTime);
      return;
    }
    if (a.paused) start();
    else a.pause();
  },

  pause() {
    audio?.pause();
  },

  next() {
    const n = pickNext(true);
    if (n >= 0) load(n, true);
  },

  /** 放了 3 秒以上先回到开头,否则上一首 */
  prev() {
    const { index, queue } = get();
    if (queue.length === 0) return;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    load((index - 1 + queue.length) % queue.length, true);
  },

  playAt(i: number) {
    if (get().queue[i]) load(i, true);
  },

  remove(i: number) {
    const { queue, index } = get();
    if (!queue[i]) return;
    if (queue.length === 1) {
      musicPlayer.close();
      return;
    }
    const queue2 = queue.filter((_, k) => k !== i);
    if (i === index) {
      const wasPlaying = get().playing;
      set({ queue: queue2 });
      load(Math.min(i, queue2.length - 1), wasPlaying);
    } else {
      set({ queue: queue2, index: i < index ? index - 1 : index });
    }
  },

  seek(t: number) {
    const cur = currentTrack();
    if (!cur) return;
    if (audio && loadedId === cur.id && audio.src) audio.currentTime = t;
    else pendingSeek = t;
    set({ currentTime: t });
  },

  setVolume(v: number) {
    const volume = Math.max(0, Math.min(1, v));
    set({ volume, muted: volume === 0 });
    if (audio) {
      audio.volume = volume * (ducked ? 0.25 : 1);
      audio.muted = volume === 0;
    }
  },

  toggleMute() {
    const muted = !get().muted;
    set({ muted });
    if (audio) audio.muted = muted;
  },

  cycleRepeat() {
    const order: RepeatMode[] = ['all', 'one', 'off'];
    set({ repeat: order[(order.indexOf(get().repeat) + 1) % order.length] });
  },

  setCollapsed(collapsed: boolean) {
    set({ collapsed });
  },

  /** 停止并清空 —— 底栏消失 */
  close() {
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    loadedId = null;
    interruptedBy = null;
    shufflePlayed.clear();
    set({ queue: [], index: -1, playing: false, currentTime: 0, duration: 0, error: null, buffering: false, source: null });
    try {
      localStorage.removeItem(POS_KEY);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';
      }
    } catch {
      /* ignore */
    }
  },

  /**
   * 临时压低音量(数字人说话时),不动用户设的 volume。on=false 恢复。
   */
  duck(on: boolean) {
    ducked = on;
    if (audio) audio.volume = get().volume * (on ? 0.25 : 1);
  },

  /** 音乐当前是不是由这个 audio 元素在出声(协调器用) */
  isOwnElement(node: EventTarget | null) {
    return !!audio && node === audio;
  },
};

// ---------------------------------------------------------------------------
// 系统媒体控制(锁屏 / 耳机线控 / 键盘媒体键)
// ---------------------------------------------------------------------------

function absolute(url: string) {
  try {
    return new URL(url, location.href).href;
  } catch {
    return url;
  }
}

function syncSession() {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  const t = currentTrack();
  const ms = navigator.mediaSession;
  if (!t || !audio) return;
  // 视频在出声时媒体会话归视频(videoDock 设置),音乐暂停着就别抢;
  // 媒体会话已被清空(视频销毁)时音乐可以接回来
  if (audio.paused && ms.metadata && ms.metadata.title !== t.title) return;
  try {
    ms.metadata = new MediaMetadata({
      title: t.title,
      artist: t.artist || '',
      album: t.album || '清秋月',
      artwork: t.cover ? [{ src: absolute(t.cover), sizes: '512x512' }] : [],
    });
    ms.playbackState = audio.paused ? 'paused' : 'playing';
    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler | null]> = [
      ['play', () => musicPlayer.toggle()],
      ['pause', () => musicPlayer.pause()],
      ['previoustrack', () => musicPlayer.prev()],
      ['nexttrack', () => musicPlayer.next()],
      ['seekto', (d) => d.seekTime != null && musicPlayer.seek(d.seekTime)],
      ['seekbackward', (d) => musicPlayer.seek(Math.max(0, el().currentTime - (d.seekOffset || 10)))],
      ['seekforward', (d) => musicPlayer.seek(el().currentTime + (d.seekOffset || 10))],
      ['stop', () => musicPlayer.close()],
      ['enterpictureinpicture' as MediaSessionAction, null],
    ];
    for (const [action, handler] of handlers) {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        /* 老浏览器不认识的 action */
      }
    }
  } catch {
    /* ignore */
  }
}

let lastPositionSync = 0;
function syncPosition() {
  if (!audio || !('mediaSession' in navigator) || audio.paused) return;
  const now = Date.now();
  if (now - lastPositionSync < 1000 || !isFinite(audio.duration)) return;
  lastPositionSync = now;
  try {
    navigator.mediaSession.setPositionState({
      duration: audio.duration,
      position: Math.min(audio.currentTime, audio.duration),
      playbackRate: audio.playbackRate,
    });
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// 同一时刻只出一路声音
// ---------------------------------------------------------------------------

/** 因为这条视频开播而暂停了音乐 —— 它停了就把音乐接回来 */
let interruptedBy: HTMLMediaElement | null = null;
let resumeTimer: ReturnType<typeof setTimeout> | undefined;

function audible(m: HTMLMediaElement) {
  return !m.muted && m.volume > 0;
}

function pauseAudibleVideos(except?: Element) {
  document.querySelectorAll('video').forEach((v) => {
    if (v !== except && !v.paused && audible(v)) v.pause();
  });
}

function onVideoStopped(v: HTMLMediaElement) {
  if (interruptedBy !== v) return;
  clearTimeout(resumeTimer);
  // 刷推荐流时上一条停、下一条马上开播 —— 稍等一下,别让音乐闪一下又停
  resumeTimer = setTimeout(() => {
    if (interruptedBy !== v) return;
    const stillAudible = Array.from(document.querySelectorAll('video')).some((x) => !x.paused && audible(x));
    if (stillAudible) return;
    interruptedBy = null;
    if (audio?.paused && currentTrack()) audio.play().catch(() => {});
  }, 1200);
}

function onAudibleVideo(v: HTMLVideoElement, userUnmuted = false) {
  // 刷推荐流时边听歌边看:自动连播的视频静音开播,音乐不停
  if (!userUnmuted && v.dataset.autoMute === '1' && audio && !audio.paused) {
    v.muted = true;
    return;
  }
  pauseAudibleVideos(v);
  // 同标签页里的其它页面实例(数字人场景屏幕里的 iframe / 它外层的页面)也要让出声音
  channel?.postMessage({ type: 'playing', tab: TAB_ID, group: GROUP_ID, kind: 'video' });
  if (!audio || audio.paused) {
    // 音乐已经被上一条视频暂停:改由这一条负责"停了再接回来"
    if (interruptedBy && interruptedBy !== v) watchVideo(v);
    return;
  }
  audio.pause();
  watchVideo(v);
}

function watchVideo(v: HTMLVideoElement) {
  interruptedBy = v;
  clearTimeout(resumeTimer);
  const stop = () => onVideoStopped(v);
  // 视频元素被卸载时浏览器也会补一个 pause 事件,但它已不在 document 里,
  // 冒泡/捕获到不了这里 —— 所以直接挂在元素上
  v.addEventListener('pause', stop, { once: true });
  v.addEventListener('ended', stop, { once: true });
  v.addEventListener('emptied', stop, { once: true });
}

const channel: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('qq-music') : null;
const TAB_ID = Math.random().toString(36).slice(2);
/**
 * 同一个浏览器标签页里的所有页面实例(外层页面 + 数字人场景屏幕里的同源 iframe)共用一个组号:
 * sessionStorage 在同标签页的同源 frame 之间是共享的,跨标签页不共享。
 * 组内按「同一时刻只出一路声音」处理(视频也互相让);跨标签页维持原来只让音乐的行为。
 */
const GROUP_ID = (() => {
  try {
    const k = 'qq-media-group';
    let g = sessionStorage.getItem(k);
    if (!g) {
      g = Math.random().toString(36).slice(2);
      sessionStorage.setItem(k, g);
    }
    return g;
  } catch {
    return '';
  }
})();

function announce() {
  channel?.postMessage({ type: 'playing', tab: TAB_ID, group: GROUP_ID });
}

let coordinatorInstalled = false;

export function installMediaCoordinator() {
  if (coordinatorInstalled || typeof document === 'undefined') return;
  coordinatorInstalled = true;

  document.addEventListener(
    'play',
    (e) => {
      const t = e.target;
      if (t instanceof HTMLVideoElement && audible(t)) onAudibleVideo(t);
    },
    true,
  );
  // 静音自动播放的视频被用户点开声音
  document.addEventListener(
    'volumechange',
    (e) => {
      const t = e.target;
      if (t instanceof HTMLVideoElement && !t.paused && audible(t)) onAudibleVideo(t, true);
    },
    true,
  );

  channel?.addEventListener('message', (e) => {
    if (e.data?.type !== 'playing' || e.data.tab === TAB_ID) return;
    const sameTab = !!GROUP_ID && e.data.group === GROUP_ID;
    // 别的标签页里放视频不关这边的事(原有行为);放音乐、或同标签页里任何一路出声,这边的音乐让开
    if (e.data.kind === 'video' && !sameTab) return;
    interruptedBy = null;
    audio?.pause();
    if (sameTab) pauseAudibleVideos();
  });

  window.addEventListener('pagehide', () => savePosition(true));
}

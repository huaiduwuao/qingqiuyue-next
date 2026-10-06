'use client';

import { mediaUrl } from '@/lib/media';
import { getRenderedPath, holdNavTransition, norm } from '@/lib/navTransition';
import { storedReaderTheme, type ReaderTheme } from './prefs';

/**
 * 开书 / 合书动画:书架点一本小说 → 封面从卡片位置飞到屏幕中间、沿左边书脊翻开、纸页铺满全屏,
 * 阅读页在纸页下面渲染好后淡出;从阅读器回到书架反着来 —— 纸页缩回一本书、合上封面、落回书架上那张卡片。
 *
 * 覆盖层是直接挂在 body 上的 DOM,不归 React 管:开书要跨过一次换页(书架卸载、阅读页挂载),
 * 合书是在阅读页卸载时才开始的,组件里的覆盖层活不过这两次卸载。
 * 覆盖层 pointer-events: none、position: fixed,不占布局;出任何错都直接拆掉,导航照常走。
 * 系统开了「减少动态效果」/ 浏览器没有 Web Animations 时什么都不做,调用方走原来的转场。
 */

type Rect = { left: number; top: number; width: number; height: number };

interface FlipBook {
  cover?: string | null;
  title?: string;
  theme: ReaderTheme;
}

interface Parts {
  root: HTMLDivElement;
  backdrop: HTMLDivElement;
  book: HTMLDivElement;
  cover: HTMLDivElement;
  lines: HTMLDivElement;
}

interface Run {
  parts: Parts;
  kind: 'open' | 'close';
  dead: boolean;
  timer: ReturnType<typeof setTimeout>;
  /** 开书:盖住屏幕后才换页;合书:一挂上就换。只调一次 */
  covered: () => void;
}

/** 整段动画最长这么久,超时强拆(页面切到后台时动画时间线会停) */
const SAFETY_MS = 5000;
/** 开书后等阅读页渲染出来最多这么久,等不到也淡出 */
const READY_WAIT_MS = 1500;

let active: Run | null = null;

function canFlip(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !document.body) return false;
  if (typeof Element === 'undefined' || typeof Element.prototype.animate !== 'function') return false;
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function viewportRect(): Rect {
  return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
}

/** 屏幕中间那本书:3:4,手机上约半屏宽,桌面最大 240px */
function centerRect(): Rect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.max(120, Math.min(240, vw * 0.46, vh * 0.36));
  const h = (w * 4) / 3;
  return { left: (vw - w) / 2, top: (vh - h) / 2, width: w, height: h };
}

function shrink(r: Rect, k: number): Rect {
  return { left: r.left + (r.width * (1 - k)) / 2, top: r.top + (r.height * (1 - k)) / 2, width: r.width * k, height: r.height * k };
}

/** 起止位置得在屏幕里、有个样子,才往那儿飞;否则就在屏幕中间淡入淡出 */
function usableRect(r: Rect | DOMRect | null | undefined): Rect | null {
  if (typeof window === 'undefined' || !r || r.width < 8 || r.height < 8) return null;
  if (r.top + r.height < 0 || r.top > window.innerHeight || r.left + r.width < 0 || r.left > window.innerWidth) return null;
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/** 摆在 base 的书变到 r 的位置和大小(transform-origin 是左上角) */
function place(r: Rect, base: Rect): string {
  return `translate(${r.left - base.left}px, ${r.top - base.top}px) scale(${r.width / base.width}, ${r.height / base.height})`;
}

function div(style: Partial<CSSStyleDeclaration>): HTMLDivElement {
  const el = document.createElement('div');
  Object.assign(el.style, style);
  return el;
}

function hideBackface(el: HTMLElement) {
  el.style.backfaceVisibility = 'hidden';
  el.style.setProperty('-webkit-backface-visibility', 'hidden');
}

function build(book: FlipBook, base: Rect): Parts {
  const t = book.theme;
  const root = div({
    position: 'fixed',
    inset: '0',
    zIndex: '2147483000',
    pointerEvents: 'none',
    overflow: 'hidden',
    perspective: '1800px',
  });
  root.setAttribute('aria-hidden', 'true');
  root.dataset.bookFlip = '';

  // 底色用阅读页两侧的页面色:开书结束淡出时正好接上阅读页,合书开始时正好盖住阅读页
  const backdrop = div({ position: 'absolute', inset: '0', background: t.page });

  const bookEl = div({
    position: 'absolute',
    left: `${base.left}px`,
    top: `${base.top}px`,
    width: `${base.width}px`,
    height: `${base.height}px`,
    transformOrigin: '0 0',
    transformStyle: 'preserve-3d',
    willChange: 'transform',
  });

  // 书页:纸色 + 靠书脊一侧的阴影 + 几行淡淡的「字」
  const pages = div({
    position: 'absolute',
    inset: '0',
    borderRadius: '2px 6px 6px 2px',
    background: `linear-gradient(90deg, rgba(0,0,0,${t.dark ? 0.35 : 0.14}), transparent 10%), ${t.paper}`,
    boxShadow: '0 14px 36px rgba(0,0,0,.28)',
  });
  const lines = div({
    position: 'absolute',
    left: '16%',
    right: '12%',
    top: '14%',
    bottom: '14%',
    backgroundImage: `repeating-linear-gradient(180deg, ${t.sub} 0 1.5px, transparent 1.5px 9%)`,
    opacity: '0.3',
  });
  pages.appendChild(lines);

  // 封面:绕左边(书脊)转,正面是封面图,背面是衬页
  const cover = div({
    position: 'absolute',
    inset: '0',
    transformOrigin: '0 50%',
    transformStyle: 'preserve-3d',
    willChange: 'transform',
  });
  const front = div({
    position: 'absolute',
    inset: '0',
    borderRadius: '2px 6px 6px 2px',
    overflow: 'hidden',
    background: 'linear-gradient(135deg, #8a5a44, #4a2f25)',
    boxShadow: '0 14px 36px rgba(0,0,0,.28)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });
  hideBackface(front);
  const src = mediaUrl(book.cover);
  if (src) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    img.referrerPolicy = 'no-referrer';
    img.decoding = 'sync';
    Object.assign(img.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'cover', display: 'block' });
    // 裂图就露出底下的皮面色 + 书名
    img.onerror = () => {
      img.style.display = 'none';
    };
    front.appendChild(img);
  }
  if (book.title) {
    const title = div({
      padding: '0 12%',
      color: '#f3e6d3',
      fontSize: '16px',
      fontWeight: '600',
      lineHeight: '1.4',
      textAlign: 'center',
      wordBreak: 'break-word',
    });
    title.textContent = book.title;
    front.insertBefore(title, front.firstChild);
  }
  // 书脊的压痕
  front.appendChild(
    div({
      position: 'absolute',
      inset: '0',
      background: 'linear-gradient(90deg, rgba(0,0,0,.3), rgba(255,255,255,.14) 3%, rgba(0,0,0,.08) 6%, transparent 12%)',
    }),
  );
  const back = div({
    position: 'absolute',
    inset: '0',
    borderRadius: '6px 2px 2px 6px',
    transform: 'rotateY(180deg)',
    background: `linear-gradient(270deg, rgba(0,0,0,${t.dark ? 0.3 : 0.12}), transparent 30%), ${t.paper}`,
  });
  hideBackface(back);
  cover.append(front, back);

  bookEl.append(pages, cover);
  root.append(backdrop, bookEl);
  return { root, backdrop, book: bookEl, cover, lines };
}

function end(run: Run) {
  if (run.dead) return;
  run.dead = true;
  clearTimeout(run.timer);
  run.parts.root.remove();
  if (active === run) active = null;
  run.covered();
}

function mount(parts: Parts, kind: Run['kind'], onCovered?: () => void): Run {
  // 同一时间只留一个:上一个还没演完就直接拆(它没换的页这时换掉)
  if (active) end(active);
  let called = false;
  const run: Run = {
    parts,
    kind,
    dead: false,
    timer: setTimeout(() => end(run), SAFETY_MS),
    covered: () => {
      if (called) return;
      called = true;
      try {
        onCovered?.();
      } catch (e) {
        console.error('[bookFlip] onCovered failed', e);
      }
    },
  };
  active = run;
  document.body.appendChild(parts.root);
  return run;
}

/** 等这一组动画放完;页面在后台时动画时间线不走,最多多等一点就往下 */
async function step(run: Run, anims: Animation[], ms: number): Promise<void> {
  if (run.dead) throw new Error('book flip ended');
  await Promise.race([Promise.all(anims.map((a) => a.finished)), sleep(ms + 150)]);
  if (run.dead) throw new Error('book flip ended');
}

const FILL: KeyframeAnimationOptions = { fill: 'both' };
const EASE_OUT = 'cubic-bezier(.2,.8,.2,1)';
const EASE_IN_OUT = 'cubic-bezier(.45,.05,.3,1)';

async function runOpen(run: Run, base: Rect, from: Rect | null, ready?: () => boolean) {
  const { backdrop, book, cover, lines, root } = run.parts;

  // 1. 封面从卡片位置飞到屏幕中间,背景同时盖上来
  const start = from ?? shrink(base, 0.7);
  const P1 = 320;
  await step(run, [
    backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { ...FILL, duration: P1, easing: 'ease-out' }),
    book.animate(
      [
        { transform: place(start, base) },
        { transform: 'none' },
      ],
      { ...FILL, duration: P1, easing: EASE_OUT },
    ),
  ], P1);

  // 屏幕已经盖住了:这时换页,阅读页在下面渲染
  run.covered();

  // 2. 封面沿书脊翻开,随后书页放大铺满屏幕
  const P2 = 700;
  await step(run, [
    cover.animate(
      [
        { transform: 'rotateY(0deg)', easing: EASE_IN_OUT },
        { transform: 'rotateY(-180deg)', offset: 0.65 },
        { transform: 'rotateY(-180deg)' },
      ],
      { ...FILL, duration: P2 },
    ),
    book.animate(
      [
        { transform: 'none', offset: 0 },
        { transform: 'none', offset: 0.42, easing: 'cubic-bezier(.5,0,.2,1)' },
        { transform: place(viewportRect(), base) },
      ],
      { ...FILL, duration: P2 },
    ),
    lines.animate([{ opacity: 0.3 }, { opacity: 0.3, offset: 0.45 }, { opacity: 0, offset: 0.8 }, { opacity: 0 }], { ...FILL, duration: P2 }),
  ], P2);

  // 3. 等阅读页画出来,再把纸页淡掉
  if (ready) {
    const t0 = Date.now();
    while (!run.dead && !ready() && Date.now() - t0 < READY_WAIT_MS) await sleep(50);
  }
  await step(run, [root.animate([{ opacity: 1 }, { opacity: 0 }], { ...FILL, duration: 240, easing: 'ease-out' })], 240);
}

async function runClose(run: Run, base: Rect, target?: () => Rect | DOMRect | null) {
  const { backdrop, book, cover, lines } = run.parts;

  // 1. 铺满屏幕的纸页缩回一本书,翻开在左边的封面合上
  const P1 = 720;
  await step(run, [
    book.animate(
      [
        { transform: place(viewportRect(), base), easing: 'cubic-bezier(.4,0,.2,1)' },
        { transform: 'none', offset: 0.5 },
        { transform: 'none' },
      ],
      { ...FILL, duration: P1 },
    ),
    cover.animate(
      [
        { transform: 'rotateY(-180deg)', offset: 0, easing: EASE_IN_OUT },
        { transform: 'rotateY(-180deg)', offset: 0.3, easing: EASE_IN_OUT },
        { transform: 'rotateY(0deg)' },
      ],
      { ...FILL, duration: P1 },
    ),
    lines.animate([{ opacity: 0 }, { opacity: 0.3, offset: 0.5 }, { opacity: 0.3 }], { ...FILL, duration: P1 }),
  ], P1);

  // 2. 合好的书落回书架上那张卡片(找不到就原地缩小淡出),背景同时褪掉
  let to: Rect | null = null;
  try {
    to = usableRect(target?.() ?? null);
  } catch {
    to = null;
  }
  const P2 = 380;
  await step(run, [
    backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { ...FILL, duration: P2, easing: 'ease-in' }),
    book.animate(
      [
        { transform: 'none', opacity: 1 },
        { transform: place(to ?? shrink(base, 0.6), base), opacity: to ? 1 : 0 },
      ],
      { ...FILL, duration: P2, easing: 'cubic-bezier(.3,0,.2,1)' },
    ),
  ], P2);
  if (to) await step(run, [book.animate([{ opacity: 1 }, { opacity: 0 }], { ...FILL, duration: 120 })], 120);
}

/**
 * 开书。from = 被点的封面在屏幕上的位置(没有就在屏幕中间淡入);onCovered 在屏幕被盖住时调用
 * (换页 / 切到阅读态放这里);ready 返回 true 后才淡出覆盖层。
 * 返回 false = 没有动画(减少动态效果 / 不支持),调用方自己走原来的路径,onCovered 不会被调用。
 */
export function playBookOpen(opts: FlipBook & { from?: Rect | DOMRect | null; onCovered?: () => void; ready?: () => boolean }): boolean {
  if (!canFlip()) return false;
  let parts: Parts;
  const base = centerRect();
  try {
    parts = build(opts, base);
  } catch (e) {
    console.error('[bookFlip] open failed', e);
    return false;
  }
  const run = mount(parts, 'open', opts.onCovered);
  void runOpen(run, base, usableRect(opts.from), opts.ready)
    .catch(() => {})
    .finally(() => end(run));
  return true;
}

/**
 * 合书。覆盖层一挂上就盖住了屏幕,onCovered 同步调用(切回详情态之类);
 * target 在书合上之后才取,那时下面的页面已经渲染好了。返回值同 playBookOpen。
 */
export function playBookClose(opts: FlipBook & { target?: () => Rect | DOMRect | null; onCovered?: () => void }): boolean {
  if (!canFlip()) return false;
  let parts: Parts;
  const base = centerRect();
  try {
    parts = build(opts, base);
    // 首帧就是「铺满屏幕的纸页、封面翻在左边看不见」,不等动画启动
    parts.book.style.transform = place(viewportRect(), base);
    parts.cover.style.transform = 'rotateY(-180deg)';
    parts.lines.style.opacity = '0';
  } catch (e) {
    console.error('[bookFlip] close failed', e);
    return false;
  }
  const run = mount(parts, 'close', opts.onCovered);
  run.covered();
  void runClose(run, base, opts.target)
    .catch(() => {})
    .finally(() => end(run));
  return true;
}

// ---------------------------------------------------------------------------
// 书架 ⇄ 阅读页:开书时在 sessionStorage 记一笔「从哪个书架、哪本书」,阅读页认领后,
// 卸载时(返回按钮 router.back、安卓返回键、手势,都是 popstate)地址已经是去处 ——
// 回到的正是当初那个书架,就接着演合书。
// ---------------------------------------------------------------------------

const FLAG_KEY = 'qq-book-flip';
/** 开书后阅读页这么久内挂载才算「从书架打开的」(刷新、隔天从历史进来都不算) */
const CLAIM_MS = 15_000;

interface ShelfFlag {
  id: string;
  cover?: string;
  title?: string;
  /** 书架所在页的路径 + mainTab */
  path: string;
  tab: string | null;
  at: number;
}

function readFlag(): ShelfFlag | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(FLAG_KEY) || 'null');
    return v && typeof v === 'object' && typeof v.id === 'string' && typeof v.path === 'string' ? (v as ShelfFlag) : null;
  } catch {
    return null;
  }
}

function writeFlag(flag: ShelfFlag | null) {
  try {
    if (flag) sessionStorage.setItem(FLAG_KEY, JSON.stringify(flag));
    else sessionStorage.removeItem(FLAG_KEY);
  } catch {
    /* 隐私模式写不进去:只是回书架时没有合书动画 */
  }
}

const mainTabOf = (search: string) => new URLSearchParams(search).get('mainTab');

/** 书架卡片的封面(WorkGridView 给封面挂了 data-book-cover) */
export function bookCoverRect(id: string | number): DOMRect | null {
  try {
    const el = document.querySelector(`[data-book-cover="${CSS.escape(String(id))}"]`);
    return el ? el.getBoundingClientRect() : null;
  } catch {
    return null;
  }
}

/**
 * 书架上点开一本小说:演开书,屏幕盖住时调 navigate 换页(这次换页不做 View Transition)。
 * 返回 false = 不演,调用方直接 navigate。
 */
export function openBookFromShelf(book: { id: string | number; cover?: string | null; title?: string }, navigate: () => void): boolean {
  if (!canFlip()) return false;
  // 开书还没演完又点了一下:吞掉,不然会连跳两次
  if (active?.kind === 'open') return true;
  const id = String(book.id);
  const from = getRenderedPath();
  const release = holdNavTransition(['forward'], 2000);
  const ok = playBookOpen({
    cover: book.cover,
    title: book.title,
    theme: storedReaderTheme(),
    from: bookCoverRect(id),
    onCovered: () => {
      try {
        navigate();
      } finally {
        release();
      }
    },
    ready: () => getRenderedPath() !== from,
  });
  if (!ok) {
    release();
    return false;
  }
  writeFlag({ id, cover: book.cover ?? undefined, title: book.title, path: norm(location.pathname), tab: mainTabOf(location.search), at: Date.now() });
  return true;
}

/**
 * 阅读页挂载时调用(useLayoutEffect,返回值当清理函数):刚从书架开书进来的,就认领 ——
 * 返回书架那次 popstate 不做 View Transition,卸载时若回到的是那个书架就演合书。
 * 必须是 layout effect:它的清理在新页面的 layout effect 之前跑,覆盖层赶在书架第一帧之前挂上。
 */
export function bindShelfReading(id: string | null): (() => void) | undefined {
  if (!id || typeof window === 'undefined') return undefined;
  const flag = readFlag();
  if (!flag || flag.id !== id || Date.now() - flag.at > CLAIM_MS) return undefined;
  const release = holdNavTransition(['back']);
  return () => {
    release();
    // 开发态 StrictMode 的假卸载 / 往前跳到别的页:地址不是那个书架,什么都不做
    if (norm(location.pathname) !== flag.path || mainTabOf(location.search) !== flag.tab) return;
    writeFlag(null);
    playBookClose({ cover: flag.cover, title: flag.title, theme: storedReaderTheme(), target: () => bookCoverRect(id) });
  };
}

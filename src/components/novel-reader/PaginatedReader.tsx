'use client';

import React, { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { ContentItem } from '@/hooks/useContentItems';
import type { ReaderPage } from '@/hooks/usePaginatedReader';
import { noiseLayer, type ReaderTheme } from './prefs';
import { LINE_HEIGHT, PAGE_PADDING, TITLE_STYLE, paraStyle, type PageSegment } from './pagination';

/** cover = 左右覆盖(上层页平移滑走,下层页不动);curl = 仿真(沿折线卷起,背面透字) */
export type TurnMode = 'cover' | 'curl';

type Dir = 'next' | 'prev';
type Corner = 'top' | 'bottom' | 'middle';

/**
 * 一次翻页的进度。s:0 = 刚开始,1 = 翻完(此时才真正切页)。
 * 翻页的那张纸:next 是当前页(被翻走),prev 是上一页(被翻回来)。
 */
interface Turn {
  dir: Dir;
  s: number;
  corner: Corner;
  /** 手指的纵向位移,仿真模式用来让折角跟手 */
  dy: number;
}

const DURATION: Record<TurnMode, number> = { cover: 280, curl: 460 };
/** 松手时手指横向走过页宽的这个比例就翻,否则弹回 */
const COMMIT_RATIO = 0.18;
/** 快速甩动(px/ms)即使距离不够也翻 */
const FLICK_SPEED = 0.35;

interface PaginatedReaderProps {
  chapters: ContentItem[];
  current: ReaderPage;
  prev: ReaderPage | null;
  next: ReaderPage | null;
  pageCount: number;
  pageWidth: number;
  pageHeight: number;
  bookTitle?: string;
  author?: string;
  theme: ReaderTheme;
  fontFamily: string;
  fontSize: number;
  onGoNext: () => void;
  onGoPrev: () => void;
  mode: TurnMode;
}

interface PageBodyProps {
  segments: PageSegment[];
  ready: boolean;
  showTitle: boolean;
  chapterTitle: string;
  bookTitle?: string;
  author?: string;
  theme: ReaderTheme;
  fontFamily: string;
  fontSize: number;
  width: number;
  height: number;
}

/** 单页内容。样式和 pagination.ts 的测量共用常量,改一边另一边跟着变。 */
const PageBody = memo(function PageBody({
  segments, ready, showTitle, chapterTitle, bookTitle, author, theme, fontFamily, fontSize, width, height,
}: PageBodyProps) {
  return (
    <div
      style={{
        width, height, boxSizing: 'border-box', overflow: 'hidden',
        padding: `${PAGE_PADDING.top}px ${PAGE_PADDING.x}px ${PAGE_PADDING.bottom}px`,
        color: theme.text, backgroundColor: theme.paper, backgroundImage: noiseLayer(theme.dark),
        fontFamily, fontSize, lineHeight: LINE_HEIGHT,
      }}
    >
      {!ready ? (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.sub, fontSize: 13 }}>
          正在加载…
        </div>
      ) : (
        <>
          {showTitle && (
            <div style={{ ...TITLE_STYLE.wrap, borderBottomColor: theme.line }}>
              <h1 style={{ ...TITLE_STYLE.title, color: theme.text }}>{chapterTitle}</h1>
              {(bookTitle || author) && (
                <div style={{ ...TITLE_STYLE.meta, color: theme.sub }}>
                  {bookTitle && <span>{bookTitle}</span>}
                  {author && <span>{author}</span>}
                </div>
              )}
            </div>
          )}
          {segments.length === 0 ? (
            <div style={{ textAlign: 'center', color: theme.sub, padding: '32px 0' }}>本章无正文</div>
          ) : (
            <main style={{ display: 'flow-root' }}>
              {segments.map((s, i) => (
                <p key={i} style={paraStyle(i === 0, s.continuation)}>{s.text}</p>
              ))}
            </main>
          )}
        </>
      )}
    </div>
  );
});

// ── 仿真翻页几何 ─────────────────────────────────────────────────────
type Pt = { x: number; y: number };

/** Sutherland–Hodgman:多边形只保留 f(p) >= 0 的一侧 */
function clipHalfPlane(poly: Pt[], f: (p: Pt) => number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const prev = poly[(i + poly.length - 1) % poly.length];
    const fc = f(cur);
    const fp = f(prev);
    const cross = () => {
      const t = fp / (fp - fc);
      return { x: prev.x + (cur.x - prev.x) * t, y: prev.y + (cur.y - prev.y) * t };
    };
    if (fc >= 0) {
      if (fp < 0) out.push(cross());
      out.push(cur);
    } else if (fp >= 0) {
      out.push(cross());
    }
  }
  return out;
}

const polygon = (pts: Pt[]) =>
  pts.length < 3 ? 'polygon(0 0, 0 0, 0 0)' : `polygon(${pts.map((p) => `${p.x.toFixed(2)}px ${p.y.toFixed(2)}px`).join(', ')})`;

/**
 * 纸的右缘角 C 被拉到 P,折线是 CP 的中垂线。
 *  - keep :纸上还平铺着的部分(靠书脊一侧)
 *  - flap :越过折线的部分,沿折线镜像过来 = 翻起来的纸背
 * a = 纸被翻开的程度(0 平铺,1 完全翻走)。
 */
function curlGeometry(W: number, H: number, a: number, corner: Corner, dy: number) {
  const cy = corner === 'top' ? 0 : corner === 'bottom' ? H : H / 2;
  let lift = 0;
  if (corner !== 'middle') {
    // 折角默认往页内偏一点,形成斜折线;手指上下移动再叠加上去。两端 sin=0,起止都是竖直折线
    const bias = corner === 'top' ? H * 0.12 : -H * 0.12;
    lift = Math.max(-H * 0.3, Math.min(H * 0.3, bias + dy * 0.5)) * Math.sin(Math.PI * a);
  }
  const C = { x: W, y: cy };
  const P = { x: W - 2 * a * W, y: cy + lift };
  const vx = C.x - P.x;
  const vy = C.y - P.y;
  const len = Math.hypot(vx, vy);
  if (len < 0.5) return null;
  const n = { x: vx / len, y: vy / len };
  const M = { x: (C.x + P.x) / 2, y: (C.y + P.y) / 2 };
  const side = (p: Pt) => (p.x - M.x) * n.x + (p.y - M.y) * n.y;
  const rect: Pt[] = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }];
  // 关于折线的镜像:x' = R(x - M) + M,R = I - 2nnᵀ
  const r11 = 1 - 2 * n.x * n.x;
  const r12 = -2 * n.x * n.y;
  const r22 = 1 - 2 * n.y * n.y;
  const e = M.x - (r11 * M.x + r12 * M.y);
  const f = M.y - (r12 * M.x + r22 * M.y);
  return {
    keep: clipHalfPlane(rect, (p) => -side(p)),
    flap: clipHalfPlane(rect, side),
    mirror: `matrix(${r11}, ${r12}, ${r12}, ${r22}, ${e}, ${f})`,
    M,
    angle: (Math.atan2(n.y, n.x) * 180) / Math.PI,
    depth: len / 2,
  };
}

/** 沿折线铺一条渐变带(x 轴朝向 n,即越过折线的一侧) */
function foldBand(M: Pt, angle: number, width: number, reach: number, background: string): CSSProperties {
  return {
    position: 'absolute', left: M.x, top: M.y - reach, width: Math.max(1, width), height: reach * 2,
    transformOrigin: '0 50%', transform: `rotate(${angle}deg)`, background, pointerEvents: 'none',
  };
}

/**
 * 页级阅读器:拖动 / 点击左右三分之一 / 方向键翻页,中间点击冒泡给外层(切换移动端工具栏)。
 * 翻页全程由 requestAnimationFrame 推进 s,松手或动画结束时才调用 onGoNext/onGoPrev,
 * 此时画面上只剩下层那一页,切页前后像素一致,不会闪。
 */
export function PaginatedReader(props: PaginatedReaderProps) {
  const { chapters, current, prev, next, pageCount, pageWidth: W, pageHeight: H, bookTitle, author, theme, fontFamily, fontSize, onGoNext, onGoPrev, mode } = props;

  const [turn, setTurn] = useState<Turn | null>(null);
  const turnRef = useRef<Turn | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const anim = useRef<{ raf: number; timer: ReturnType<typeof setTimeout>; done: () => void } | null>(null);
  const gesture = useRef<{
    x0: number; y0: number;
    /** 最近的指针采样,松手时按最后 ~100ms 算甩动速度 */
    samples: { x: number; t: number }[];
    dir: Dir | null; abandoned: boolean; travel: number;
  } | null>(null);
  const suppressClick = useRef(false);

  // 手势回调里读最新 props
  const live = useRef({ prev, next, onGoNext, onGoPrev, mode, W });
  useEffect(() => {
    live.current = { prev, next, onGoNext, onGoPrev, mode, W };
  });

  const setT = (t: Turn | null) => {
    turnRef.current = t;
    setTurn(t);
  };

  const stopAnim = () => {
    if (!anim.current) return;
    cancelAnimationFrame(anim.current.raf);
    clearTimeout(anim.current.timer);
    anim.current = null;
  };
  useEffect(() => stopAnim, []);

  const finish = useCallback((dir: Dir, commit: boolean) => {
    stopAnim();
    // 同一批次里切页 + 清掉翻页状态:下一帧直接是新页平铺
    setT(null);
    if (commit) (dir === 'next' ? live.current.onGoNext : live.current.onGoPrev)();
  }, []);

  const animateTo = useCallback((target: 0 | 1, commit: boolean) => {
    const t0 = turnRef.current;
    if (!t0) return;
    stopAnim();
    const from = t0.s;
    const dur = DURATION[live.current.mode] * Math.max(0.35, Math.abs(target - from));
    const done = () => finish(t0.dir, commit);
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      const cur = turnRef.current;
      if (!cur) return;
      setT({ ...cur, s: from + (target - from) * eased });
      if (k < 1 && anim.current) anim.current.raf = requestAnimationFrame(step);
      else done();
    };
    // 标签页在后台时 rAF 不跑:兜底定时器保证翻页一定会落地
    anim.current = { raf: requestAnimationFrame(step), timer: setTimeout(() => anim.current && done(), dur + 200), done };
  }, [finish]);

  const canTurn = (dir: Dir) => !!(dir === 'next' ? live.current.next : live.current.prev);

  const turnPage = useCallback((dir: Dir) => {
    if (anim.current || gesture.current?.dir || !canTurn(dir)) return;
    setT({ dir, s: 0, corner: 'bottom', dy: 0 });
    animateTo(1, true);
  }, [animateTo]);

  // ── 手势 ──────────────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    suppressClick.current = false;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (anim.current) {
      // 动画还在跑:直接落地,这次按下不开始新手势
      anim.current.done();
      suppressClick.current = true;
      return;
    }
    gesture.current = { x0: e.clientX, y0: e.clientY, samples: [{ x: e.clientX, t: performance.now() }], dir: null, abandoned: false, travel: 0 };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || g.abandoned) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    const now = performance.now();
    g.samples.push({ x: e.clientX, t: now });
    while (g.samples.length > 2 && now - g.samples[0].t > 100) g.samples.shift();

    if (!g.dir) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        g.abandoned = true;
        return;
      }
      if (Math.abs(dx) < 8) return;
      const dir: Dir = dx < 0 ? 'next' : 'prev';
      if (!canTurn(dir)) {
        g.abandoned = true;
        return;
      }
      g.dir = dir;
      try {
        // 手指拖出阅读区也继续跟手
        rootRef.current?.setPointerCapture(e.pointerId);
      } catch {
        /* 指针已失效(比如系统手势抢走):不影响翻页 */
      }
    }
    const rect = rootRef.current?.getBoundingClientRect();
    const y0 = rect ? g.y0 - rect.top : H / 2;
    const corner: Corner = live.current.mode === 'curl' ? (y0 < H / 3 ? 'top' : y0 > (H * 2) / 3 ? 'bottom' : 'middle') : 'middle';
    // 覆盖:纸跟手平移,拖满一屏宽翻完。
    // 仿真往后翻:纸角跟手,角要走两屏宽(从右缘翻到左侧);往前翻:纸从左边翻回来,折线跟手,一屏宽
    g.travel = Math.max(0, g.dir === 'next' ? -dx : dx);
    const span = live.current.mode === 'curl' && g.dir === 'next' ? live.current.W * 2 : live.current.W;
    const s = Math.min(1, g.travel / span);
    setT({ dir: g.dir, s, corner, dy });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (g.dir) {
      suppressClick.current = true;
      const t = turnRef.current;
      const first = g.samples[0];
      const last = g.samples[g.samples.length - 1];
      const dt = last.t - first.t;
      // 采样窗口太短(<16ms)算出来的速度不可信,当作没甩
      const speed = dt >= 16 ? ((last.x - first.x) / dt) * (g.dir === 'next' ? -1 : 1) : 0;
      const commit = !!t && (g.travel > COMMIT_RATIO * live.current.W || (speed > FLICK_SPEED && g.travel > 6));
      animateTo(commit ? 1 : 0, commit);
      return;
    }
    if (g.abandoned || Math.abs(e.clientX - g.x0) > 8 || Math.abs(e.clientY - g.y0) > 8) return;
    // 点击:左三分之一上一页,右三分之一下一页,中间交给外层
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    if (x < rect.width / 3) {
      suppressClick.current = true;
      turnPage('prev');
    } else if (x > (rect.width * 2) / 3) {
      suppressClick.current = true;
      turnPage('next');
    }
  };

  const onPointerCancel = () => {
    const g = gesture.current;
    gesture.current = null;
    if (g?.dir) animateTo(0, false);
  };

  // ── 键盘 ──────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.altKey || e.ctrlKey || e.metaKey || t?.closest?.('input,textarea,select,[contenteditable="true"]')) return;
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        turnPage('prev');
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) {
        e.preventDefault();
        turnPage('next');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [turnPage]);

  if (W <= 0 || H <= 0) return null;

  // ── 渲染 ──────────────────────────────────────────────────────────
  const bodyOf = (p: ReaderPage) => (
    <PageBody
      segments={p.segments}
      ready={p.ready}
      showTitle={p.pageIdx === 0}
      chapterTitle={chapters[p.chapterIdx]?.title || `第 ${p.chapterIdx + 1} 章`}
      bookTitle={bookTitle}
      author={author}
      theme={theme}
      fontFamily={fontFamily}
      fontSize={fontSize}
      width={W}
      height={H}
    />
  );
  const keyOf = (p: ReaderPage) => `${p.chapterIdx}:${p.pageIdx}`;

  const turning = turn ? (turn.dir === 'next' ? current : prev) : null;
  const under = turn ? (turn.dir === 'next' ? next : current) : null;
  // a:翻页那张纸离开原位的程度(0 = 平铺盖住下层,1 = 完全离开)
  const a = turn ? (turn.dir === 'next' ? turn.s : 1 - turn.s) : 0;
  const geo = turn && mode === 'curl' && turning ? curlGeometry(W, H, a, turn.corner, turn.dy) : null;

  const base: CSSProperties = { position: 'absolute', left: 0, top: 0, width: W, height: H };
  const layerStyle = (p: ReaderPage): CSSProperties => {
    if (!turn) return { ...base, zIndex: p === current ? 1 : 0, visibility: p === current ? 'visible' : 'hidden' };
    if (p === under) return { ...base, zIndex: 1 };
    if (p === turning) {
      if (mode === 'cover') {
        return {
          ...base, zIndex: 2,
          transform: `translate3d(${-a * W}px, 0, 0)`,
          boxShadow: a > 0 && a < 1 ? `0 0 28px rgba(0,0,0,${(0.32 * (1 - a * 0.5)).toFixed(3)})` : 'none',
        };
      }
      return { ...base, zIndex: 2, clipPath: geo ? polygon(geo.keep) : undefined };
    }
    return { ...base, zIndex: 0, visibility: 'hidden' };
  };

  // 预挂载前后页(隐藏),翻页开始时不用临时渲染整页文字
  const layers = [prev, next, current].filter((p): p is ReaderPage => !!p);
  const diag = Math.hypot(W, H);
  const liftK = Math.sin(Math.PI * Math.min(1, a * 1.1));

  return (
    <div
      ref={rootRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClick={(e) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          e.stopPropagation();
        }
      }}
      style={{
        position: 'relative', width: W, height: H, overflow: 'hidden',
        touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none',
        backgroundColor: theme.paper, cursor: turn ? 'grabbing' : 'default',
      }}
    >
      {layers.map((p) => (
        <div key={keyOf(p)} style={layerStyle(p)}>
          {bodyOf(p)}
          {turn && p === under && mode === 'cover' && a < 1 && (
            // 被盖住的那页压暗一点,离开越多越亮
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `rgba(0,0,0,${(0.12 * (1 - a)).toFixed(3)})` }} />
          )}
        </div>
      ))}

      {geo && turning && (
        <>
          {/* 翻起的纸在下层页上投的影 */}
          <div
            style={{
              ...foldBand(geo.M, geo.angle, Math.min(geo.depth, 48) + 12, diag,
                `linear-gradient(to right, rgba(0,0,0,${(0.35 * liftK).toFixed(3)}), rgba(0,0,0,0))`),
              zIndex: 3,
            }}
          />
          {/* 纸背:把越过折线的部分沿折线镜像过来 */}
          <div style={{ ...base, zIndex: 4, pointerEvents: 'none', filter: `drop-shadow(0 0 6px rgba(0,0,0,${(0.28 * liftK).toFixed(3)}))` }}>
            <div
              style={{
                ...base, transformOrigin: '0 0', transform: geo.mirror, clipPath: polygon(geo.flap),
                backgroundColor: theme.paper,
              }}
            >
              {bodyOf(turning)}
              {/* 纸背透字:盖一层纸色,只留隐约的反字 */}
              <div style={{ ...base, backgroundColor: theme.paper, opacity: 0.86 }} />
              {/* 纸背的弯曲明暗:折线处最暗,中段提亮,纸边略暗 */}
              <div
                style={foldBand(geo.M, geo.angle, geo.depth, diag,
                  theme.dark
                    ? 'linear-gradient(to right, rgba(0,0,0,.45), rgba(255,255,255,.04) 45%, rgba(0,0,0,.25))'
                    : 'linear-gradient(to right, rgba(0,0,0,.22), rgba(255,255,255,.35) 45%, rgba(0,0,0,.10))')}
              />
            </div>
          </div>
        </>
      )}

      {/* 章内进度条 */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 10, pointerEvents: 'none', backgroundColor: theme.dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)' }}>
        <div style={{ height: '100%', width: `${pageCount > 0 ? ((current.pageIdx + 1) / pageCount) * 100 : 0}%`, backgroundColor: '#E5353E', transition: 'width .2s' }} />
      </div>
      {pageCount > 1 && (
        <div style={{ position: 'absolute', right: PAGE_PADDING.x, bottom: 10, zIndex: 10, fontSize: 12, color: theme.sub, opacity: 0.7, pointerEvents: 'none', fontVariantNumeric: 'tabular-nums' }}>
          {current.pageIdx + 1} / {pageCount}
        </div>
      )}
    </div>
  );
}

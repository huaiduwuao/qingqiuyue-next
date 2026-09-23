'use client';

import React, { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import type { ContentItem } from '@/hooks/useContentItems';
import type { ReaderTheme } from './prefs';
import type { PageSegment } from './pagination';

export interface ReaderPage {
  chapterIdx: number;
  pageIdx: number;
  segments: PageSegment[];
  ready: boolean;
}

interface PaginatedReaderProps {
  chapters: ContentItem[];
  current: ReaderPage;
  prev: ReaderPage | null;
  next: ReaderPage | null;
  /** 当前章节所有页(预留 flipbook 模式用;当前 SlideMode / FlipMode 都按 current 渲染单页) */
  allPages: PageSegment[][];
  pageWidth: number;
  pageHeight: number;
  bookTitle?: string;
  author?: string;
  theme: ReaderTheme;
  fontFamily: string;
  fontSize: number;
  onGoNext: () => void;
  onGoPrev: () => void;
  /** 'slide' = 覆盖(CSS transform);'flip' = 仿真(CSS3D rotateY,自研) */
  mode: 'slide' | 'flip';
}

interface RenderPageArgs {
  segments: PageSegment[];
  pageIdx: number;
  pageWidth: number;
  pageHeight: number;
  chapterTitle?: string;
  chapterIdx: number;
  showTitle: boolean;
  bookTitle?: string;
  author?: string;
  theme: ReaderTheme;
  fontFamily: string;
  fontSize: number;
}

/** 单页内容:slide 和 flip 模式共用 */
function PageBody({
  segments, pageWidth, pageHeight, showTitle, chapterTitle, chapterIdx, bookTitle, author, theme, fontFamily, fontSize,
}: RenderPageArgs) {
  return (
    <Box sx={{ width: pageWidth, height: pageHeight, overflow: 'hidden', boxSizing: 'border-box', px: 2, color: theme.text, backgroundColor: theme.paper }}>
      {showTitle && (
        <Box sx={{ mb: 2, pb: 1.5, borderBottom: `1px dashed ${theme.line}` }}>
          <Box component="h1" sx={{ m: 0, fontSize: '1.3em', lineHeight: 1.35, fontWeight: 500, fontFamily, color: theme.text, wordBreak: 'break-all' }}>
            {chapterTitle || `第 ${chapterIdx + 1} 章`}
          </Box>
          {(bookTitle || author) && (
            <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 2, rowGap: 0.5, fontSize: 13, color: theme.sub }}>
              {bookTitle && <span>{bookTitle}</span>}
              {author && <span>{author}</span>}
            </Box>
          )}
        </Box>
      )}
      <Box
        component="main"
        sx={{
          color: theme.text, fontFamily, fontSize, lineHeight: 1.8, overflowWrap: 'anywhere',
          '& p': { m: 0, mt: '0.8em', textAlign: 'justify' },
          '& p:first-of-type': { mt: 0 },
        }}
      >
        {segments.length === 0 ? (
          <Box sx={{ textAlign: 'center', color: theme.sub, py: 4 }}>本章无正文</Box>
        ) : (
          segments.map((s, i) => (
            <p key={i} style={{ textIndent: s.continuation ? 0 : '2em' }}>{s.text}</p>
          ))
        )}
      </Box>
    </Box>
  );
}

/**
 * 页级阅读器。
 *
 *  - slide:三层(prev / current / next),CSS transform slide,手势拖动。已验证。
 *  - flip :在 slide 基础上叠加 CSS3D perspective + rotateY,看起来像真卷页。
 *          (之前想用 @marvellousptc/react-pageflip 库,在业务路径下库始终
 *          不初始化 stf DOM,反复换 static/dynamic import 都未解。临时自研
 *          rotateY 过渡,后续如需真卷页再换库。)
 */
export function PaginatedReader(props: PaginatedReaderProps) {
  const { chapters, current, prev, next, pageWidth, pageHeight, bookTitle, author, theme, fontFamily, fontSize, onGoNext, onGoPrev, mode } = props;

  if (pageWidth <= 0 || pageHeight <= 0) return null;

  const currentChapter = chapters[current.chapterIdx];

  return (
    <PaginatedInner
      chapters={chapters}
      current={current}
      prev={prev}
      next={next}
      pageWidth={pageWidth}
      pageHeight={pageHeight}
      bookTitle={bookTitle}
      author={author}
      theme={theme}
      fontFamily={fontFamily}
      fontSize={fontSize}
      onGoNext={onGoNext}
      onGoPrev={onGoPrev}
      mode={mode}
      currentChapter={currentChapter}
    />
  );
}

/** 内部组件:统一的翻页状态机,mode === 'flip' 时叠加 rotateY 卷起效果 */
function PaginatedInner(props: {
  chapters: ContentItem[];
  current: ReaderPage;
  prev: ReaderPage | null;
  next: ReaderPage | null;
  pageWidth: number;
  pageHeight: number;
  bookTitle?: string;
  author?: string;
  theme: ReaderTheme;
  fontFamily: string;
  fontSize: number;
  onGoNext: () => void;
  onGoPrev: () => void;
  mode: 'slide' | 'flip';
  currentChapter: ContentItem | null;
}) {
  const { chapters, current, prev, next, pageWidth, pageHeight, bookTitle, author, theme, fontFamily, fontSize, onGoNext, onGoPrev, mode, currentChapter } = props;
  const prevChapter = prev ? chapters[prev.chapterIdx] : null;
  const nextChapter = next ? chapters[next.chapterIdx] : null;

  // 手势状态
  const [dragDx, setDragDx] = useState(0);
  const [dragDir, setDragDir] = useState<'next' | 'prev' | null>(null);
  const startXRef = useRef(0);
  const dirRef = useRef<'next' | 'prev' | null>(null);
  const committedRef = useRef(false);
  const activeRef = useRef(false);
  const dragDxRef = useRef(0);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startXRef.current = e.clientX;
    dirRef.current = null;
    committedRef.current = false;
    activeRef.current = true;
    setDragDx(0);
    setDragDir(null);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!activeRef.current) return;
    const dx = e.clientX - startXRef.current;
    if (dirRef.current === null && Math.abs(dx) > 8) {
      dirRef.current = dx < 0 ? 'next' : 'prev';
      if (dirRef.current === 'prev' && current.pageIdx === 0 && !prev) dirRef.current = null;
      if (dirRef.current === 'next' && current.pageIdx === current.segments.length - 1 && !next) dirRef.current = null;
      setDragDir(dirRef.current);
    }
    setDragDx(dx);
  };
  const onPointerUp = () => {
    if (!activeRef.current) return;
    const dx = dragDxRef.current;
    const threshold = pageWidth * 0.2;
    if (dirRef.current === 'next' && dx < -threshold && !committedRef.current) {
      committedRef.current = true;
      onGoNext();
    } else if (dirRef.current === 'prev' && dx > threshold && !committedRef.current) {
      committedRef.current = true;
      onGoPrev();
    }
    activeRef.current = false;
    setDragDx(0);
    setDragDir(null);
    dirRef.current = null;
  };
  const onPointerCancel = () => {
    activeRef.current = false;
    setDragDx(0);
    setDragDir(null);
    dirRef.current = null;
  };

  useEffect(() => { dragDxRef.current = dragDx; }, [dragDx]);

  // 键盘
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.altKey || e.ctrlKey || e.metaKey || t?.closest?.('input,textarea,[contenteditable="true"]')) return;
      if (e.key === 'ArrowLeft') onGoPrev();
      else if (e.key === 'ArrowRight') onGoNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onGoNext, onGoPrev]);

  const isDragging = activeRef.current;
  const transition = isDragging ? 'none' : (mode === 'flip' ? 'transform .35s cubic-bezier(.4,0,.2,1)' : 'transform .22s cubic-bezier(.4,0,.2,1)');
  // current 层始终在 0 位置 —— 翻页时让 prev/next 做位移;current 自己的内容由 hook 替换。
  const currentTransform = isDragging ? `translateX(${dragDx}px)` : 'translateX(0)';

  // flip 模式:current 层加 rotateY,模拟卷起。ANGLE = dx / pageWidth * 30(最大 30°)
  const angle = isDragging ? Math.max(-30, Math.min(30, (dragDx / pageWidth) * 30)) : 0;
  const flipTransform = `${currentTransform}${angle !== 0 ? ` rotateY(${angle}deg)` : ''} perspective(900px)`;

  const progress = current.segments.length > 0 ? ((current.pageIdx + 1) / current.segments.length) * 100 : 0;

  const renderLayer = (
    meta: ReaderPage | null,
    chapter: ContentItem | null,
    layerLeft: number,
    transform: string,
    isCurrentLayer: boolean,
  ) => {
    if (!meta || !chapter) return null;
    return (
      <Box
        sx={{
          position: 'absolute', top: 0, left: layerLeft, width: pageWidth, height: pageHeight,
          transform, transition,
          transformOrigin: mode === 'flip' ? (isCurrentLayer ? 'left center' : 'right center') : 'center center',
          transformStyle: 'preserve-3d',
          pointerEvents: isCurrentLayer ? 'auto' : 'none',
          backgroundColor: theme.paper,
        }}
      >
        {meta.ready ? (
          <PageBody
            segments={meta.segments}
            pageIdx={meta.pageIdx}
            pageWidth={pageWidth}
            pageHeight={pageHeight}
            showTitle={isCurrentLayer && meta.pageIdx === 0}
            chapterTitle={chapter.title}
            chapterIdx={meta.chapterIdx}
            bookTitle={bookTitle}
            author={author}
            theme={theme}
            fontFamily={fontFamily}
            fontSize={fontSize}
          />
        ) : (
          <Box sx={{ width: pageWidth, height: pageHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.sub, fontSize: 13 }}>
            正在加载…
          </Box>
        )}
        {isCurrentLayer && dragDir && isDragging && (
          <Box
            sx={{
              position: 'absolute', top: 0, bottom: 0, width: 32,
              left: dragDir === 'next' ? 0 : 'auto', right: dragDir === 'prev' ? 0 : 'auto',
              pointerEvents: 'none',
              background: dragDir === 'next'
                ? 'linear-gradient(to right, rgba(0,0,0,.18), rgba(0,0,0,0))'
                : 'linear-gradient(to left, rgba(0,0,0,.18), rgba(0,0,0,0))',
            }}
          />
        )}
      </Box>
    );
  };

  const prevLayerLeft = -pageWidth;
  const nextLayerLeft = pageWidth;
  const prevLayerTransform = isDragging && dragDir === 'prev' ? `translateX(${Math.max(dragDx, 0)}px) perspective(900px) rotateY(${(-Math.max(dragDx, 0) / pageWidth) * 20}deg)` : 'translateX(0)';
  const nextLayerTransform = isDragging && dragDir === 'next' ? `translateX(${Math.min(dragDx, 0)}px) perspective(900px) rotateY(${(Math.min(dragDx, 0) / pageWidth) * 20}deg)` : 'translateX(0)';

  return (
    <Box
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      sx={{
        position: 'relative', width: pageWidth, height: pageHeight,
        overflow: 'hidden', touchAction: 'pan-y',
        backgroundColor: theme.paper,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
    >
      {renderLayer(prev, prevChapter, prevLayerLeft, prevLayerTransform, false)}
      {renderLayer(next, nextChapter, nextLayerLeft, nextLayerTransform, false)}
      {renderLayer(current, currentChapter, 0, mode === 'flip' ? flipTransform : currentTransform, true)}
      <LinearProgress
        variant="determinate" value={progress}
        sx={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 5,
          '& .MuiLinearProgress-bar': { backgroundColor: '#E5353E' },
          backgroundColor: theme.dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)',
          pointerEvents: 'none',
        }}
      />
      {current.segments.length > 1 && (
        <Box sx={{ position: 'absolute', right: 12, bottom: 8, fontSize: 12, color: theme.sub, opacity: 0.7, pointerEvents: 'none', fontVariantNumeric: 'tabular-nums' }}>
          {current.pageIdx + 1} / {current.segments.length}
        </Box>
      )}
      {mode === 'flip' && isDragging && dragDir && (
        <Box sx={{ position: 'absolute', top: 8, left: 12, fontSize: 11, color: theme.sub, opacity: 0.6, pointerEvents: 'none' }}>
          {dragDir === 'next' ? '← 下一页' : '→ 上一页'}
        </Box>
      )}
    </Box>
  );
}
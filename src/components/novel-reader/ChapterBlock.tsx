'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import LockIcon from '@mui/icons-material/Lock';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import type { ContentItem } from '@/hooks/useContentItems';
import { splitParagraphs, wordCount, type ReaderTheme } from './prefs';

export interface ChapterBody {
  content?: string;
  body?: string;
  locked?: boolean;
}

export type FetchChapterBody = (chapterId: string) => Promise<ChapterBody>;

export const CHAPTER_STALE_MS = 10 * 60 * 1000;

interface ChapterBlockProps {
  chapter: ContentItem;
  index: number;
  bookTitle?: string;
  author?: string;
  theme: ReaderTheme;
  fontFamily: string;
  fontSize: number;
  fetchBody: FetchChapterBody;
  /** 章首是否画分隔线(滚动模式下接续的章节) */
  divider: boolean;
  /** 正文就绪(或确定没有正文)后才挂章末哨兵,避免正文还在加载就连续往下接 */
  onReachEnd?: () => void;
  footer?: React.ReactNode;
  /** 点章节标题回到详情/目录(仅阅读态传入,用于从正文回到详情态) */
  onTitleClick?: () => void;
}

/**
 * 一章:标题 + 书名/作者/字数 + 按段排版的正文,各自按章取正文。
 */
export function ChapterBlock({ chapter, index, bookTitle, author, theme, fontFamily, fontSize, fetchBody, divider, onReachEnd, footer, onTitleClick }: ChapterBlockProps) {
  const query = useQuery({
    queryKey: ['novel-chapter', chapter.id],
    queryFn: () => fetchBody(chapter.id),
    enabled: !chapter.content && !chapter.locked,
    staleTime: CHAPTER_STALE_MS,
  });

  const body = chapter.content || query.data?.content || query.data?.body || '';
  const locked = !!chapter.locked || !!query.data?.locked;
  const loading = !chapter.content && !chapter.locked && query.isLoading;
  const paragraphs = useMemo(() => splitParagraphs(body), [body]);
  const words = useMemo(() => wordCount(body), [body]);
  const externalUrl = chapter.url && /^https?:\/\//.test(chapter.url) ? chapter.url : '';

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !onReachEnd || loading) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && onReachEnd(), { rootMargin: '0px 0px 1200px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [onReachEnd, loading]);

  const notice = (children: React.ReactNode) => (
    <Box sx={{ py: 8, textAlign: 'center', color: theme.sub, fontSize: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
      {children}
    </Box>
  );

  return (
    <Box
      component="section"
      data-chapter-index={index}
      id={`chapter-${chapter.id}`}
      sx={{
        borderTop: divider ? `1px solid ${theme.line}` : 'none',
        px: { xs: '20px', sm: '64px' },
        pt: { xs: '40px', sm: '64px' },
        pb: { xs: '40px', sm: '56px' },
        fontSize,
      }}
    >
      <Box
        component="h1"
        onClick={onTitleClick}
        sx={{
          m: 0,
          fontSize: '1.3em',
          lineHeight: 1.35,
          fontWeight: 500,
          color: theme.text,
          fontFamily,
          wordBreak: 'break-all',
          ...(onTitleClick ? { cursor: 'pointer', '&:hover': { color: theme.sub } } : {}),
        }}
      >
        {chapter.title || `第 ${index + 1} 章`}
      </Box>
      <Box sx={{ mt: '6px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 2, rowGap: 0.5, fontSize: 13, color: theme.sub }}>
        {bookTitle && (
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <MenuBookOutlinedIcon sx={{ fontSize: 15 }} />
            {bookTitle}
          </Box>
        )}
        {author && (
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <PersonOutlinedIcon sx={{ fontSize: 16 }} />
            {author}
          </Box>
        )}
        {words > 0 && <span>{words.toLocaleString()}字</span>}
      </Box>

      <Box
        component="main"
        sx={{
          mt: '1.5em',
          color: theme.text,
          fontFamily,
          lineHeight: 1.8,
          overflowWrap: 'anywhere',
          '& p': { m: 0, mt: '0.8em', textIndent: '2em', textAlign: 'justify' },
          '& p:first-of-type': { mt: 0 },
        }}
      >
        {locked
          ? notice(
              <>
                <LockIcon sx={{ opacity: 0.6 }} />
                本章为付费内容,解锁后阅读
              </>,
            )
          : loading
            ? notice(<CircularProgress size={24} sx={{ color: theme.sub }} />)
            : query.isError && !body
              ? notice(
                  <>
                    正文加载失败
                    <Button size="small" variant="outlined" color="inherit" onClick={() => query.refetch()}>
                      重试
                    </Button>
                  </>,
                )
              : paragraphs.length
                ? paragraphs.map((p, i) => <p key={i}>{p}</p>)
                : notice(
                    <>
                      {/* 起点等正版站只收目录,正文在原站读 */}
                      {externalUrl ? '本章正文请在原站阅读' : '本章正文尚未收录'}
                      {externalUrl && (
                        <Button size="small" variant="outlined" color="inherit" href={externalUrl} target="_blank" rel="noopener noreferrer" endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}>
                          去原站阅读本章
                        </Button>
                      )}
                    </>,
                  )}
      </Box>

      {footer}
      {onReachEnd && <div ref={sentinel} aria-hidden />}
    </Box>
  );
}

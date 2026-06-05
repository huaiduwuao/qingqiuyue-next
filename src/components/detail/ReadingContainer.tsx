'use client';

import React, { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { PageStyle } from './ReadingSettings';

interface ReadingContainerProps {
  style: PageStyle;
  children: ReactNode;
  /** 章节标题 + 第几章(可选,novel 用) */
  chapterTitle?: string;
  chapterIndex?: number;
}

/**
 * 长文阅读容器:套主题色/字号/字体/日夜间。
 * 复用 novel 的 renderContent 主体。
 */
export function ReadingContainer({ style, children, chapterTitle, chapterIndex }: ReadingContainerProps) {
  return (
    <Box
      sx={{
        color: style.color,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        backgroundImage: `url(${style.black ? style.blackBodyImage : style.bodyImage})`,
        backgroundColor: style.bgColor,
        minHeight: '100vh',
        p: { xs: 2, md: 4 },
        transition: 'all 0.3s ease',
      }}
    >
      <Box sx={{ mb: 4, maxWidth: 720, mx: 'auto' }}>
        {chapterTitle && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mb: 2,
              pb: 1.5,
              borderBottom: `1px dashed ${style.color}33`,
            }}
          >
            <Box sx={{ width: 4, height: 18, borderRadius: 1, bgcolor: style.color }} />
            <Typography
              variant="h6"
              sx={{ color: style.color, fontFamily: style.fontFamily, fontWeight: 'bold', flex: 1 }}
            >
              {chapterTitle}
            </Typography>
            {chapterIndex != null && (
              <Typography sx={{ fontSize: 11, color: `${style.color}AA` }}>第 {chapterIndex} 章</Typography>
            )}
          </Box>
        )}
        <Typography
          component="div"
          sx={{
            color: style.color,
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            lineHeight: 1.9,
            letterSpacing: '0.02em',
          }}
        >
          {children}
        </Typography>
      </Box>
    </Box>
  );
}

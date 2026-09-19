'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import { mediaUrl } from '@/lib/media';

interface MarkdownViewProps {
  /** markdown 源文本 */
  children: string;
  /**
   * 主题色（阅读页 PageStyle.color 传入，覆盖默认 text.primary）。
   * 不传则用主题文字色。
   */
  color?: string;
}

/**
 * MarkdownView —— 通用 Markdown/富文本渲染器。
 *
 * 修复带图文章详情页打不开的根因：原来详情页用 ReadingContainer 以
 * `whiteSpace: pre-wrap` 直渲纯文本，正文里的 `![](url)` 不会被解析成 <img>，
 * 相对路径与跨域图也没走代理 → 图片 404 / 被防盗链 403。
 *
 * 这里用 react-markdown 把正文真正渲染成结构化节点，并自定义 <img>：
 * 所有图片统一经 `mediaUrl` 改写 —— MinIO 内网直链换成网关地址、外站图
 * 包进 /api/proxy 补 Referer，相对路径按需补 GATEWAY 前缀。
 */
export function MarkdownView({ children, color }: MarkdownViewProps) {
  const theme = useTheme();
  const textColor = color ?? theme.palette.text.primary;

  return (
    <Box
      sx={{
        color: textColor,
        fontSize: 'inherit',
        lineHeight: 1.9,
        letterSpacing: '0.02em',
        overflowWrap: 'anywhere',
        '& p': { my: 1, '&:first-of-type': { mt: 0 } },
        '& h1, & h2, & h3, & h4': { fontWeight: 700, mt: 2.5, mb: 1, lineHeight: 1.4 },
        '& h1': { fontSize: '1.5em' },
        '& h2': { fontSize: '1.3em' },
        '& h3': { fontSize: '1.15em' },
        '& ul, & ol': { pl: 3, my: 1 },
        '& li': { my: 0.5 },
        '& blockquote': {
          borderLeft: '3px solid',
          borderColor: 'divider',
          pl: 1.5,
          ml: 0,
          my: 1.5,
          color: 'text.secondary',
        },
        '& code': {
          fontFamily: 'ui-monospace, monospace',
          fontSize: '0.9em',
          bgcolor: 'action.hover',
          px: 0.5,
          borderRadius: 0.5,
        },
        '& pre': {
          bgcolor: 'action.hover',
          p: 1.5,
          borderRadius: 1,
          overflow: 'auto',
          '& code': { bgcolor: 'transparent', p: 0 },
        },
        '& a': { color: 'primary.main', textDecoration: 'underline' },
        '& img': { maxWidth: '100%', height: 'auto', borderRadius: 1, display: 'block', my: 1.5 },
        '& hr': { border: 'none', borderTop: '1px solid', borderColor: 'divider', my: 2 },
        '& table': { borderCollapse: 'collapse', width: '100%', my: 1.5 },
        '& th, & td': { border: '1px solid', borderColor: 'divider', px: 1, py: 0.5, textAlign: 'left' },
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 图片:统一走 mediaUrl 代理(相对路径补全 + 外站补 Referer)。
          img: ({ src, alt }) => {
            const resolved = mediaUrl(typeof src === 'string' ? src : '');
            if (!resolved) return null;
            // eslint-disable-next-line @next/next/no-img-element
            return <img src={resolved} alt={alt ?? ''} loading="lazy" />;
          },
          // 外链新窗口打开,防 reverse tabnabbing。
          a: ({ href, children: c }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {c}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </Box>
  );
}

export default MarkdownView;

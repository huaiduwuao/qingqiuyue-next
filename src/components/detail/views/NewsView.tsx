'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import MarkdownView from '@/components/common/MarkdownView';
import CoverImage from '@/components/common/CoverImage';
import RelativeTime from '@/components/common/RelativeTime';

interface Props {
  data: any;
}

/**
 * NewsView —— 默认新闻详情视图。
 *
 * 这是把现有 news-detail/page.tsx 内的"正文区"抽出来形成的 view;
 * 老 page 不迁移,这里只作为 DetailRenderer 的 default fallback,
 * 让 DetailLayout + sub=无参数 的调用与现有 news-detail 体例一致。
 */
export function NewsView({ data }: Props) {
  return (
    <Box>
      {data.cover && (
        <CoverImage
          src={data.cover}
          alt={data.title}
          sx={{ width: '100%', borderRadius: 2, mb: 2, aspectRatio: '16 / 9' }}
        />
      )}

      <Typography
        component="h1"
        sx={{ fontWeight: 800, fontSize: { xs: 22, sm: 28 }, mb: 1.5, lineHeight: 1.3 }}
      >
        {data.title}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'text.secondary', mb: 2 }}>
        {data.author && (
          <Typography sx={{ fontSize: 13 }} component="span">
            {data.author}
          </Typography>
        )}
        {data.publish_time && <RelativeTime ts={data.publish_time} />}
      </Box>

      {data.description && (
        <Typography sx={{ fontSize: 14, color: 'text.secondary', mb: 2, lineHeight: 1.7 }}>
          {data.description}
        </Typography>
      )}

      {data.content && <MarkdownView>{data.content}</MarkdownView>}
    </Box>
  );
}

export default NewsView;
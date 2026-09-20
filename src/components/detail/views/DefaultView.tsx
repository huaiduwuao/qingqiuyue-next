'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import MarkdownView from '@/components/common/MarkdownView';
import CoverImage from '@/components/common/CoverImage';

interface Props {
  data: any;
}

/**
 * DefaultView —— 当 DetailRenderer 没有匹配到任何 subcategory 时使用。
 *
 * 与 NewsView 等价(都是文章体例);保留以便于 subcategory 字典中
 * 出现未注册的 family 时降级。
 */
export function DefaultView({ data }: Props) {
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
        sx={{ fontWeight: 800, fontSize: { xs: 22, sm: 28 }, mb: 2, lineHeight: 1.3 }}
      >
        {data.title}
      </Typography>
      {data.content && <MarkdownView>{data.content}</MarkdownView>}
    </Box>
  );
}

export default DefaultView;
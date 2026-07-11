'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import DescriptionIcon from '@mui/icons-material/Description';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import HdRoundedIcon from '@mui/icons-material/Hd';
import { useActiveTab } from '../../ActiveTabContext';

/**
 * 文章发布 — 骨架页。
 *
 * 与 image-publish 同一批拆出(参见 NewCreationSection.tsx:178)。
 * 当前不支持,先占位并提供回退入口。
 */
export default function ArticlePublishPage() {
  const { setActiveTab } = useActiveTab();

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.paper',
        borderRadius: 2,
        border: '1px dashed',
        borderColor: 'divider',
        p: 6,
        minHeight: 480,
      }}
    >
      <Box
        sx={{
          width: 88,
          height: 88,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #8B5CF6 0%, #C4B5FD 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          mb: 2.5,
          boxShadow: '0 8px 24px rgba(139, 92, 246, 0.25)',
        }}
      >
        <DescriptionIcon sx={{ fontSize: 44 }} />
      </Box>

      <Typography sx={{ fontSize: 22, fontWeight: 700, color: 'text.primary', mb: 1 }}>
        文章发布
      </Typography>

      <Chip
        label="开发中"
        size="small"
        sx={{
          mb: 2,
          fontSize: 11,
          fontWeight: 700,
          bgcolor: 'rgba(255, 180, 0, 0.16)',
          color: '#FFB400',
        }}
      />

      <Typography
        sx={{
          fontSize: 13,
          color: 'text.secondary',
          textAlign: 'center',
          maxWidth: 460,
          lineHeight: 1.8,
          mb: 3.5,
        }}
      >
        文章发布支持 8000 字富文本 + 最多 30 张内嵌图片 + 自定义封面,
        拥有独立的目录/标签/合集体系。
        <br />
        当前的"高清发布"页只接受视频文件,无法承载文章流,所以本入口暂未开放。
        <br />
        暂需发布时,请使用下方"去视频发布"通道。
      </Typography>

      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackRoundedIcon />}
          onClick={() => setActiveTab('content')}
          sx={{ textTransform: 'none', fontSize: 13 }}
        >
          返回工作台
        </Button>
        <Button
          variant="contained"
          startIcon={<HdRoundedIcon />}
          onClick={() => setActiveTab('hd-publish', { type: 'video' })}
          sx={{
            textTransform: 'none',
            fontSize: 13,
            background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
            '&:hover': { filter: 'brightness(1.08)' },
          }}
        >
          去视频发布
        </Button>
      </Box>
    </Box>
  );
}

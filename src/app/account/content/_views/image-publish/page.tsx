'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import ImageIcon from '@mui/icons-material/Image';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import HdRoundedIcon from '@mui/icons-material/Hd';
import { useActiveTab } from '../../ActiveTabContext';

/**
 * 图文发布(图集) — 骨架页。
 *
 * 历史原因:NewCreationSection 原本将"发布视频/图文/全景/文章"4 个入口
 * 全部路由到 hd-publish,但 hd-publish 主页面的上传 file input 强制
 * accept="video/*",导致图文入口在选图时直接被浏览器拒。
 *
 * 这次拆分:
 *  - hd-publish         → 视频 (VIDEO contentType, 已存在)
 *  - image-publish      → 图文 (IMAGE contentType, 本文件 — 骨架)
 *  - article-publish    → 文章 (ARTICLE contentType, 骨架)
 *  - panorama-publish   → 全景 (复用 hd-publish, 后续补 360 metadata)
 *
 * 本 view 当前仅占位 — 显示一条明确的"正在开发"提示并提供回退入口,
 * 避免用户再次踩到"4 个按钮都跳同一个 video-only view"的坑。
 */
export default function ImagePublishPage() {
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
          background: 'linear-gradient(135deg, #25F4EE 0%, #5DF7F2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#0F172A',
          mb: 2.5,
          boxShadow: '0 8px 24px rgba(37, 244, 238, 0.25)',
        }}
      >
        <ImageIcon sx={{ fontSize: 44 }} />
      </Box>

      <Typography sx={{ fontSize: 22, fontWeight: 700, color: 'text.primary', mb: 1 }}>
        图文发布
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
        图文发布支持最多 9 张图片 + 长文本,排版、话题、地理位置单独配置。
        <br />
        当前的"高清发布"页只接受视频文件,无法承载图文流,所以本入口暂未开放。
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

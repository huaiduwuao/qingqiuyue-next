'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import ThreeSixtyIcon from '@mui/icons-material/ThreeSixty';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import HdRoundedIcon from '@mui/icons-material/Hd';
import { useActiveTab } from '../../ActiveTabContext';

/**
 * 全景视频发布 — 骨架页。
 *
 * 全景视频(360°)在底层仍然是 video,理论上可以复用 hd-publish 的上传流,
 * 但需要补全 360 metadata(equirectangular projection、stereo mode、
 * initial view yaw/pitch 等)。目前 hd-publish 暂不支持这些字段,
 * 所以单独拆出一个 view 占位,后续补 metadata 表单时再复用底层。
 */
export default function PanoramaPublishPage() {
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
          background: 'linear-gradient(135deg, #FFB400 0%, #FFD566 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#0F172A',
          mb: 2.5,
          boxShadow: '0 8px 24px rgba(255, 180, 0, 0.25)',
        }}
      >
        <ThreeSixtyIcon sx={{ fontSize: 44 }} />
      </Box>

      <Typography sx={{ fontSize: 22, fontWeight: 700, color: 'text.primary', mb: 1 }}>
        全景视频发布
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
        全景视频(360°)需要 equirectangular 投影元数据、初始视角、立体声模式
        等额外配置,当前"高清发布"页未支持。
        <br />
        本入口暂未开放,暂需发布时,请使用下方"去视频发布"通道上传普通视频。
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

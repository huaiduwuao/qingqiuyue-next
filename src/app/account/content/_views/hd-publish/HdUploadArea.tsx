'use client';

import React, { useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import HdRoundedIcon from '@mui/icons-material/HdRounded';
import { BENEFITS } from './hdPublishMeta';
import type { UploadStatus } from './hdPublishModel';

/** 上传触发区(点击直接打开文件选择,不弹窗)+ HD 创作特权面板。memo:填写上传参数时不跟着重渲染。 */
export const HdUploadArea = React.memo(function HdUploadArea({
  uploadFileName,
  uploadFileSizeMB,
  uploadStatus,
  onFileChange: handleFileChange,
}: {
  uploadFileName: string | null;
  uploadFileSizeMB: number;
  uploadStatus: UploadStatus;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
        gap: 2,
      }}
    >
      {/* Upload area — click 直接触发 file input,不再弹窗 */}
      <Box
        onClick={() => fileInputRef.current?.click()}
        sx={{
          borderRadius: 2,
          border: '2px dashed',
          borderColor: 'primary.main',
          p: { xs: 3, md: 4 },
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(254, 44, 85, 0.06) 0%, rgba(37, 244, 238, 0.06) 100%)',
          transition: 'all 0.2s',
          '&:hover': {
            borderColor: 'primary.main',
            background: 'linear-gradient(135deg, rgba(254, 44, 85, 0.10) 0%, rgba(37, 244, 238, 0.10) 100%)',
            transform: 'translateY(-2px)',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #FE2C55 0%, #FFB400 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              flexShrink: 0,
            }}
          >
            <CloudUploadRoundedIcon sx={{ fontSize: 32 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: 18, fontWeight: 600, color: 'text.primary' }}>
                上传高清视频
              </Typography>
              <Chip
                size="small"
                label="支持 4K 60fps · HDR"
                sx={{
                  height: 18,
                  fontSize: 10,
                  fontWeight: 700,
                  bgcolor: 'rgba(254, 44, 85, 0.12)',
                  color: 'primary.main',
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            </Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.6 }}>
              {uploadFileName
                ? `已选: ${uploadFileName} · ${uploadFileSizeMB} MB · ${
                    uploadStatus === 'uploading' ? '上传中…'
                    : uploadStatus === 'uploaded' ? '已上传,可以提交了'
                    : uploadStatus === 'failed' ? '上传失败,请重试'
                    : '等待选择'
                  }`
                : '点击或拖拽视频文件到此区域 · 单文件最大 10GB · 支持 MP4 / MOV / MKV / WebM'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, mt: 1.5, flexWrap: 'wrap' }}>
              {['4K 60fps', 'HDR 10bit', '杜比全景声', '多音轨多字幕'].map((t) => (
                <Box
                  key={t}
                  sx={{
                    px: 1,
                    py: 0.25,
                    borderRadius: 0.5,
                    bgcolor: 'action.hover',
                    color: 'text.secondary',
                    fontSize: 10,
                  }}
                >
                  {t}
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </Box>

      {/* HD 权益 panel */}
      <Box
        sx={{
          p: 2.5,
          borderRadius: 2,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
          <Box
            sx={{
              width: 24,
              height: 24,
              borderRadius: 0.75,
              background: 'linear-gradient(135deg, #FE2C55 0%, #FFB400 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              mr: 1,
            }}
          >
            <HdRoundedIcon sx={{ fontSize: 14 }} />
          </Box>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary' }}>HD 创作特权</Typography>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.25 }}>
          {BENEFITS.map((b) => (
            <Tooltip key={b.title} title={b.desc} placement="top" arrow>
              <Box
                sx={{
                  p: 1.25,
                  borderRadius: 1.5,
                  bgcolor: 'action.hover',
                  border: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  transition: 'all 0.15s',
                  cursor: 'help',
                  '&:hover': { borderColor: b.color, bgcolor: `${b.color}08` },
                }}
              >
                <Box sx={{ color: b.color, display: 'flex' }}>{b.icon}</Box>
                <Typography sx={{ fontSize: 11, color: 'text.primary', fontWeight: 500 }}>{b.title}</Typography>
              </Box>
            </Tooltip>
          ))}
        </Box>
      </Box>
    </Box>
  );
});

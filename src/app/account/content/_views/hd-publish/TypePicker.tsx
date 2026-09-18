'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { type PublishHubType } from '@/lib/contentRoute';
import { CREATION_TYPES, type CreationType } from '../../_components/contentTypes';

/**
 * hd-publish dispatcher 的"类型选择"落地页。
 *
 * 13 张类型卡片(每张带图标 + 一句话说明 + 配色)统一从 contentTypes.tsx 来,
 * 与工作台 NewCreationSection 共用同一份配置;这里只决定 landing 视觉。
 *
 * 选了类型后调用 onPick(hubType) 进入对应表单(VIDEO 内联、其他 Dialog)。
 */
export interface TypePickerProps {
  onPick: (type: PublishHubType) => void;
}

export function TypePicker({ onPick }: TypePickerProps) {
  return (
    <Box>
      {/* Hero header */}
      <Box
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: 2,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          background: 'linear-gradient(135deg, rgba(254, 44, 85, 0.06) 0%, rgba(37, 244, 238, 0.06) 60%, rgba(139, 92, 246, 0.06) 100%)',
          mb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, flexWrap: 'wrap' }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 1.5,
              background: 'linear-gradient(135deg, #FE2C55 0%, #25F4EE 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              flexShrink: 0,
            }}
          >
            {CREATION_TYPES[0]?.icon && React.cloneElement(CREATION_TYPES[0].icon as React.ReactElement, { sx: { fontSize: 26 } })}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>
              选择要发布的内容类型
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
              支持 13 种内容形态 · 提交后进入审核队列
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* 13 类型卡片网格 */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 1.5,
        }}
      >
        {CREATION_TYPES.map((c: CreationType) => (
          <Box
            key={c.id}
            role="button"
            tabIndex={0}
            onClick={() => onPick(c.hubType)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onPick(c.hubType);
              }
            }}
            sx={{
              position: 'relative',
              p: 2,
              borderRadius: 2,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              cursor: 'pointer',
              transition: 'all 0.18s',
              display: 'flex',
              flexDirection: 'column',
              gap: 0.75,
              minHeight: 132,
              '&:hover': {
                borderColor: 'primary.main',
                transform: 'translateY(-2px)',
                boxShadow: '0 6px 20px rgba(254, 44, 85, 0.12)',
                '& .arrow': { opacity: 1, transform: 'translateX(0)' },
              },
              '&:focus-visible': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: 2,
              },
            }}
            aria-label={`发布 ${c.title}`}
          >
            {c.badge && (
              <Chip
                size="small"
                label={c.badge}
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  height: 18,
                  fontSize: 10,
                  fontWeight: 700,
                  bgcolor: 'rgba(254, 44, 85, 0.12)',
                  color: 'primary.main',
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            )}
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1.5,
                background: c.gradient,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                '& .MuiSvgIcon-root': { fontSize: 22 },
              }}
            >
              {c.icon}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary' }}>
                {c.title}
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.25, lineHeight: 1.4 }}>
                {c.desc}
              </Typography>
            </Box>
            <Box
              className="arrow"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                fontSize: 11,
                fontWeight: 600,
                color: 'primary.main',
                opacity: 0.55,
                transform: 'translateX(-4px)',
                transition: 'all 0.18s',
              }}
            >
              立即发布
              <ArrowForwardRoundedIcon sx={{ fontSize: 13 }} />
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

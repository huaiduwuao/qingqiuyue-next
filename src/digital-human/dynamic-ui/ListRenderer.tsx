'use client'

/**
 * ListRenderer - 列表渲染器
 */

import React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import type { ListItem } from './types'

interface ListRendererProps {
  items: ListItem[]
  onItemClick?: (item: ListItem) => void
}

export function ListRenderer({ items, onItemClick }: ListRendererProps) {
  if (!items || items.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
        暂无数据
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {items.map((item, index) => (
        <Box
          key={item.id || index}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            p: 2,
            borderRadius: 1,
            border: 1,
            borderColor: 'divider',
            cursor: item.action || onItemClick ? 'pointer' : 'default',
            transition: 'all 0.2s',
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: 'action.hover'
            }
          }}
          onClick={() => onItemClick?.(item)}
        >
          {item.icon && (
            <Box sx={{
              width: 40,
              height: 40,
              borderRadius: 1,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20
            }}>
              {item.icon}
            </Box>
          )}

          {item.image && (
            <Box
              component="img"
              src={item.image}
              alt={item.title}
              sx={{
                width: 60,
                height: 60,
                borderRadius: 1,
                objectFit: 'cover'
              }}
            />
          )}

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 600, mb: 0.5 }}>
              {item.title}
            </Typography>
            {item.subtitle && (
              <Typography variant="body2" color="text.secondary">
                {item.subtitle}
              </Typography>
            )}
            {item.tags && item.tags.length > 0 && (
              <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                {item.tags.map((tag, i) => (
                  <Chip key={i} label={tag} size="small" sx={{ height: 20, fontSize: 11 }} />
                ))}
              </Box>
            )}
          </Box>

          {item.action && (
            <Box sx={{ color: 'primary.main', fontSize: 20 }}>›</Box>
          )}
        </Box>
      ))}
    </Box>
  )
}

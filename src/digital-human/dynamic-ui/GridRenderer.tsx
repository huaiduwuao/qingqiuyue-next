'use client'

/**
 * GridRenderer - 网格渲染器
 */

import React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Badge from '@mui/material/Badge'
import type { GridItem } from './types'

interface GridRendererProps {
  items: GridItem[]
  columns?: number
  onItemClick?: (item: GridItem) => void
}

export function GridRenderer({ items, columns = 3, onItemClick }: GridRendererProps) {
  if (!items || items.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
        暂无数据
      </Box>
    )
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 2
      }}
    >
      {items.map((item, index) => (
        <Box
          key={item.id || index}
          sx={{
            borderRadius: 1,
            overflow: 'hidden',
            border: 1,
            borderColor: 'divider',
            cursor: item.action || onItemClick ? 'pointer' : 'default',
            transition: 'all 0.2s',
            '&:hover': {
              borderColor: 'primary.main',
              transform: 'translateY(-2px)',
              boxShadow: 2
            }
          }}
          onClick={() => onItemClick?.(item)}
        >
          {item.image && (
            <Box
              sx={{
                width: '100%',
                height: 120,
                position: 'relative'
              }}
            >
              <Box
                component="img"
                src={item.image}
                alt={item.title}
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
              {item.badge && (
                <Badge
                  badgeContent={item.badge}
                  color="primary"
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8
                  }}
                />
              )}
            </Box>
          )}

          <Box sx={{ p: 1.5 }}>
            <Typography
              sx={{
                fontWeight: 600,
                fontSize: 14,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {item.title}
            </Typography>
            {item.subtitle && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  fontSize: 12,
                  mt: 0.5,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {item.subtitle}
              </Typography>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  )
}

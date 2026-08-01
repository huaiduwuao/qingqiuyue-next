'use client'

/**
 * DynamicUIModal - 动态 UI 模态框组件
 *
 * 用于在 ImmersiveDigitalHuman 中渲染 Hermes Intent Hub 下发的动态 UI。
 * 支持：Modal、Drawer、Toast、Inline、Fullscreen、Floating 等类型。
 */

import React, { useEffect, useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Snackbar,
  Alert,
  Chip,
  Divider,
  CircularProgress,
} from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import type { DynamicUI, UIAction, UIBody, ListItem, GridItem, FormField } from './types'
import { devLog } from '@/lib/dev-log'

interface DynamicUIModalProps {
  /** 当前要渲染的 UI */
  ui: DynamicUI | null
  /** UI 关闭回调 */
  onClose: () => void
  /** 动作执行回调 */
  onAction: (action: UIAction) => void
  /** 是否打开 */
  open?: boolean
}

export function DynamicUIModal({ ui, onClose, onAction, open }: DynamicUIModalProps) {
  const [toastOpen, setToastOpen] = useState(false)
  const [toastContent, setToastContent] = useState('')
  const [toastSeverity, setToastSeverity] = useState<'success' | 'info' | 'warning' | 'error'>('info')

  // Toast 类型的特殊处理
  useEffect(() => {
    if (ui?.type === 'toast' && ui.body?.content) {
      setToastContent(ui.body.content as string)
      setToastSeverity((ui.avatar?.expression as any) || 'info')
      setToastOpen(true)
    }
  }, [ui])

  // 未设置 UI 时不渲染
  if (!ui) return null

  const isOpen = open !== undefined ? open : ui.type !== 'toast'

  // Toast 类型
  if (ui.type === 'toast') {
    return (
      <Snackbar
        open={toastOpen}
        autoHideDuration={ui.duration || 3000}
        onClose={() => {
          setToastOpen(false)
          onClose()
        }}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity={toastSeverity}
          onClose={() => setToastOpen(false)}
        >
          {ui.body?.content as string}
        </Alert>
      </Snackbar>
    )
  }

  // Inline 类型
  if (ui.type === 'inline') {
    return (
      <Box
        style={{
          position: 'fixed',
          bottom: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1300,
          backgroundColor: 'rgba(0,0,0,0.85)',
          borderRadius: 8,
          padding: 16,
          minWidth: 300,
          maxWidth: '90vw',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {ui.header?.title && (
          <>
            <Typography variant="h6" style={{ color: 'white', marginBottom: 8 }}>
              {ui.header.title}
            </Typography>
            {ui.header?.subtitle && (
              <Typography variant="body2" style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>
                {ui.header.subtitle}
              </Typography>
            )}
            <Divider style={{ marginBottom: 16, borderColor: 'rgba(255,255,255,0.1)' }} />
          </>
        )}
        {renderBody(ui.body, onAction)}
        {ui.actions && ui.actions.length > 0 && (
          <Box style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
            {ui.actions.map((action) => (
              <Button
                key={action.id}
                variant={action.style === 'primary' ? 'contained' : 'outlined'}
                size="small"
                onClick={() => onAction(action)}
              >
                {action.label}
              </Button>
            ))}
          </Box>
        )}
      </Box>
    )
  }

  // Fullscreen 类型
  if (ui.type === 'fullscreen') {
    return (
      <Box
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1400,
          backgroundColor: 'rgba(0,0,0,0.95)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <Box
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Box>
            <Typography variant="h5" style={{ color: 'white' }}>
              {ui.header?.title || '全屏'}
            </Typography>
            {ui.header?.subtitle && (
              <Typography variant="body2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {ui.header.subtitle}
              </Typography>
            )}
          </Box>
          <IconButton onClick={onClose} style={{ color: 'white' }}>
            <CloseRoundedIcon />
          </IconButton>
        </Box>

        {/* Body */}
        <Box style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {renderBody(ui.body, onAction)}
        </Box>

        {/* Actions */}
        {ui.actions && ui.actions.length > 0 && (
          <Box
            style={{
              display: 'flex',
              gap: 16,
              padding: 16,
              borderTop: '1px solid rgba(255,255,255,0.1)',
              justifyContent: 'flex-end',
            }}
          >
            {ui.actions.map((action) => (
              <Button
                key={action.id}
                variant={action.style === 'primary' ? 'contained' : 'outlined'}
                onClick={() => onAction(action)}
              >
                {action.label}
              </Button>
            ))}
          </Box>
        )}
      </Box>
    )
  }

  // Floating 类型
  if (ui.type === 'floating') {
    const position = ui.position || { vertical: 'bottom', horizontal: 'right' }
    return (
      <Box
        style={{
          position: 'fixed',
          bottom: position.vertical === 'bottom' ? (position.offset || 80) : undefined,
          top: position.vertical === 'top' ? (position.offset || 80) : undefined,
          right: position.horizontal === 'right' ? (position.offset || 20) : undefined,
          left: position.horizontal === 'left' ? (position.offset || 20) : undefined,
          zIndex: 1300,
          backgroundColor: 'rgba(20,20,30,0.95)',
          borderRadius: 8,
          padding: 16,
          minWidth: 280,
          maxWidth: 360,
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.15)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        {ui.header?.title && (
          <Typography variant="subtitle1" style={{ color: 'white', fontWeight: 600, marginBottom: 4 }}>
            {ui.header.title}
          </Typography>
        )}
        {ui.header?.subtitle && (
          <Typography variant="body2" style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
            {ui.header.subtitle}
          </Typography>
        )}
        <Divider style={{ marginBottom: 12, borderColor: 'rgba(255,255,255,0.1)' }} />
        {renderBody(ui.body, onAction)}
        {ui.actions && ui.actions.length > 0 && (
          <Box style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            {ui.actions.map((action) => (
              <Chip
                key={action.id}
                label={action.label}
                size="small"
                onClick={() => onAction(action)}
                style={{
                  cursor: 'pointer',
                  backgroundColor: action.style === 'primary' ? 'primary.main' : 'rgba(255,255,255,0.1)',
                  color: 'white',
                }}
              />
            ))}
          </Box>
        )}
      </Box>
    )
  }

  // Modal 类型 (默认)
  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      {/* Header */}
      {(ui.header?.title || ui.header?.subtitle) && (
        <DialogTitle style={{ paddingBottom: 8 }}>
          <Box style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Box>
              {ui.header?.title && (
                <Typography variant="h6" style={{ color: 'white', fontWeight: 600 }}>
                  {ui.header.title}
                </Typography>
              )}
              {ui.header?.subtitle && (
                <Typography variant="body2" style={{ color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                  {ui.header.subtitle}
                </Typography>
              )}
            </Box>
            <IconButton onClick={onClose} size="small" style={{ color: 'rgba(255,255,255,0.6)' }}>
              <CloseRoundedIcon />
            </IconButton>
          </Box>
        </DialogTitle>
      )}

      <DialogContent>
        {renderBody(ui.body, onAction)}
      </DialogContent>

      {/* Actions */}
      {ui.actions && ui.actions.length > 0 && (
        <DialogActions style={{ padding: '8px 24px 16px' }}>
          {ui.actions.map((action) => (
            <Button
              key={action.id}
              variant={action.style === 'primary' ? 'contained' : 'outlined'}
              onClick={() => onAction(action)}
            >
              {action.label}
            </Button>
          ))}
        </DialogActions>
      )}
    </Dialog>
  )
}

// 渲染 Body 内容
function renderBody(body: UIBody | undefined, onAction?: (action: UIAction) => void): React.ReactNode {
  if (!body) return null

  const content = body.content as any

  switch (body.type) {
    case 'text':
      return (
        <Typography style={{ color: 'rgba(255,255,255,0.9)', whiteSpace: 'pre-wrap' }}>
          {body.content as string}
        </Typography>
      )

    case 'list':
      if (content?.items) {
        return (
          <List disablePadding>
            {(content.items as ListItem[]).map((item, index) => (
              <ListItemButton
                key={item.id || index}
                onClick={() => item.action && onAction?.({ id: item.id || String(index), label: item.action, style: 'secondary', handler: 'intent' })}
                style={{ borderRadius: 4, marginBottom: 4 }}
              >
                {item.icon && (
                  <ListItemIcon style={{ minWidth: 36, color: 'rgba(255,255,255,0.7)' }}>
                    <Typography>{item.icon}</Typography>
                  </ListItemIcon>
                )}
                <ListItemText
                  primary={item.title}
                  secondary={item.subtitle}
                />
              </ListItemButton>
            ))}
          </List>
        )
      }
      return null

    case 'grid':
      if (content?.items) {
        return (
          <Box style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${(content as any).columns || 3}, 1fr)`,
            gap: 8
          }}>
            {(content.items as GridItem[]).map((item, index) => (
              <Box
                key={item.id || index}
                style={{
                  borderRadius: 4,
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.1)',
                  cursor: item.action ? 'pointer' : 'default',
                }}
                onClick={() => item.action && onAction?.({ id: item.id || String(index), label: item.action, style: 'secondary', handler: 'intent' })}
              >
                {item.image && (
                  <Box
                    component="img"
                    src={item.image}
                    alt={item.title}
                    style={{ width: '100%', height: 120, objectFit: 'cover' }}
                  />
                )}
                <Box style={{ padding: 12 }}>
                  <Typography style={{ fontWeight: 600, fontSize: 14 }}>
                    {item.title}
                  </Typography>
                  {item.subtitle && (
                    <Typography variant="body2" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                      {item.subtitle}
                    </Typography>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        )
      }
      return null

    case 'form':
      if (content?.fields) {
        devLog.debug('[DynamicUIModal] form submit - use DialogActions buttons')
        return (
          <Typography style={{ color: 'rgba(255,255,255,0.7)' }}>
            表单包含 {(content.fields as FormField[]).length} 个字段
          </Typography>
        )
      }
      return null

    case 'loading':
      return (
        <Box style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
          <CircularProgress />
        </Box>
      )

    default:
      return (
        <Typography style={{ color: 'rgba(255,255,255,0.7)' }}>
          {String(body.content || '')}
        </Typography>
      )
  }
}

export default DynamicUIModal

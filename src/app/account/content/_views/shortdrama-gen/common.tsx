'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import { fileUpload } from '@/apis/global';
import type { ShotStatus, TaskStatus } from '@/apis/shortdrama';

/** 任务状态色。 */
export function TaskStatusChip({ status, size = 'small' }: { status: TaskStatus; size?: 'small' | 'medium' }) {
  const map: Record<TaskStatus, { label: string; color: 'default' | 'primary' | 'success' | 'error' | 'warning' }> = {
    queued: { label: '排队中', color: 'default' },
    running: { label: '进行中', color: 'primary' },
    succeeded: { label: '完成', color: 'success' },
    failed: { label: '失败', color: 'error' },
    cancelled: { label: '已取消', color: 'warning' },
  };
  const m = map[status] ?? { label: status, color: 'default' as const };
  return <Chip size={size} label={m.label} color={m.color} variant={status === 'running' ? 'filled' : 'outlined'} />;
}

export function ShotStatusChip({ status }: { status: ShotStatus }) {
  const map: Record<ShotStatus, { label: string; color: 'default' | 'primary' | 'success' | 'error' | 'warning' | 'info' }> = {
    draft: { label: '待出图', color: 'default' },
    generating: { label: '出图中', color: 'primary' },
    done: { label: '已出图', color: 'success' },
    failed: { label: '失败', color: 'error' },
    qc_flagged: { label: '质检标记', color: 'warning' },
    approved: { label: '已通过', color: 'info' },
  };
  const m = map[status] ?? { label: status, color: 'default' as const };
  return <Chip size="small" label={m.label} color={m.color} variant="outlined" />;
}

/** 实体状态(draft / designed / locked / scripted…)。 */
export function EntityStatusChip({ status }: { status: string }) {
  const label: Record<string, string> = {
    draft: '草稿', designed: '已设定', locked: '已定妆', scripted: '已写剧本', storyboarded: '已分镜', paced: '已调节奏',
    rendered: '已出图', checked: '已质检',
  };
  return <Chip size="small" variant="outlined" label={label[status] ?? status} />;
}

/** 缩略图:没有图时占位;点击放大。 */
export function MediaThumb({
  src,
  video,
  alt,
  ratio = '9 / 16',
  height = 160,
  onClick,
}: {
  src?: string;
  video?: string;
  alt?: string;
  ratio?: string;
  height?: number;
  onClick?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const clickable = !!(src || video);
  return (
    <>
      <Box
        onClick={() => (onClick ? onClick() : clickable && setOpen(true))}
        sx={{
          height,
          aspectRatio: ratio,
          maxWidth: '100%',
          borderRadius: 1.5,
          overflow: 'hidden',
          bgcolor: 'action.hover',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: clickable || onClick ? 'pointer' : 'default',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        {video ? (
          <video src={video} muted loop playsInline autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <ImageRoundedIcon sx={{ color: 'text.disabled', fontSize: 28 }} />
        )}
      </Box>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md">
        <Box sx={{ p: 1, bgcolor: '#000', display: 'flex', justifyContent: 'center' }}>
          {video ? (
            <video src={video} controls autoPlay style={{ maxWidth: '100%', maxHeight: '80vh' }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={alt ?? ''} style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }} />
          )}
        </Box>
      </Dialog>
    </>
  );
}

/** 上传参考图按钮(走 content-api /file/upload,返回 url)。 */
export function UploadImageButton({ onUploaded, label = '上传参考图', disabled }: { onUploaded: (url: string) => void; label?: string; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setErr('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = (await fileUpload(fd as unknown as Record<string, unknown>)) as { data?: { url?: string } };
      const url = res?.data?.url;
      if (!url) throw new Error('上传没有返回地址');
      onUploaded(url);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : '上传失败');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Tooltip title={err || ''}>
      <span>
        <Button size="small" component="label" variant="text" disabled={disabled || busy} color={err ? 'error' : 'inherit'}>
          {busy ? <CircularProgress size={14} sx={{ mr: 1 }} /> : null}
          {err ? '上传失败' : label}
          <input type="file" accept="image/*" hidden onChange={handle} />
        </Button>
      </span>
    </Tooltip>
  );
}

/** 空状态。 */
export function Empty({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
      <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      {hint && (
        <Typography variant="body2" sx={{ mb: 2 }}>
          {hint}
        </Typography>
      )}
      {action}
    </Box>
  );
}

/** 单字段快速编辑对话框(多行文本)。 */
export function TextEditDialog({
  open,
  title,
  value,
  multiline = true,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  value: string;
  multiline?: boolean;
  onClose: () => void;
  onSave: (v: string) => Promise<void> | void;
}) {
  const [v, setV] = useState(value);
  const [saving, setSaving] = useState(false);
  React.useEffect(() => setV(value), [value, open]);
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <TextField autoFocus fullWidth multiline={multiline} minRows={multiline ? 4 : 1} value={v} onChange={(e) => setV(e.target.value)} sx={{ mt: 1 }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          variant="contained"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(v);
              onClose();
            } finally {
              setSaving(false);
            }
          }}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function fmtTime(s?: string): string {
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

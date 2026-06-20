'use client';

import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import type { HermesInstanceItem } from '@/apis/hermes';

interface HermesInstanceFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: any) => void;
  record: HermesInstanceItem | null;
  isSubmitting?: boolean;
}

const STATUS_OPTIONS: Array<HermesInstanceItem['status']> = ['active', 'paused', 'offline'];

export default function HermesInstanceFormDialog({ open, onClose, onSubmit, record, isSubmitting }: HermesInstanceFormDialogProps) {
  const isEdit = !!record?.id;
  const [values, setValues] = useState<Record<string, any>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    if (record) {
      setValues({
        name: record.name || '',
        code: record.code || '',
        baseUrl: record.baseUrl || '',
        description: record.description || '',
        region: record.region || '',
        maxConcurrent: record.maxConcurrent ?? 10,
        status: record.status || 'active',
      });
    } else {
      setValues({
        name: '',
        code: '',
        baseUrl: '',
        description: '',
        region: 'default',
        maxConcurrent: 10,
        status: 'active',
      });
    }
    setError('');
  }, [record, open]);

  const set = (k: string, v: any) => setValues((s) => ({ ...s, [k]: v }));

  const handleSubmit = () => {
    if (!values.name || !String(values.name).trim()) {
      setError('名称不能为空');
      return;
    }
    if (!values.code || !String(values.code).trim()) {
      setError('编码不能为空');
      return;
    }
    if (!values.baseUrl || !String(values.baseUrl).trim()) {
      setError('baseUrl 不能为空');
      return;
    }
    setError('');
    const payload = {
      name: String(values.name).trim(),
      code: String(values.code).trim(),
      baseUrl: String(values.baseUrl).trim(),
      description: values.description || '',
      region: values.region || 'default',
      maxConcurrent: Number(values.maxConcurrent) || 10,
      status: values.status || 'active',
    };
    onSubmit(payload);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? `编辑实例 #${record?.id}` : '新建 Hermes 实例'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="名称"
            value={values.name || ''}
            onChange={(e) => set('name', e.target.value)}
            fullWidth
            required
            helperText="展示用,可中文"
          />
          <TextField
            label="编码(code)"
            value={values.code || ''}
            onChange={(e) => set('code', e.target.value)}
            fullWidth
            required
            helperText="英文标识,如 frontend"
          />
          <TextField
            label="baseUrl"
            value={values.baseUrl || ''}
            onChange={(e) => set('baseUrl', e.target.value)}
            fullWidth
            required
            helperText="容器完整 URL,如 http://qingqiuyue-hermes-agent:8080"
          />
          <TextField
            label="描述"
            value={values.description || ''}
            onChange={(e) => set('description', e.target.value)}
            fullWidth
            multiline
            rows={2}
          />
          <TextField
            label="区域(region)"
            value={values.region || ''}
            onChange={(e) => set('region', e.target.value)}
            fullWidth
            helperText="如 default / frontend / ops / cs"
          />
          <TextField
            label="最大并发(maxConcurrent)"
            type="number"
            value={values.maxConcurrent ?? 10}
            onChange={(e) => set('maxConcurrent', Number(e.target.value))}
            fullWidth
            slotProps={{ htmlInput: { min: 1 } }}
            helperText="容器允许的最大并发数,默认 10"
          />
          <TextField
            select
            label="状态"
            value={values.status || 'active'}
            onChange={(e) => set('status', e.target.value)}
            fullWidth
          >
            {STATUS_OPTIONS.map((s) => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </TextField>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={isSubmitting}>
          {isEdit ? '保存' : '创建'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

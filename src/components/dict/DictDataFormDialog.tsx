'use client';

import React, { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Box from '@mui/material/Box';
import type { DictDataItem } from '@/beans/system';

export interface DictDataFormDialogProps {
  open: boolean;
  /** 编辑时传入;新建时为 null */
  record?: DictDataItem | null;
  /** 必填,字典类型(如 user-status) */
  dictType: string;
  /** 创建子项时传入父节点;为 0 / undefined 表示新建根 */
  parent?: DictDataItem | null;
  /** 父项 label 用于展示(若 parent 给的是 dict_data 子项,显示 name;若父是 dict_type,显示 name) */
  parentLabel?: string;
  onClose: () => void;
  onSubmit: (values: Partial<DictDataItem> & Record<string, any>) => Promise<void> | void;
  submitting?: boolean;
}

interface FormState {
  label: string;
  value: string;
  sort: string;
  info: string;
  status: boolean;
}

const EMPTY: FormState = { label: '', value: '', sort: '0', info: '', status: true };

export function DictDataFormDialog(props: DictDataFormDialogProps) {
  const { open, record, dictType, parent, parentLabel, onClose, onSubmit, submitting } = props;
  const [form, setForm] = useState<FormState>(EMPTY);

  useEffect(() => {
    if (open) {
      if (record) {
        setForm({
          label: (record as any).label ?? record.name ?? '',
          value: record.value ?? '',
          sort: record.sort?.toString() ?? '0',
          info: (record as any).info ?? record.remark ?? '',
          status: record.status === 'DISABLED' || record.status === 0 ? false : true,
        });
      } else {
        setForm(EMPTY);
      }
    }
  }, [open, record]);

  const isEdit = !!record?.id;
  const parentId = record?.parentId ?? record?.pid ?? parent?.id ?? 0;

  const handleSubmit = async () => {
    if (!form.label.trim() && !form.value.trim()) return;
    const payload: Partial<DictDataItem> & Record<string, any> = {
      id: record?.id,
      typeName: dictType,
      typeId: (record as any)?.typeId,
      label: form.label,
      name: form.label || form.value,
      value: form.value,
      sort: form.sort,
      remark: form.info,
      info: form.info,
      parentId,
      pid: parentId,
      status: form.status ? 'ENABLED' : 'DISABLED',
    };
    await onSubmit(payload);
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? '编辑字典数据' : parent ? `新建子项 — ${parentLabel || parent.name || (parent as any).label || ''}` : '新建字典数据'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="字典类型"
            value={dictType}
            disabled
            size="small"
            fullWidth
          />
          <TextField
            label="名称 / label"
            value={form.label}
            onChange={(e) => setForm((s) => ({ ...s, label: e.target.value }))}
            size="small"
            fullWidth
            autoFocus
          />
          <TextField
            label="值 / value"
            value={form.value}
            onChange={(e) => setForm((s) => ({ ...s, value: e.target.value }))}
            size="small"
            fullWidth
            disabled={isEdit}
            helperText={isEdit ? '值不可修改' : ''}
          />
          <TextField
            label="排序"
            value={form.sort}
            onChange={(e) => setForm((s) => ({ ...s, sort: e.target.value }))}
            size="small"
            type="number"
            fullWidth
          />
          <TextField
            label="备注"
            value={form.info}
            onChange={(e) => setForm((s) => ({ ...s, info: e.target.value }))}
            size="small"
            multiline
            minRows={2}
            fullWidth
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.status}
                  onChange={(e) => setForm((s) => ({ ...s, status: e.target.checked }))}
                />
              }
              label="启用"
            />
            {parent ? (
              <Box sx={{ fontSize: 12, color: 'text.secondary' }}>
                父节点:{parentLabel || parent.name || (parent as any).label || `#${parentId}`}
              </Box>
            ) : null}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>取消</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
          提交
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default DictDataFormDialog;
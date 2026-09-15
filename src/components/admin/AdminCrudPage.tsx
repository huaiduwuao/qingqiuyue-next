'use client';

import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import AddIcon from '@mui/icons-material/Add';
import type { GridColDef } from '@mui/x-data-grid';
import { DataGridTable } from '@/components/tables/DataGridTable';
import type { FilterField } from '@/components/tables/FilterBar';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { useAuthority } from '@/contexts/AuthContext';
import { formatApiError } from '@/lib/api/client';

/**
 * 后台「列表 + 新建/编辑弹窗 + 删除」页的公共实现。
 *
 * 十几个后台页原来各自复制同一份模板(snackbar、三个 mutation、弹窗、表单状态),
 * 页面之间只差标题、接口模块、列和表单字段。这里收成一个组件,页面只写配置。
 * 写操作成功后刷新列表(原模板 invalidate 的 queryKey 没有任何查询在用,列表从不刷新)。
 */

export interface CrudFormField {
  key: string;
  label: string;
  /** text(默认)/ multiline / number(提交转数字,空为 0)/ select / datetime(Unix 秒,空为 0) */
  type?: 'text' | 'multiline' | 'number' | 'select' | 'datetime';
  options?: { label: string; value: string | number }[];
  required?: boolean;
  placeholder?: string;
  helperText?: string;
  /** 新建时的初始值 */
  defaultValue?: string;
}

type Row = Record<string, any>;

/** 接口模块:@/apis/* 里的 page/save/update/remove 四件套 */
export interface CrudApi {
  page: (params: any) => Promise<any>;
  save: (body: any) => Promise<unknown>;
  update: (body: any) => Promise<unknown>;
  remove: (ids: number[]) => Promise<unknown>;
}

interface AdminCrudPageProps {
  /** 页头标题;不传则不渲染(页面自带标题时) */
  title?: string;
  /** 实体名,用于弹窗标题「新建{entity}」「编辑{entity}」 */
  entity: string;
  api: CrudApi;
  /** 数据列;「最后更新时间」和操作列由组件追加 */
  columns: GridColDef[];
  fields: CrudFormField[];
  filters?: FilterField[];
  /** 提交前的业务校验,返回错误文案则中止 */
  validate?: (body: Row) => string | undefined;
  permissions?: { create?: string; update?: string; delete?: string };
  labels?: { add?: string; create?: string; edit?: string; deleteConfirm?: string };
}

const pad = (n: number) => String(n).padStart(2, '0');
const dateTimeFormat = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
});

/** 表格里的时间列:ISO 字符串或毫秒时间戳 → 本地时间,空值显示 '-' */
export function formatDateTime(value: unknown): string {
  if (!value) return '-';
  const d = new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? String(value) : dateTimeFormat.format(d);
}

/** Unix 秒 → 本地时间;0/空显示 empty */
export function formatUnixSeconds(sec: unknown, empty = '不限'): string {
  return sec ? formatDateTime(Number(sec) * 1000) : empty;
}

function toLocalInput(sec: unknown): string {
  if (!sec) return '';
  const d = new Date(Number(sec) * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function initialValues(fields: CrudFormField[], record: Row): Record<string, string> {
  const values: Record<string, string> = {};
  for (const f of fields) {
    const raw = record[f.key];
    if (f.type === 'datetime') values[f.key] = toLocalInput(raw);
    else if (raw === undefined || raw === null || (f.type === 'number' && !raw)) values[f.key] = record.id ? '' : (f.defaultValue ?? '');
    else values[f.key] = String(raw);
  }
  return values;
}

function toBody(fields: CrudFormField[], values: Record<string, string>): Row {
  const body: Row = {};
  for (const f of fields) {
    const v = values[f.key] ?? '';
    switch (f.type) {
      case 'number':
        body[f.key] = Number(v) || 0;
        break;
      case 'datetime':
        body[f.key] = v ? Math.floor(new Date(v).getTime() / 1000) : 0;
        break;
      case 'select':
        body[f.key] = f.options?.find((o) => String(o.value) === v)?.value ?? v;
        break;
      default:
        body[f.key] = v.trim();
    }
  }
  return body;
}

const updateTimeColumn: GridColDef = {
  field: 'updateTime',
  headerName: '最后更新时间',
  width: 180,
  valueFormatter: (value) => formatDateTime(value),
};

export function AdminCrudPage({ title, entity, api, columns, fields, filters, validate, permissions, labels }: AdminCrudPageProps) {
  const { can } = useAuthority();
  const [editing, setEditing] = useState<Row | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [reload, setReload] = useState(0);
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const notify = (message: string, severity: 'success' | 'error' = 'success') => setToast({ message, severity });
  const onWritten = (message: string) => {
    notify(message);
    setEditing(null);
    setReload((n) => n + 1);
  };
  const onError = (err: unknown) => notify(formatApiError(err), 'error');

  const saveMutation = useMutation({
    mutationFn: (body: Row) => (body.id ? api.update(body) : api.save(body)),
    onSuccess: (_data, body) => onWritten(body.id ? '更新成功' : '创建成功'),
    onError,
  });
  const removeMutation = useMutation({
    mutationFn: (ids: number[]) => api.remove(ids),
    onSuccess: () => onWritten('删除成功'),
    onError,
  });

  const openEditor = (record: Row) => {
    setEditing(record);
    setValues(initialValues(fields, record));
  };

  const handleDelete = (record: Row) => {
    if (record.id && confirm(labels?.deleteConfirm ?? '确定删除吗？')) removeMutation.mutate([record.id]);
  };

  const handleSubmit = () => {
    const missing = fields.find((f) => f.required && !(values[f.key] ?? '').trim());
    if (missing) return notify(`${missing.label}不能为空`, 'error');
    const body = toBody(fields, values);
    const invalid = validate?.(body);
    if (invalid) return notify(invalid, 'error');
    saveMutation.mutate(editing?.id ? { ...body, id: editing.id } : body);
  };

  const busy = saveMutation.isPending;
  const addButton = (
    <Button variant="contained" startIcon={<AddIcon />} onClick={() => openEditor({})}>
      {labels?.add ?? '新建'}
    </Button>
  );

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 } }}>
      {title && <Typography variant="h5" sx={{ mb: 2 }}>{title}</Typography>}
      <DataGridTable
        columns={[...columns, updateTimeColumn]}
        fetchData={(params) => api.page(params)}
        extraParams={{ reload }}
        onEdit={openEditor}
        onDelete={handleDelete}
        actionPermissions={permissions && { edit: permissions.update, delete: permissions.delete }}
        hasPermission={can}
        filters={filters && {
          fields: filters,
          values: filterValues,
          onChange: setFilterValues,
          onReset: () => setFilterValues({}),
        }}
        toolBarRender={() => (permissions?.create ? <PermissionGuard need={permissions.create}>{addButton}</PermissionGuard> : addButton)}
      />

      <Dialog open={editing !== null} onClose={() => !busy && setEditing(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing?.id ? (labels?.edit ?? `编辑${entity}`) : (labels?.create ?? `新建${entity}`)}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            {fields.map((f) => (
              <TextField
                key={f.key}
                label={f.label}
                value={values[f.key] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                required={f.required}
                placeholder={f.placeholder}
                helperText={f.helperText}
                select={f.type === 'select'}
                multiline={f.type === 'multiline'}
                rows={f.type === 'multiline' ? 3 : undefined}
                type={f.type === 'number' ? 'number' : f.type === 'datetime' ? 'datetime-local' : undefined}
                slotProps={f.type === 'datetime' ? { inputLabel: { shrink: true } } : undefined}
                fullWidth
              >
                {f.options?.map((o) => <MenuItem key={String(o.value)} value={String(o.value)}>{o.label}</MenuItem>)}
              </TextField>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)} disabled={busy}>取消</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={busy}>提交</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={toast !== null} autoHideDuration={3000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        {toast ? <Alert severity={toast.severity} sx={{ width: '100%' }}>{toast.message}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}

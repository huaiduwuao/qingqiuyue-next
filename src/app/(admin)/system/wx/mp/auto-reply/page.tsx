'use client';

import type { GridColDef } from '@mui/x-data-grid';
import { AdminCrudPage, type CrudFormField } from '@/components/admin/AdminCrudPage';
import * as api from '@/apis/wx-mp-auto-reply';

const columns: GridColDef[] = [
  { field: 'reqType', headerName: '请求消息类型', width: 150 },
  { field: 'repType', headerName: '回复消息类型', width: 150 },
];

const fields: CrudFormField[] = [
  { key: 'reqType', label: '请求消息类型' },
  { key: 'repType', label: '回复消息类型' },
];

export default function WxMpAutoReplyPage() {
  return <AdminCrudPage title="自动回复" entity="自动回复" api={api} columns={columns} fields={fields} />;
}

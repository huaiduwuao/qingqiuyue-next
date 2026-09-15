'use client';

import type { GridColDef } from '@mui/x-data-grid';
import { AdminCrudPage, formatDateTime, type CrudFormField } from '@/components/admin/AdminCrudPage';
import * as api from '@/apis/wx-mp-msg';

const columns: GridColDef[] = [
  { field: 'repType', headerName: '消息类型', width: 120 },
  { field: 'wxUserId', headerName: '用户', width: 150 },
  { field: 'repEvent', headerName: '类型', width: 100 },
  { field: 'createTime', headerName: '时间', width: 180, valueFormatter: (value) => formatDateTime(value) },
  { field: 'readFlag', headerName: '是否已读', width: 100, renderCell: (params) => (params.value ? '已读' : '未读') },
];

const fields: CrudFormField[] = [
  { key: 'repType', label: '消息类型' },
  { key: 'wxUserId', label: '用户' },
  { key: 'repEvent', label: '类型' },
];

export default function WxMpMsgPage() {
  return <AdminCrudPage title="微信消息" entity="消息" api={api} columns={columns} fields={fields} />;
}

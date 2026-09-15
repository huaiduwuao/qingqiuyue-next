'use client';

import type { GridColDef } from '@mui/x-data-grid';
import { AdminCrudPage, type CrudFormField } from '@/components/admin/AdminCrudPage';
import type { FilterField } from '@/components/tables/FilterBar';
import * as api from '@/apis/system-app';

const columns: GridColDef[] = [
  { field: 'name', headerName: '应用名', width: 150 },
  { field: 'appId', headerName: 'AppId', width: 200 },
  { field: 'appSecret', headerName: 'AppSecret', width: 200 },
];

const fields: CrudFormField[] = [
  { key: 'name', label: '应用名' },
  { key: 'appId', label: 'AppId' },
  { key: 'appSecret', label: 'AppSecret' },
];

const filters: FilterField[] = [
  { key: 'name', label: '名称', type: 'text' },
  { key: 'status', label: '状态', type: 'select', options: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] },
];

export default function SystemAppPage() {
  return <AdminCrudPage title="应用管理" entity="应用" api={api} columns={columns} fields={fields} filters={filters} />;
}

'use client';

import type { GridColDef } from '@mui/x-data-grid';
import { AdminCrudPage, type CrudFormField } from '@/components/admin/AdminCrudPage';
import type { FilterField } from '@/components/tables/FilterBar';
import * as api from '@/apis/system-app-config';

const columns: GridColDef[] = [
  { field: 'name', headerName: '名称', width: 150 },
  { field: 'appId', headerName: '应用ID', width: 150 },
  { field: 'configKey', headerName: '配置Key', width: 150 },
  { field: 'configValue', headerName: '配置值', width: 200 },
];

const fields: CrudFormField[] = [
  { key: 'name', label: '名称' },
  { key: 'appId', label: '应用ID' },
  { key: 'configKey', label: '配置Key' },
  { key: 'configValue', label: '配置值', type: 'multiline' },
];

const filters: FilterField[] = [
  { key: 'name', label: '名称', type: 'text' },
  { key: 'code', label: '代码', type: 'text' },
];

export default function SystemAppConfigPage() {
  return <AdminCrudPage title="应用配置" entity="配置" api={api} columns={columns} fields={fields} filters={filters} />;
}

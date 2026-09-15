'use client';

import type { GridColDef } from '@mui/x-data-grid';
import { AdminCrudPage, type CrudFormField } from '@/components/admin/AdminCrudPage';
import type { FilterField } from '@/components/tables/FilterBar';
import * as api from '@/apis/system-resource';

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

/** 接口资源:字段与 resource 表一致(name / url / method / serviceId / pid)。 */
const columns: GridColDef[] = [
  { field: 'id', headerName: 'ID', width: 80 },
  { field: 'name', headerName: '名称', width: 160 },
  { field: 'method', headerName: '方法', width: 90 },
  { field: 'url', headerName: 'URL', flex: 1, minWidth: 240 },
  { field: 'serviceId', headerName: '服务ID', width: 100 },
  { field: 'pid', headerName: '父级ID', width: 100 },
];

const fields: CrudFormField[] = [
  { key: 'name', label: '名称', required: true },
  { key: 'url', label: 'URL', required: true, placeholder: '/api/core/xxx' },
  { key: 'method', label: '方法', type: 'select', options: METHODS.map((m) => ({ label: m, value: m })), defaultValue: 'GET' },
  { key: 'serviceId', label: '服务ID', type: 'number' },
  { key: 'pid', label: '父级ID', type: 'number' },
];

const filters: FilterField[] = [
  { key: 'serviceId', label: '服务ID', type: 'text' },
  { key: 'pid', label: '父级ID', type: 'text' },
];

export default function SystemResourcePage() {
  return <AdminCrudPage title="资源管理" entity="资源" api={api} columns={columns} fields={fields} filters={filters} />;
}

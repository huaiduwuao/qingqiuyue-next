'use client';

import type { GridColDef } from '@mui/x-data-grid';
import { AdminCrudPage, type CrudFormField } from '@/components/admin/AdminCrudPage';
import type { FilterField } from '@/components/tables/FilterBar';
import * as api from '@/apis/system-permission';
import { PERMISSIONS } from '@/lib/permissions';

const columns: GridColDef[] = [
  { field: 'name', headerName: '名称', width: 150 },
  { field: 'code', headerName: '代码', width: 150 },
  { field: 'info', headerName: '描述', width: 200 },
  { field: 'resources', headerName: '资源数', width: 100 },
];

const fields: CrudFormField[] = [
  { key: 'name', label: '名称' },
  { key: 'code', label: '代码' },
  { key: 'info', label: '描述', type: 'multiline' },
];

const filters: FilterField[] = [
  { key: 'name', label: '名称', type: 'text' },
  { key: 'code', label: '代码', type: 'text' },
];

const permissions = {
  create: PERMISSIONS.SYSTEM_PERMISSION.CREATE,
  update: PERMISSIONS.SYSTEM_PERMISSION.UPDATE,
  delete: PERMISSIONS.SYSTEM_PERMISSION.DELETE,
};

export default function SystemPermissionPage() {
  return <AdminCrudPage entity="权限" api={api} columns={columns} fields={fields} filters={filters} permissions={permissions} />;
}

'use client';

import type { GridColDef } from '@mui/x-data-grid';
import { AdminCrudPage, type CrudFormField } from '@/components/admin/AdminCrudPage';
import type { FilterField } from '@/components/tables/FilterBar';
import * as api from '@/apis/system-app-service';

const columns: GridColDef[] = [
  { field: 'name', headerName: '名称', width: 150 },
  { field: 'serviceKey', headerName: '服务Key', width: 150 },
  { field: 'serviceType', headerName: '服务类型', width: 120 },
];

const fields: CrudFormField[] = [
  { key: 'name', label: '名称' },
  { key: 'serviceKey', label: '服务Key' },
  { key: 'serviceType', label: '服务类型' },
];

const filters: FilterField[] = [
  { key: 'name', label: '名称', type: 'text' },
  { key: 'code', label: '代码', type: 'text' },
];

export default function SystemAppServicePage() {
  return <AdminCrudPage title="应用服务" entity="服务" api={api} columns={columns} fields={fields} filters={filters} />;
}

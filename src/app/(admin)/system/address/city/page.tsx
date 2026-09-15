'use client';

import type { GridColDef } from '@mui/x-data-grid';
import { AdminCrudPage, type CrudFormField } from '@/components/admin/AdminCrudPage';
import type { FilterField } from '@/components/tables/FilterBar';
import * as api from '@/apis/system-city';

const columns: GridColDef[] = [
  { field: 'name', headerName: '名称', width: 150 },
  { field: 'code', headerName: '地区编码', width: 150 },
  { field: 'provinceId', headerName: '省份ID', width: 100 },
];

const fields: CrudFormField[] = [
  { key: 'name', label: '名称' },
  { key: 'code', label: '地区编码' },
];

const filters: FilterField[] = [{ key: 'name', label: '名称', type: 'text' }];

export default function SystemAddressCityPage() {
  return <AdminCrudPage title="城市管理" entity="城市" api={api} columns={columns} fields={fields} filters={filters} />;
}

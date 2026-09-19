'use client';

import type { GridColDef } from '@mui/x-data-grid';
import { AdminCrudPage, type CrudFormField } from '@/components/admin/AdminCrudPage';
import type { FilterField } from '@/components/tables/FilterBar';
import * as api from '@/apis/system-area';

const columns: GridColDef[] = [
  { field: 'name', headerName: '名称', width: 150 },
  { field: 'code', headerName: '地区编码', width: 150 },
  { field: 'cityCode', headerName: '城市编码', width: 120 },
];

const fields: CrudFormField[] = [
  { key: 'name', label: '名称', required: true },
  { key: 'code', label: '地区编码', required: true },
  { key: 'cityCode', label: '所属城市编码', required: true, placeholder: '如 110100' },
];

const filters: FilterField[] = [{ key: 'name', label: '名称', type: 'text' }];

export default function SystemAddressAreaPage() {
  return <AdminCrudPage title="区县管理" entity="区县" api={api} columns={columns} fields={fields} filters={filters} />;
}

'use client';

import type { GridColDef } from '@mui/x-data-grid';
import { AdminCrudPage, type CrudFormField } from '@/components/admin/AdminCrudPage';
import type { FilterField } from '@/components/tables/FilterBar';
import * as api from '@/apis/system-dict-type';

const columns: GridColDef[] = [
  { field: 'name', headerName: '名称', width: 150 },
  { field: 'type', headerName: '类型', width: 150 },
];

const fields: CrudFormField[] = [
  { key: 'name', label: '名称' },
  { key: 'type', label: '类型' },
];

const filters: FilterField[] = [
  { key: 'name', label: '名称', type: 'text' },
  { key: 'type', label: '类型', type: 'text' },
  { key: 'status', label: '状态', type: 'select', options: [{ label: '启用', value: 1 }, { label: '禁用', value: 0 }] },
];

export default function SystemDictTypePage() {
  return <AdminCrudPage title="字典类型" entity="字典类型" api={api} columns={columns} fields={fields} filters={filters} />;
}

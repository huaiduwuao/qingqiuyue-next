'use client';

import type { GridColDef } from '@mui/x-data-grid';
import { AdminCrudPage, type CrudFormField } from '@/components/admin/AdminCrudPage';
import type { FilterField } from '@/components/tables/FilterBar';
import * as api from '@/apis/system-website-dict';

/** 字段与 sys_website_dict 表一致:网站名 + 类型 + 关联的字典类型/字典项 ID。 */
const columns: GridColDef[] = [
  { field: 'id', headerName: 'ID', width: 80 },
  { field: 'sitename', headerName: '网站名称', width: 180 },
  { field: 'type', headerName: '类型', width: 130 },
  { field: 'dictTypeId', headerName: '字典类型ID', width: 120 },
  { field: 'dictDataId', headerName: '字典项ID', width: 120 },
];

const fields: CrudFormField[] = [
  { key: 'sitename', label: '网站名称', required: true },
  { key: 'type', label: '类型' },
  { key: 'dictTypeId', label: '字典类型ID', type: 'number' },
  { key: 'dictDataId', label: '字典项ID', type: 'number' },
];

const filters: FilterField[] = [
  { key: 'sitename', label: '网站名称', type: 'text' },
  { key: 'type', label: '类型', type: 'text' },
];

export default function SystemWebsiteDictPage() {
  return <AdminCrudPage title="网站字典" entity="网站字典" api={api} columns={columns} fields={fields} filters={filters} />;
}

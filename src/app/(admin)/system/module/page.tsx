'use client';

import Link from 'next/link';
import type { GridColDef } from '@mui/x-data-grid';
import { AdminCrudPage, type CrudFormField } from '@/components/admin/AdminCrudPage';
import type { FilterField } from '@/components/tables/FilterBar';
import * as api from '@/apis/system-module-list';

// 频道(module)管理:标题 / 封面 / 排序。频道是站点频道,一律公开 —— 不再有口令 / 付费;
// 付费合集是用户自己的合集(创作者中心 → 合集),见 internal/mylistpay。

const columns: GridColDef[] = [
  { field: 'id', headerName: 'ID', width: 80 },
  { field: 'title', headerName: '标题', width: 160 },
  { field: 'subtitle', headerName: '副标题', width: 160 },
  { field: 'type', headerName: '类型', width: 100 },
  { field: 'sort', headerName: '排序', width: 80 },
  {
    field: 'shareLink',
    headerName: '频道页',
    width: 100,
    sortable: false,
    renderCell: (params) => (
      <Link href={`/share/module-detail?moduleId=${params.row.id}`} target="_blank">打开</Link>
    ),
  },
];

const fields: CrudFormField[] = [
  { key: 'title', label: '标题', required: true },
  { key: 'subtitle', label: '副标题' },
  { key: 'icon', label: '图标' },
  { key: 'cover', label: '封面地址' },
  { key: 'type', label: '类型', placeholder: 'article / video / audio / image / document' },
  { key: 'sort', label: '排序', type: 'number' },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    defaultValue: '1',
    options: [{ label: '启用', value: 1 }, { label: '停用', value: 0 }],
  },
];

const filters: FilterField[] = [
  { key: 'title', label: '标题', type: 'text' },
];

type Row = Record<string, unknown>;

/** 频道一律公开:保存时固定 copy、清空 share_content(历史口令一并抹掉,后端也会这样规范化) */
function toSubmit(body: Row): Row {
  return { ...body, shareType: 'copy', shareContent: '' };
}

export default function SystemModulePage() {
  return (
    <AdminCrudPage
      title="频道管理"
      entity="频道"
      api={api}
      columns={columns}
      fields={fields}
      filters={filters}
      toSubmit={toSubmit}
    />
  );
}

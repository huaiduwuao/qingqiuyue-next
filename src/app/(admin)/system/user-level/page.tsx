'use client';

import type { GridColDef } from '@mui/x-data-grid';
import { AdminCrudPage, formatUnixSeconds, type CrudFormField } from '@/components/admin/AdminCrudPage';
import type { FilterField } from '@/components/tables/FilterBar';
import * as api from '@/apis/system-user-level';

/** user_level 一行 = 授予某个用户的一个等级;start/end 是有效期(Unix 秒,0 = 不限)。 */
const columns: GridColDef[] = [
  { field: 'id', headerName: 'ID', width: 80 },
  { field: 'userId', headerName: '用户ID', width: 110 },
  { field: 'name', headerName: '等级名称', width: 150 },
  { field: 'level', headerName: '等级', width: 80 },
  { field: 'type', headerName: '类型', width: 110 },
  { field: 'start', headerName: '生效时间', width: 170, valueFormatter: (value) => formatUnixSeconds(value) },
  { field: 'end', headerName: '到期时间', width: 170, valueFormatter: (value) => formatUnixSeconds(value) },
];

const fields: CrudFormField[] = [
  { key: 'userId', label: '用户ID', type: 'number', required: true },
  { key: 'level', label: '等级', type: 'number', required: true },
  { key: 'name', label: '等级名称', placeholder: '如 VIP1、黄金会员' },
  { key: 'type', label: '类型', placeholder: '如 vip' },
  { key: 'start', label: '生效时间', type: 'datetime', helperText: '留空表示立即生效' },
  { key: 'end', label: '到期时间', type: 'datetime', helperText: '留空表示长期有效' },
];

const filters: FilterField[] = [
  { key: 'userId', label: '用户ID', type: 'text' },
  { key: 'name', label: '等级名称', type: 'text' },
];

const validate = (body: Record<string, any>) => {
  if (!Number.isInteger(body.userId) || body.userId <= 0) return '请填写正确的用户 ID';
  if (!Number.isInteger(body.level) || body.level <= 0) return '等级需为正整数';
  if (body.end && body.end < body.start) return '到期时间不能早于生效时间';
  return undefined;
};

export default function SystemUserLevelPage() {
  return (
    <AdminCrudPage
      title="用户等级"
      entity="用户等级"
      api={api}
      columns={columns}
      fields={fields}
      filters={filters}
      validate={validate}
      labels={{ add: '授予等级', create: '授予用户等级', deleteConfirm: '确定收回该用户的这个等级吗？' }}
    />
  );
}

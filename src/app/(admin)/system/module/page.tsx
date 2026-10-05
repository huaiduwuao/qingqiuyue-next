'use client';

import Link from 'next/link';
import type { GridColDef } from '@mui/x-data-grid';
import { AdminCrudPage, type CrudFormField } from '@/components/admin/AdminCrudPage';
import type { FilterField } from '@/components/tables/FilterBar';
import * as api from '@/apis/system-module-list';
import { MODULE_MAX_PRICE, modulePrice } from './share';

// 合集(module)管理:标题 / 封面 / 分享方式。分享方式为「付费」时填钻石价,
// 「口令」时填口令;后端 moduleshare.NormalizeShare 会再校验一遍并统一存成 {"price":N}。

const SHARE_LABELS: Record<string, string> = { copy: '公开', password: '口令', pay: '付费' };

const columns: GridColDef[] = [
  { field: 'id', headerName: 'ID', width: 80 },
  { field: 'title', headerName: '标题', width: 160 },
  { field: 'type', headerName: '类型', width: 100 },
  {
    field: 'shareType',
    headerName: '分享方式',
    width: 100,
    valueFormatter: (value) => SHARE_LABELS[String(value ?? '')] ?? (value ? String(value) : '公开'),
  },
  {
    field: 'price',
    headerName: '价格',
    width: 100,
    valueGetter: (_value, row) => (row.shareType === 'pay' ? modulePrice(row.shareContent) : null),
    valueFormatter: (value) => (value ? `${value} 钻` : '-'),
  },
  {
    field: 'shareLink',
    headerName: '分享页',
    width: 100,
    sortable: false,
    renderCell: (params) => (
      <Link href={`/share/module-detail?moduleId=${params.row.id}`} target="_blank">打开</Link>
    ),
  },
];

const isPay = (v: Record<string, string>) => v.shareType === 'pay';
const isPassword = (v: Record<string, string>) => v.shareType === 'password';

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
  {
    key: 'shareType',
    label: '分享方式',
    type: 'select',
    defaultValue: 'copy',
    options: [
      { label: '公开', value: 'copy' },
      { label: '口令', value: 'password' },
      { label: '付费', value: 'pay' },
    ],
    helperText: '口令 / 付费合集里的全部内容(包括站内频道里属于这个合集的内容)都要解锁后才能看',
  },
  {
    key: 'sharePassword',
    label: '分享口令',
    required: true,
    hidden: (v) => !isPassword(v),
    helperText: '最多 32 个字符;改口令后,已输入旧口令的访客需要重新输入',
  },
  {
    key: 'sharePrice',
    label: '价格(钻)',
    type: 'number',
    required: true,
    hidden: (v) => !isPay(v),
    helperText: `1 ~ ${MODULE_MAX_PRICE} 的整数,1 钻 = ¥0.1;买家一次解锁,永久可看`,
  },
];

const filters: FilterField[] = [
  { key: 'title', label: '标题', type: 'text' },
];

type Row = Record<string, unknown>;

/** 存储格式 → 表单:share_content 按分享方式拆成口令 / 价格两个字段 */
function toForm(record: Row): Row {
  const shareType = String(record.shareType || 'copy');
  const shareContent = typeof record.shareContent === 'string' ? record.shareContent : '';
  return {
    ...record,
    shareType,
    sharePassword: shareType === 'password' ? shareContent : '',
    sharePrice: shareType === 'pay' ? modulePrice(shareContent) || '' : '',
  };
}

function validate(body: Row): string | undefined {
  if (body.shareType === 'pay') {
    const p = Number(body.sharePrice);
    if (!Number.isInteger(p) || p < 1 || p > MODULE_MAX_PRICE) return `价格需为 1 ~ ${MODULE_MAX_PRICE} 之间的整数(钻)`;
  }
  if (body.shareType === 'password' && String(body.sharePassword ?? '').length > 32) return '分享口令不能超过 32 个字符';
  return undefined;
}

/** 表单 → 接口:口令原样存,价格存整数钻(后端规范化成 {"price":N}) */
function toSubmit(body: Row): Row {
  const { sharePassword, sharePrice, ...rest } = body;
  let shareContent = '';
  if (body.shareType === 'password') shareContent = String(sharePassword ?? '');
  if (body.shareType === 'pay') shareContent = String(sharePrice ?? '');
  return { ...rest, shareContent };
}

export default function SystemModulePage() {
  return (
    <AdminCrudPage
      title="合集管理"
      entity="合集"
      api={api}
      columns={columns}
      fields={fields}
      filters={filters}
      validate={validate}
      toForm={toForm}
      toSubmit={toSubmit}
    />
  );
}

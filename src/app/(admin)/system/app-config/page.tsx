'use client';

import type { GridColDef } from '@mui/x-data-grid';
import { AdminCrudPage, type CrudFormField } from '@/components/admin/AdminCrudPage';
import type { FilterField } from '@/components/tables/FilterBar';
import * as api from '@/apis/system-app-config';

// 列/表单字段与后端 AppConfigReq(sys.go) 对齐:type/code/content/name。
// 等级阈值、连续签到奖励等成长配置就存在 content 列(JSON),此前误用 appId/configKey/configValue
// 导致整页空白、看不到等级详情。
const columns: GridColDef[] = [
  { field: 'name', headerName: '名称', width: 240 },
  { field: 'type', headerName: '类型', width: 110 },
  { field: 'code', headerName: '代码', width: 180 },
  { field: 'content', headerName: '配置值', flex: 1, minWidth: 320 },
];

const fields: CrudFormField[] = [
  { key: 'name', label: '名称', required: true },
  { key: 'type', label: '类型', required: true, placeholder: '如 growth' },
  { key: 'code', label: '代码', required: true, placeholder: '如 user_levels' },
  { key: 'content', label: '配置值', type: 'multiline', placeholder: 'JSON 或纯文本' },
];

const filters: FilterField[] = [
  { key: 'name', label: '名称', type: 'text' },
  { key: 'code', label: '代码', type: 'text' },
];

export default function SystemAppConfigPage() {
  return <AdminCrudPage title="应用配置" entity="配置" api={api} columns={columns} fields={fields} filters={filters} />;
}

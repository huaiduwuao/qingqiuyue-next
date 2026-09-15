'use client';

import type { GridColDef } from '@mui/x-data-grid';
import { AdminCrudPage, formatDateTime, type CrudFormField } from '@/components/admin/AdminCrudPage';
import * as api from '@/apis/wx-mp-user';

const SEX_MAP: Record<string, string> = { '0': '未知', '1': '男', '2': '女' };

const columns: GridColDef[] = [
  {
    field: 'headimgUrl',
    headerName: '头像',
    width: 80,
    renderCell: (params) => (params.value ? <img src={params.value} alt="avatar" style={{ width: 40, height: 40, borderRadius: '50%' }} /> : null),
  },
  { field: 'nickName', headerName: '昵称', width: 150 },
  { field: 'subscribe', headerName: '是否订阅', width: 100 },
  { field: 'openId', headerName: 'OpenID', width: 200 },
  { field: 'subscribeScene', headerName: '关注渠道', width: 120 },
  { field: 'subscribeTime', headerName: '关注时间', width: 180, valueFormatter: (value) => formatDateTime(value) },
  { field: 'sex', headerName: '性别', width: 60, renderCell: (params) => SEX_MAP[params.value] || params.value },
  { field: 'country', headerName: '国家', width: 100 },
  { field: 'province', headerName: '省份', width: 100 },
  { field: 'city', headerName: '城市', width: 100 },
  { field: 'tagidList', headerName: '标签', width: 100 },
  { field: 'remark', headerName: '备注', width: 150 },
  { field: 'qrSceneStr', headerName: '扫码场景', width: 150 },
  { field: 'subscribeNum', headerName: '关注次数', width: 100 },
];

const fields: CrudFormField[] = [
  { key: 'nickName', label: '昵称' },
  { key: 'remark', label: '备注' },
];

export default function WxMpUserPage() {
  return <AdminCrudPage title="微信用户" entity="用户" api={api} columns={columns} fields={fields} />;
}

'use client';

import type { GridColDef } from '@mui/x-data-grid';
import { AdminCrudPage, type CrudFormField } from '@/components/admin/AdminCrudPage';
import { WxMpStatusBar } from '@/components/admin/WxMpStatusBar';
import * as api from '@/apis/wx-mp-auto-reply';

/**
 * 公众号自动回复。取值与后端 internal/wxmp/callback.go 的约定一致:
 *   type     subscribe 关注时 / keyword 关键词 / default 什么都没命中时
 *   repMate  exact 全匹配 / contains 包含即命中(只对关键词有意义)
 *   repType  text 文本(repContent)/ news 图文(repName、repDesc、repThumbUrl、repUrl)
 * 关键词没命中时,后端会先拿用户的话去站内按标题搜,搜不到才用「默认回复」。
 */
const TYPE_LABEL: Record<string, string> = { subscribe: '关注时回复', keyword: '关键词回复', default: '默认回复', '1': '关注时回复', '3': '关键词回复', '2': '默认回复' };
const MATE_LABEL: Record<string, string> = { exact: '全匹配', contains: '包含', '1': '全匹配', '2': '包含' };

const columns: GridColDef[] = [
  { field: 'type', headerName: '触发方式', width: 130, valueFormatter: (v) => TYPE_LABEL[String(v)] ?? v },
  { field: 'reqKey', headerName: '关键词', width: 160 },
  { field: 'repMate', headerName: '匹配', width: 90, valueFormatter: (v) => MATE_LABEL[String(v)] ?? v },
  { field: 'repType', headerName: '回复类型', width: 100, valueFormatter: (v) => (v === 'news' ? '图文' : '文本') },
  { field: 'repContent', headerName: '回复内容', flex: 1, minWidth: 240, valueGetter: (_v, row) => row.repContent || row.repName || '' },
  { field: 'sort', headerName: '优先级', width: 90 },
];

const fields: CrudFormField[] = [
  {
    key: 'type', label: '触发方式', type: 'select', required: true, defaultValue: 'keyword',
    options: [{ label: '关注时回复', value: 'subscribe' }, { label: '关键词回复', value: 'keyword' }, { label: '默认回复(什么都没命中时)', value: 'default' }],
  },
  { key: 'reqKey', label: '关键词', helperText: '只有「关键词回复」需要填' },
  { key: 'repMate', label: '匹配方式', type: 'select', defaultValue: 'exact', options: [{ label: '全匹配', value: 'exact' }, { label: '包含即命中', value: 'contains' }] },
  { key: 'repType', label: '回复类型', type: 'select', required: true, defaultValue: 'text', options: [{ label: '文本', value: 'text' }, { label: '图文(一条链接卡片)', value: 'news' }] },
  { key: 'repContent', label: '回复文字', type: 'multiline', helperText: '回复类型为「文本」时使用' },
  { key: 'repName', label: '图文标题', helperText: '以下四项在回复类型为「图文」时使用' },
  { key: 'repDesc', label: '图文摘要' },
  { key: 'repThumbUrl', label: '图文封面图地址' },
  { key: 'repUrl', label: '图文跳转链接' },
  { key: 'sort', label: '优先级', type: 'number', helperText: '数字小的先匹配', defaultValue: '0' },
];

const validate = (b: Record<string, any>) => {
  if (b.type === 'keyword' && !String(b.reqKey ?? '').trim()) return '关键词回复需要填写关键词';
  if (b.repType === 'news' ? !String(b.repUrl ?? '').trim() || !String(b.repName ?? '').trim() : !String(b.repContent ?? '').trim()) {
    return b.repType === 'news' ? '图文回复需要标题和跳转链接' : '请填写回复文字';
  }
  return undefined;
};

export default function WxMpAutoReplyPage() {
  return (
    <>
      <WxMpStatusBar />
      <AdminCrudPage title="自动回复" entity="自动回复" api={api} columns={columns} fields={fields} validate={validate} />
    </>
  );
}

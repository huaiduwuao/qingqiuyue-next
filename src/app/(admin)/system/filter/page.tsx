'use client';

/**
 * 筛选条件维护
 * 两个 tab: 内容类型大类(module_content_type) + 题材子分类(module_subcategory)。
 * 数据走 content-api /api/content/dict/*,与 C 端筛选面板同一套字典。
 * 演员/歌手等海量动态数据不在此维护 —— 从内容 metadata 自动聚合(见 /dict/facets)。
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import { DataGridTable } from '@/components/tables/DataGridTable';
import {
  pageContentTypes, saveContentType, removeContentTypes,
  pageSubcategories, saveSubcategory, removeSubcategories,
  type ContentTypeRow, type SubcategoryRow,
} from '@/apis/system-filter';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import type { GridColDef } from '@mui/x-data-grid';

const TYPE_KEY = ['system', 'filter', 'types'];
const SUBCAT_KEY = ['system', 'filter', 'subcats'];

export default function FilterConfigPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => setSnackbar({ open: true, message, severity });

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
        筛选条件维护
      </Typography>
      <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
        类型大类与题材子分类是 C 端筛选面板(首页 Tab / 搜索页类型下拉)的选项来源,后台可增删改排序。
        演员/歌手/导演等海量动态数据从内容 metadata 自动聚合,无需在此维护。
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="类型大类" />
        <Tab label="题材子分类" />
      </Tabs>

      {tab === 0 ? <TypesTab showMessage={showMessage} invalidateKey={TYPE_KEY} /> : <SubcatsTab showMessage={showMessage} invalidateKey={SUBCAT_KEY} />}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={2500}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

function TypesTab({ showMessage, invalidateKey }: { showMessage: (m: string, s?: 'success' | 'error') => void; invalidateKey: string[] }) {
  const qc = useQueryClient();
  const [writeVisible, setWriteVisible] = useState(false);
  const [form, setForm] = useState<Partial<ContentTypeRow>>({ name: '', code: '', icon: '', color: '', sort: 0, status: 1 });

  const openCreate = () => { setForm({ name: '', code: '', icon: '', color: '', sort: 0, status: 1 }); setWriteVisible(true); };
  const openEdit = (row: any) => { setForm(row); setWriteVisible(true); };
  const invalidate = () => qc.invalidateQueries({ queryKey: invalidateKey });

  const saveMutation = useMutation({
    mutationFn: (vals: Partial<ContentTypeRow>) => saveContentType(vals),
    onSuccess: () => { showMessage('保存成功'); setWriteVisible(false); invalidate(); },
    onError: (err: any) => showMessage(err.message || '保存失败', 'error'),
  });
  const removeMutation = useMutation({
    mutationFn: (ids: number[]) => removeContentTypes(ids),
    onSuccess: () => { showMessage('删除成功'); invalidate(); },
    onError: (err: any) => showMessage(err.message || '删除失败', 'error'),
  });

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 90 },
    { field: 'name', headerName: '名称', width: 120 },
    { field: 'code', headerName: '类型代码', width: 140 },
    { field: 'icon', headerName: '图标', width: 120 },
    { field: 'color', headerName: '颜色', width: 100 },
    { field: 'sort', headerName: '排序', width: 80 },
    { field: 'status', headerName: '状态', width: 80 },
    {
      field: 'actions',
      headerName: '操作',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton size="small" onClick={() => openEdit(params.row)}><EditIcon fontSize="small" /></IconButton>
          <IconButton size="small" color="error" onClick={() => removeMutation.mutate([params.row.id])}><DeleteIcon fontSize="small" /></IconButton>
        </Box>
      ),
    },
  ];

  return (
    <>
      <DataGridTable
        columns={columns}
        fetchData={async (params: any) => {
          const res: any = await pageContentTypes({ page: params.pageNumber ?? 1, pageSize: params.pageSize ?? 20 });
          return { data: { list: res?.data?.list || [], total: res?.data?.total || 0 }, success: true };
        }}
        toolBarRender={() => (
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreate}>新增类型</Button>
        )}
        onEdit={openEdit}
        onDelete={(row: any) => removeMutation.mutate([row.id])}
      />
      <Dialog open={writeVisible} onClose={() => setWriteVisible(false)} fullWidth maxWidth="sm">
        <DialogTitle>{form.id ? '编辑类型' : '新增类型'}</DialogTitle>
        <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="名称(中文)" size="small" value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <TextField label="类型代码(FILM/TELEPLAY...)" size="small" value={form.code || ''} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
          <TextField label="图标名(可选)" size="small" value={form.icon || ''} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} />
          <TextField label="主题色(可选,如 #FE2C55)" size="small" value={form.color || ''} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} />
          <TextField label="排序" type="number" size="small" value={form.sort ?? 0} onChange={(e) => setForm((f) => ({ ...f, sort: Number(e.target.value) }))} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWriteVisible(false)}>取消</Button>
          <Button variant="contained" onClick={() => saveMutation.mutate(form)}>保存</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function SubcatsTab({ showMessage, invalidateKey }: { showMessage: (m: string, s?: 'success' | 'error') => void; invalidateKey: string[] }) {
  const qc = useQueryClient();
  const [writeVisible, setWriteVisible] = useState(false);
  const [form, setForm] = useState<Partial<SubcategoryRow>>({ parentType: '', code: '', name: '', sort: 0, status: 1 });

  const openCreate = () => { setForm({ parentType: '', code: '', name: '', sort: 0, status: 1 }); setWriteVisible(true); };
  const openEdit = (row: any) => { setForm(row); setWriteVisible(true); };
  const invalidate = () => qc.invalidateQueries({ queryKey: invalidateKey });

  const saveMutation = useMutation({
    mutationFn: (vals: Partial<SubcategoryRow>) => saveSubcategory(vals),
    onSuccess: () => { showMessage('保存成功'); setWriteVisible(false); invalidate(); },
    onError: (err: any) => showMessage(err.message || '保存失败', 'error'),
  });
  const removeMutation = useMutation({
    mutationFn: (ids: number[]) => removeSubcategories(ids),
    onSuccess: () => { showMessage('删除成功'); invalidate(); },
    onError: (err: any) => showMessage(err.message || '删除失败', 'error'),
  });

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 90 },
    { field: 'parentType', headerName: '所属类型', width: 130 },
    { field: 'code', headerName: '题材代码', width: 130 },
    { field: 'name', headerName: '题材名', width: 130 },
    { field: 'sort', headerName: '排序', width: 80 },
    {
      field: 'actions',
      headerName: '操作',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton size="small" onClick={() => openEdit(params.row)}><EditIcon fontSize="small" /></IconButton>
          <IconButton size="small" color="error" onClick={() => removeMutation.mutate([params.row.id])}><DeleteIcon fontSize="small" /></IconButton>
        </Box>
      ),
    },
  ];

  return (
    <>
      <DataGridTable
        columns={columns}
        fetchData={async (params: any) => {
          const res: any = await pageSubcategories({ page: params.pageNumber ?? 1, pageSize: params.pageSize ?? 20, parentType: '' });
          return { data: { list: res?.data?.list || [], total: res?.data?.total || 0 }, success: true };
        }}
        toolBarRender={() => (
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreate}>新增题材</Button>
        )}
        onEdit={openEdit}
        onDelete={(row: any) => removeMutation.mutate([row.id])}
      />
      <Dialog open={writeVisible} onClose={() => setWriteVisible(false)} fullWidth maxWidth="sm">
        <DialogTitle>{form.id ? '编辑题材' : '新增题材'}</DialogTitle>
        <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="所属类型(FILM/NOVEL...)" size="small" value={form.parentType || ''} onChange={(e) => setForm((f) => ({ ...f, parentType: e.target.value }))} />
          <TextField label="题材代码(英文,如 scifi)" size="small" value={form.code || ''} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
          <TextField label="题材名(中文,如 科幻)" size="small" value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <TextField label="排序" type="number" size="small" value={form.sort ?? 0} onChange={(e) => setForm((f) => ({ ...f, sort: Number(e.target.value) }))} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWriteVisible(false)}>取消</Button>
          <Button variant="contained" onClick={() => saveMutation.mutate(form)}>保存</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

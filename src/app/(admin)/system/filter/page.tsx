'use client';

/**
 * 筛选条件维护
 * 两个 tab: 内容类型大类(module_content_type) + 题材子分类(module_subcategory)。
 * 数据走 content-api /api/content/dict/*,与 C 端筛选面板同一套字典。
 *
 * 父子联动:类型大类做成可展开的行 —— 点大类行即在该行下方内联展开它名下的题材子分类
 * (复用 /dict/subcategory?parent=XXX),无需切到「题材子分类」tab 翻页找。
 * 「题材子分类」tab 仍是平铺全集,适合跨大类浏览;parentType 改为大类下拉,避免手填出错。
 *
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
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Collapse from '@mui/material/Collapse';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import { DataGridTable } from '@/components/tables/DataGridTable';
import {
  pageContentTypes, saveContentType, removeContentTypes,
  pageSubcategories, saveSubcategory, removeSubcategories,
  listContentTypes, listSubcategoriesByParent,
  type ContentTypeRow, type SubcategoryRow,
} from '@/apis/system-filter';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import type { GridColDef } from '@mui/x-data-grid';

const TYPE_KEY = ['system', 'filter', 'types'];
const SUBCAT_KEY = ['system', 'filter', 'subcats'];

type ShowMessage = (m: string, s?: 'success' | 'error') => void;

export default function FilterConfigPage() {
  const [tab, setTab] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const showMessage: ShowMessage = (message, severity = 'success') => setSnackbar({ open: true, message, severity });

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
        筛选条件维护
      </Typography>
      <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
        类型大类与题材子分类是 C 端筛选面板(首页 Tab / 搜索页类型下拉)的选项来源。
        点类型大类行可展开看它名下的题材子分类;演员/歌手/导演等海量动态数据从内容 metadata 自动聚合,无需在此维护。
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="类型大类" />
        <Tab label="题材子分类" />
      </Tabs>

      {tab === 0 ? <TypesTab showMessage={showMessage} /> : <SubcatsTab showMessage={showMessage} />}

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

/** 类型大类 —— 每行可展开,展开后在该行下方内联列出它名下的题材子分类(父子联动)。 */
function TypesTab({ showMessage }: { showMessage: ShowMessage }) {
  const qc = useQueryClient();
  const [writeVisible, setWriteVisible] = useState(false);
  const [form, setForm] = useState<Partial<ContentTypeRow>>({ name: '', code: '', icon: '', color: '', sort: 0, status: 1 });
  // 展开的大类 code 集合
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const openCreate = () => { setForm({ name: '', code: '', icon: '', color: '', sort: 0, status: 1 }); setWriteVisible(true); };
  const openEdit = (row: ContentTypeRow) => { setForm(row); setWriteVisible(true); };
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: TYPE_KEY });
    qc.invalidateQueries({ queryKey: SUBCAT_KEY });
  };

  const { data: types = [], isLoading } = useQuery({
    queryKey: TYPE_KEY,
    queryFn: () => listContentTypes().then((r: any) => (r?.list ?? []) as ContentTypeRow[]),
  });

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

  const toggle = (code: string) => setExpanded((e) => ({ ...e, [code]: !e[code] }));

  return (
    <>
      <Paper sx={{ width: '100%', p: 2 }}>
        <Box sx={{ mb: 2 }}>
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreate}>新增类型</Button>
        </Box>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width={48} />
              <TableCell>名称</TableCell>
              <TableCell>类型代码</TableCell>
              <TableCell>图标</TableCell>
              <TableCell>排序</TableCell>
              <TableCell>状态</TableCell>
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} align="center"><CircularProgress size={24} /></TableCell></TableRow>
            )}
            {!isLoading && types.length === 0 && (
              <TableRow><TableCell colSpan={7} align="center">暂无数据</TableCell></TableRow>
            )}
            {types.map((row) => (
              <React.Fragment key={row.code}>
                <TableRow hover sx={{ cursor: 'pointer' }} onClick={() => toggle(row.code)}>
                  <TableCell>
                    <IconButton size="small" aria-label="展开子分类">
                      {expanded[row.code] ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                    </IconButton>
                  </TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.code}</TableCell>
                  <TableCell>{row.icon}</TableCell>
                  <TableCell>{row.sort}</TableCell>
                  <TableCell>{row.status === 1 ? '启用' : '停用'}</TableCell>
                  <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                    <IconButton size="small" onClick={() => openEdit(row)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => removeMutation.mutate([row.id])}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
                <SubcatRows parentCode={row.code} open={!!expanded[row.code]} />
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </Paper>

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

/** 某个大类展开后的子分类内联行(父子联动的子级部分)。 */
function SubcatRows({ parentCode, open }: { parentCode: string; open: boolean }) {
  const { data: subs = [], isLoading } = useQuery({
    queryKey: [...SUBCAT_KEY, 'by-parent', parentCode],
    queryFn: () => listSubcategoriesByParent(parentCode).then((r: any) => (r?.list ?? []) as SubcategoryRow[]),
    enabled: open,
  });

  return (
    <TableRow>
      <TableCell colSpan={7} sx={{ py: 0, borderBottom: open ? undefined : 'none' }}>
        <Collapse in={open} timeout="auto" unmountOnExit>
          <Box sx={{ my: 1, ml: 6, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
              「{parentCode}」下的题材子分类
            </Typography>
            {isLoading && <CircularProgress size={18} />}
            {!isLoading && subs.length === 0 && (
              <Typography variant="body2" sx={{ color: 'text.disabled' }}>该大类暂无子分类</Typography>
            )}
            {!isLoading && subs.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {subs.map((s) => (
                  <Chip key={s.id} size="small" label={`${s.name} (${s.code})`} variant="outlined" />
                ))}
              </Box>
            )}
          </Box>
        </Collapse>
      </TableCell>
    </TableRow>
  );
}

/** 题材子分类 —— 平铺全集;parentType 改为大类下拉,顶部可按大类过滤。 */
function SubcatsTab({ showMessage }: { showMessage: ShowMessage }) {
  const qc = useQueryClient();
  const [writeVisible, setWriteVisible] = useState(false);
  const [form, setForm] = useState<Partial<SubcategoryRow>>({ parentType: '', code: '', name: '', sort: 0, status: 1 });
  // 列表过滤用的大类
  const [filterParent, setFilterParent] = useState('');

  const openCreate = () => { setForm({ parentType: '', code: '', name: '', sort: 0, status: 1 }); setWriteVisible(true); };
  const openEdit = (row: any) => { setForm(row); setWriteVisible(true); };
  const invalidate = () => qc.invalidateQueries({ queryKey: SUBCAT_KEY });

  // 大类下拉候选(全集)
  const { data: types = [] } = useQuery({
    queryKey: TYPE_KEY,
    queryFn: () => listContentTypes().then((r: any) => (r?.list ?? []) as ContentTypeRow[]),
  });

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
        extraParams={{ parentType: filterParent || undefined }}
        fetchData={async (params: any) => {
          const res: any = await pageSubcategories({
            page: params.pageNumber ?? 1,
            pageSize: params.pageSize ?? 20,
            parentType: params.parentType ?? '',
          });
          return { list: res?.list || [], total: res?.total || 0 };
        }}
        toolBarRender={() => (
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              select
              size="small"
              label="按大类过滤"
              value={filterParent}
              onChange={(e) => setFilterParent(e.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">全部大类</MenuItem>
              {types.map((t) => (
                <MenuItem key={t.code} value={t.code}>{t.name} ({t.code})</MenuItem>
              ))}
            </TextField>
            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreate}>新增题材</Button>
          </Box>
        )}
        onEdit={openEdit}
        onDelete={(row: any) => removeMutation.mutate([row.id])}
      />
      <Dialog open={writeVisible} onClose={() => setWriteVisible(false)} fullWidth maxWidth="sm">
        <DialogTitle>{form.id ? '编辑题材' : '新增题材'}</DialogTitle>
        <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            select
            label="所属类型(大类)"
            size="small"
            value={form.parentType || ''}
            onChange={(e) => setForm((f) => ({ ...f, parentType: e.target.value }))}
          >
            {types.map((t) => (
              <MenuItem key={t.code} value={t.code}>{t.name} ({t.code})</MenuItem>
            ))}
          </TextField>
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

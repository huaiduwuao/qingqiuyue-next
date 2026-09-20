'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { DataGridTable } from '@/components/tables/DataGridTable';
import { list, remove, save, update } from '@/apis/menu';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import type { GridColDef } from '@mui/x-data-grid';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { useAuthority } from '@/contexts/AuthContext';
import { PERMISSIONS } from '@/lib/permissions';
import { MENU_ICON_NAMES, resolveMenuIcon } from '@/lib/menuIcons';
import { MENU_GROUP_ORDER, MENU_GROUP_LABELS } from '@/lib/menuGroups';

const LIST_KEY = ['system', 'menu'];

// type 字段的枚举值。跟后端 MenuService / 数字人 MenusTab 的取值保持一致。
const MENU_TYPES = [
  { value: 'menu', label: '菜单' },
  { value: 'button', label: '按钮' },
  { value: 'link', label: '链接' },
];

// 分组候选项:key 存数据库,label 显示给管理员。
const GROUP_OPTIONS = MENU_GROUP_ORDER.map((g) => ({ value: g, label: MENU_GROUP_LABELS[g] ?? g }));

export default function SystemMenuPage() {
  const qc = useQueryClient();
  const [writeVisible, setWriteVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const { can } = useAuthority();
  const [formValues, setFormValues] = useState<any>({});
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  // 父菜单下拉的候选列表。注意不能复用 DataGridTable 的分页数据(只拉第一页),
  // 这里单独拉全量(菜单量级很小,几百条以内)。
  const { data: allMenusData } = useQuery({
    queryKey: [...LIST_KEY, 'all'],
    queryFn: () => list({ pageSize: 500 }),
    enabled: writeVisible,
  });
  const allMenus: any[] = allMenusData?.list || allMenusData?.records || [];

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => setSnackbar({ open: true, message, severity });

  const invalidate = () => qc.invalidateQueries({ queryKey: LIST_KEY });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => remove(id),
    onSuccess: () => { showMessage('删除成功'); invalidate(); },
    onError: (err: any) => showMessage(err.message || '删除失败', 'error'),
  });

  const saveMutation = useMutation({
    mutationFn: (vals: any) => save(vals),
    onSuccess: () => { showMessage('创建成功'); setWriteVisible(false); invalidate(); },
    onError: (err: any) => showMessage(err.message || '创建失败', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: (vals: any) => update(vals.id, vals),
    onSuccess: () => { showMessage('更新成功'); setWriteVisible(false); invalidate(); },
    onError: (err: any) => showMessage(err.message || '更新失败', 'error'),
  });

  const isSubmitting = saveMutation.isPending || updateMutation.isPending;

  const handleEdit = (record: any) => {
    setSelectedRecord(record);
    setFormValues({
      name: record?.name || '',
      info: record?.info || '',
      pid: record?.pid ?? 0,
      path: record?.path || '',
      sort: record?.sort ?? 0,
      icon: record?.icon || '',
      code: record?.code || '',
      type: record?.type || 'menu',
      // display 是 0/1;转成 bool 给 Switch
      display: record?.display ?? 1,
      accent: record?.accent || '',
      group: record?.group || '',
    });
    setWriteVisible(true);
  };

  const handleDelete = (record: any) => {
    if (!confirm('确定删除吗？')) return;
    deleteMutation.mutate(record.id);
  };

  const handleSubmit = () => {
    if (!formValues.name) { showMessage('名称不能为空', 'error'); return; }
    // 指针字段:空字符串转 null(表示清空),非空原样传。
    const payload = {
      ...formValues,
      code: formValues.code || null,
      accent: formValues.accent || null,
      group: formValues.group || null,
    };
    if (selectedRecord?.id) {
      updateMutation.mutate({ ...payload, id: selectedRecord.id });
    } else {
      saveMutation.mutate(payload);
    }
  };

  const handleFormChange = (field: string, value: any) => {
    setFormValues((prev: any) => ({ ...prev, [field]: value }));
  };

  const columns: GridColDef[] = [
    {
      field: 'name', headerName: '名称', width: 150,
      renderCell: (params) => {
        const Icon = resolveMenuIcon(params.row.icon);
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Icon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <span>{params.value}</span>
          </Box>
        );
      },
    },
    { field: 'info', headerName: '描述', width: 150 },
    { field: 'path', headerName: '路径', width: 180 },
    { field: 'code', headerName: '权限码', width: 180, valueFormatter: (v) => v || '—' },
    { field: 'group', headerName: '分组', width: 110, valueFormatter: (v) => (v ? (MENU_GROUP_LABELS[v] ?? v) : '—') },
    { field: 'sort', headerName: '排序', width: 70 },
    { field: 'icon', headerName: '图标', width: 130, valueFormatter: (v) => v || '—' },
    { field: 'type', headerName: '类型', width: 80 },
    { field: 'display', headerName: '显示', width: 70, valueFormatter: (v) => (Number(v) === 1 ? '显示' : '隐藏') },
    { field: 'updateTime', headerName: '最后更新时间', width: 170, valueFormatter: (value) => value ? new Date(value).toLocaleString() : '-' },
    {
      field: 'actions',
      headerName: '操作',
      width: 150,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="编辑">
            <IconButton size="small" onClick={() => handleEdit(params.row)}><EditIcon /></IconButton>
          </Tooltip>
          <Tooltip title="删除">
            <IconButton size="small" color="error" onClick={() => handleDelete(params.row)}><DeleteIcon /></IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <DataGridTable
        columns={columns}
        actionPermissions={{ edit: PERMISSIONS.SYSTEM_MENU.UPDATE, delete: PERMISSIONS.SYSTEM_MENU.DELETE }}
        hasPermission={can}
        fetchData={async (params) => {
          const res = await list(params);
          const items = res?.list || res?.records || [];
          const total = res?.total || res?.totalRow || items.length;
          return { records: items, totalRow: total };
        }}
        onEdit={handleEdit}
        onDelete={handleDelete}
        filters={{
          fields: [
            { key: 'name', label: '名称', type: 'text' },
          ],
          values: filterValues,
          onChange: setFilterValues,
          onReset: () => setFilterValues({}),
        }}
        toolBarRender={() => (
          <PermissionGuard need={PERMISSIONS.SYSTEM_MENU.CREATE}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleEdit({})}
              sx={{
                bgcolor: 'primary.main',
                color: '#fff',
                textTransform: 'none',
                fontWeight: 500,
                fontSize: 12.5,
                borderRadius: 1.5,
                px: 1.75,
                py: 0.5,
                boxShadow: '0 2px 8px rgba(254, 44, 85, 0.3)',
                '&:hover': { bgcolor: '#E0274B', boxShadow: '0 4px 12px rgba(254, 44, 85, 0.4)' },
              }}
            >新建</Button>
          </PermissionGuard>
        )}
      />

      <Dialog
        open={writeVisible}
        onClose={() => setWriteVisible(false)}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'background.paper',
              color: 'text.primary',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              backgroundImage: 'none',
              boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
            },
          },
        }}
      >
        <DialogTitle sx={{ color: 'text.primary', borderBottom: '1px solid', borderColor: 'divider', fontSize: 14, fontWeight: 600, py: 1.5 }}>
          {selectedRecord?.id ? '编辑菜单' : '新建菜单'}
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="名称"
              value={formValues.name ?? ''}
              onChange={(e) => handleFormChange('name', e.target.value)}
              fullWidth size="small"
              slotProps={{ inputLabel: { sx: { color: 'text.secondary', fontSize: 13 } } }}
              sx={textFieldSx}
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Autocomplete
                options={allMenus.filter((m) => m.type !== 'button' && m.id !== selectedRecord?.id)}
                getOptionLabel={(o: any) => o?.name ?? ''}
                isOptionEqualToValue={(o: any, v: any) => o?.id === v?.id}
                value={allMenus.find((m) => m.id === formValues.pid) ?? null}
                onChange={(_, v: any) => handleFormChange('pid', v?.id ?? 0)}
                sx={{ flex: 1 }}
                size="small"
                renderInput={(params) => <TextField {...params} label="父级菜单" sx={textFieldSx} />}
              />
              <TextField
                label="排序"
                type="number"
                value={formValues.sort ?? 0}
                onChange={(e) => handleFormChange('sort', Number(e.target.value))}
                sx={{ ...textFieldSx, width: 110 }}
                size="small"
              />
            </Box>

            <TextField
              label="路径"
              value={formValues.path ?? ''}
              onChange={(e) => handleFormChange('path', e.target.value)}
              fullWidth size="small"
              placeholder="/system/xxx"
              slotProps={{ inputLabel: { sx: { color: 'text.secondary', fontSize: 13 } } }}
              sx={textFieldSx}
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="权限码"
                value={formValues.code ?? ''}
                onChange={(e) => handleFormChange('code', e.target.value)}
                sx={{ ...textFieldSx, flex: 1 }}
                size="small"
                placeholder="system:resource:action"
                helperText="留空 = 公共菜单,所有人可见"
                slotProps={{ inputLabel: { sx: { color: 'text.secondary', fontSize: 13 } }, formHelperText: { sx: { fontSize: 11 } } }}
              />
              <TextField
                label="类型"
                select
                value={formValues.type ?? 'menu'}
                onChange={(e) => handleFormChange('type', e.target.value)}
                sx={{ ...textFieldSx, width: 120 }}
                size="small"
              >
                {MENU_TYPES.map((t) => (
                  <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                ))}
              </TextField>
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Autocomplete
                freeSolo
                options={MENU_ICON_NAMES}
                value={formValues.icon ?? ''}
                onInputChange={(_, v) => handleFormChange('icon', v)}
                onChange={(_, v) => handleFormChange('icon', v ?? '')}
                sx={{ flex: 1 }}
                size="small"
                renderInput={(params) => <TextField {...params} label="图标" placeholder="如 AdminPanelSettings" sx={textFieldSx} />}
              />
              <Autocomplete
                options={GROUP_OPTIONS}
                getOptionLabel={(o: any) => (typeof o === 'string' ? o : o?.label ?? '')}
                isOptionEqualToValue={(o: any, v: any) => o?.value === v?.value}
                value={GROUP_OPTIONS.find((g) => g.value === formValues.group) ?? null}
                onChange={(_, v: any) => handleFormChange('group', v?.value ?? '')}
                sx={{ flex: 1 }}
                size="small"
                renderInput={(params) => <TextField {...params} label="分组" sx={textFieldSx} />}
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <TextField
                label="高亮色"
                value={formValues.accent ?? ''}
                onChange={(e) => handleFormChange('accent', e.target.value)}
                sx={{ ...textFieldSx, flex: 1 }}
                size="small"
                placeholder="#1976d2 或 primary.main"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={Number(formValues.display ?? 1) === 1}
                    onChange={(e) => handleFormChange('display', e.target.checked ? 1 : 0)}
                  />
                }
                label="显示"
                sx={{ '& .MuiFormControlLabel-label': { fontSize: 13, color: 'text.secondary' } }}
              />
            </Box>

            <TextField
              label="描述"
              value={formValues.info ?? ''}
              onChange={(e) => handleFormChange('info', e.target.value)}
              fullWidth size="small" multiline rows={2}
              slotProps={{ inputLabel: { sx: { color: 'text.secondary', fontSize: 13 } } }}
              sx={textFieldSx}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid', borderColor: 'divider', px: 2.5, py: 1.5, gap: 1 }}>
          <Button
            onClick={() => setWriteVisible(false)}
            sx={{
              color: 'text.secondary',
              textTransform: 'none',
              fontSize: 12.5,
              px: 2,
              '&:hover': { color: 'text.tertiary', bgcolor: 'action.hover' },
            }}
          >取消</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isSubmitting}
            sx={{
              bgcolor: 'primary.main',
              color: '#fff',
              textTransform: 'none',
              fontSize: 12.5,
              px: 2.5,
              borderRadius: 1.5,
              boxShadow: '0 2px 8px rgba(254, 44, 85, 0.3)',
              '&:hover': { bgcolor: '#E0274B' },
            }}
          >提交</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

const textFieldSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'background.default',
    borderRadius: 1.5,
    '& fieldset': { borderColor: 'divider' },
    '&:hover fieldset': { borderColor: 'text.disabled' },
    '&.Mui-focused': { bgcolor: 'rgba(254, 44, 85, 0.05)' },
    '&.Mui-focused fieldset': { borderColor: 'primary.main' },
  },
  '& .MuiInputLabel-root.Mui-focused': { color: 'primary.main' },
};

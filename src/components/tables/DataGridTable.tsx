'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo, useId, lazy, Suspense } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { GridColDef, GridPaginationModel, GridSortModel, GridRowSelectionModel } from '@mui/x-data-grid';
import { FilterBar, FilterBarProps } from './FilterBar';

const DataGrid = lazy(() => import('@mui/x-data-grid').then(mod => ({ default: mod.DataGrid })));

interface DataGridTableProps {
  title?: string;
  columns: GridColDef[];
  fetchData: (params: {
    pageNumber: number;
    pageSize: number;
    sortField?: string;
    sortOrder?: string;
    [key: string]: any;
  }) => Promise<{ records?: any[]; list?: any[]; totalRow?: number; total?: number }>;
  onEdit?: (row: any) => void;
  onDelete?: (row: any) => void;
  onSelectionChange?: (rows: any[]) => void;
  toolBarRender?: () => React.ReactNode;
  /**
   * Optional filter/query values that should cause a refetch when changed.
   * Serialized as a dep key — pass primitives only (string/number/boolean).
   */
  extraParams?: Record<string, string | number | boolean | undefined | null>;
  /**
   * Optional FilterBar configuration. When provided, the FilterBar is rendered
   * above the table toolbar. filter values are merged into `extraParams` and
   * auto-refetched on change.
   */
  filters?: FilterBarProps;
  /**
   * react-query 键前缀。页面 invalidateQueries 同一前缀(如 LIST_KEY)时表格自动重拉,
   * 不传则只能靠 refreshKey / 筛选变化触发。
   */
  queryKey?: readonly unknown[];
  /** 变化即重拉当前页(不回第一页)—— 给定时刷新、保存后刷新用,别塞进 extraParams。 */
  refreshKey?: string | number;
  /** 操作列权限码 — 不传则不限制 */
  actionPermissions?: { edit?: string; delete?: string };
  /** 拥有 edit/delete 权限的判断函数;不传则永远 true(交给 actionPermissions 控制) */
  hasPermission?: (code: string) => boolean;
  /** 自定义行级操作(暂停/恢复等)。hidden 返回 true 则不渲染。 */
  customActions?: Array<{
    label: string;
    icon?: React.ReactNode;
    onClick: (row: any) => void;
    hidden?: (row: any) => boolean;
    color?: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
  }>;
}

export function DataGridTable({
  title,
  columns,
  fetchData,
  onEdit,
  onDelete,
  onSelectionChange,
  toolBarRender,
  extraParams,
  filters,
  queryKey,
  refreshKey,
  actionPermissions,
  hasPermission,
  customActions,
}: DataGridTableProps) {
  const instanceId = useId();
  const [mounted, setMounted] = useState(false);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 20,
  });
  const [sortModel, setSortModel] = useState<GridSortModel>([]);
  const [rowSelectionModel, setRowSelectionModel] = useState<GridRowSelectionModel>({ type: 'include', ids: new Set() });

  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;

  useEffect(() => {
    setMounted(true);
  }, []);

  // 非空筛选值 —— 既进请求参数,也进查询键
  const filterValues = filters?.values;
  const filterArgs = useMemo(() => {
    const out: Record<string, any> = {};
    if (filterValues) {
      for (const [k, v] of Object.entries(filterValues)) {
        if (v !== '' && v !== null && v !== undefined) out[k] = v;
      }
    }
    return out;
  }, [filterValues]);

  const extraParamsKey = useMemo(() => {
    const merged: Record<string, any> = { ...(extraParams || {}), ...filterArgs };
    return Object.keys(merged).length ? JSON.stringify(merged) : '';
  }, [extraParams, filterArgs]);

  // 筛选变了回第一页;refreshKey 变化不回
  useEffect(() => {
    setPaginationModel((prev) => (prev.page === 0 ? prev : { ...prev, page: 0 }));
  }, [extraParamsKey]);

  const sortField = sortModel?.[0]?.field;
  const sortOrder = sortModel?.[0]?.sort ?? undefined;

  // 用 react-query 取数:并发时只认最新一次请求的结果(旧实现会丢掉加载中的筛选变更),
  // 页面 invalidate 同前缀键即可刷新。instanceId 防同页多表共用前缀时串数据。
  const query = useQuery({
    queryKey: [
      ...(queryKey ?? ['data-grid-table']),
      instanceId,
      paginationModel.page,
      paginationModel.pageSize,
      sortField,
      sortOrder,
      extraParamsKey,
      refreshKey,
    ],
    queryFn: async () => {
      // 拦截器已剥掉 {code,msg} 外壳,result 本身就是业务数据
      const result = await fetchDataRef.current({
        pageNumber: paginationModel.page + 1,
        pageSize: paginationModel.pageSize,
        sortField,
        sortOrder: sortOrder as string | undefined,
        ...filterArgs,
      });
      return {
        list: result?.records || result?.list || [],
        total: result?.totalRow || result?.total || 0,
      };
    },
    enabled: mounted,
    placeholderData: keepPreviousData,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });

  useEffect(() => {
    if (query.error) console.error('Failed to fetch data:', query.error);
  }, [query.error]);

  const rows = useMemo(() => (query.isError ? [] : query.data?.list ?? []), [query.isError, query.data]);
  const rowCount = query.isError ? 0 : query.data?.total ?? 0;
  const loading = query.isFetching;

  const handlePaginationModelChange = useCallback((newModel: GridPaginationModel) => {
    setPaginationModel(newModel);
  }, []);

  const handleSortModelChange = useCallback((newModel: GridSortModel) => {
    setSortModel(newModel);
  }, []);

  // 传了 onSelectionChange 才出勾选列。v8+ 的选择模型是 {type, ids}:表头「全选」给的是
  // exclude(除 ids 外全选),rows 只有当前页,所以两种都按当前页行展开。翻页 / 删除后
  // 不在 rows 里的 id 由 DataGrid 自己剔除并再回调一次,父组件的选中列表跟着清掉。
  const handleRowSelectionChange = useCallback((model: GridRowSelectionModel) => {
    setRowSelectionModel(model);
    if (onSelectionChange) {
      const selectedRows = rows.filter((row) =>
        model.type === 'include' ? model.ids.has(row.id) : !model.ids.has(row.id),
      );
      onSelectionChange(selectedRows);
    }
  }, [rows, onSelectionChange]);

  // 操作列要随权限 / 回调变化重建:以前它被 useMemo([columns]) 冻结在首帧,列定义在模块级的页面里
  // 权限异步加载完后编辑/删除按钮也不出现,onEdit / onDelete 也一直是首帧的旧闭包。
  const canEdit = !actionPermissions?.edit || (hasPermission ? hasPermission(actionPermissions.edit) : true);
  const canDelete = !actionPermissions?.delete || (hasPermission ? hasPermission(actionPermissions.delete) : true);

  const actionColumn = useMemo<GridColDef>(() => ({
    field: 'actions',
    headerName: '操作',
    flex: 1,
    minWidth: 140,
    sortable: false,
    disableColumnMenu: true,
    align: 'center',
    headerAlign: 'center',
    renderCell: (params) => {
      if (!canEdit && !canDelete) return null;
      return (
        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', flexWrap: 'wrap' }}>
          {customActions?.map((ca, i) => {
            if (ca.hidden && ca.hidden(params.row)) return null;
            return (
              <Button
                key={i}
                size="small"
                variant="text"
                color={ca.color || 'inherit'}
                startIcon={ca.icon}
                onClick={() => ca.onClick(params.row)}
              >
                {ca.label}
              </Button>
            );
          })}
          {onEdit && canEdit && (
            <Button size="small" variant="text" onClick={() => onEdit(params.row)}>
              编辑
            </Button>
          )}
          {onDelete && canDelete && (
            <Button size="small" color="error" variant="text" onClick={() => onDelete(params.row)}>
              删除
            </Button>
          )}
        </Box>
      );
    },
  }), [canEdit, canDelete, customActions, onEdit, onDelete]);

  const columnsWithActions = useMemo<GridColDef[]>(() => {
    if (columns.some((col) => col.field === 'actions')) {
      // 给用户自定义的 actions 列也加 flex 让它填充剩余宽度
      return columns.map((col) =>
        col.field === 'actions' && !col.flex
          ? { ...col, flex: 1, minWidth: col.minWidth ?? 140 }
          : col,
      );
    }
    return [...columns, actionColumn];
  }, [columns, actionColumn]);

  const centeredColumns = useMemo<GridColDef[]>(() => {
    return columnsWithActions.map((col) => ({
      ...col,
      headerAlign: col.headerAlign ?? 'center',
      align: col.align ?? 'center',
    }));
  }, [columnsWithActions]);

  if (!mounted) {
    return (
      <Paper sx={{ width: '100%', p: 2 }}>
        {title && (
          <Typography variant="h6" sx={{ mb: 2 }}>
            {title}
          </Typography>
        )}
        <Box sx={{ minHeight: 400 }} />
      </Paper>
    );
  }

  return (
    <Paper sx={{ width: '100%', p: 2, bgcolor: 'background.paper' }}>
      {title && (
        <Typography variant="h6" sx={{ mb: 2 }}>
          {title}
        </Typography>
      )}
      {filters && <FilterBar {...filters} />}
      {toolBarRender && <Box sx={{ mb: 2 }}>{toolBarRender()}</Box>}
      <Box sx={{ width: '100%' }}>
        <Suspense fallback={<Box sx={{ height: 400 }} />}>
          <DataGrid
            rows={rows}
            columns={centeredColumns}
            loading={loading}
            autoHeight
            paginationMode="server"
            rowCount={rowCount}
            paginationModel={paginationModel}
            onPaginationModelChange={handlePaginationModelChange}
            pageSizeOptions={[10, 20, 50, 100]}
            sortModel={sortModel}
            onSortModelChange={handleSortModelChange}
            disableRowSelectionOnClick
            checkboxSelection={!!onSelectionChange}
            rowSelectionModel={onSelectionChange ? rowSelectionModel : undefined}
            onRowSelectionModelChange={onSelectionChange ? handleRowSelectionChange : undefined}
            sx={{
              width: '100%',
              '& [data-field="actions"]': {
                justifyContent: 'center',
              },
              '& [data-field="actions"].MuiDataGrid-cell--withRenderer': {
                display: 'flex',
                alignItems: 'center',
              },
            }}
          />
        </Suspense>
      </Box>
    </Paper>
  );
}
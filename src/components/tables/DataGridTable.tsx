'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { GridColDef, GridPaginationModel, GridSortModel, GridRowId } from '@mui/x-data-grid';

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
  }) => Promise<{ data: { records?: any[]; list?: any[]; totalRow?: number; total?: number }; success?: boolean; code?: number }>;
  onEdit?: (row: any) => void;
  onDelete?: (row: any) => void;
  onSelectionChange?: (rows: any[]) => void;
  toolBarRender?: () => React.ReactNode;
  /**
   * Optional filter/query values that should cause a refetch when changed.
   * Serialized as a dep key — pass primitives only (string/number/boolean).
   */
  extraParams?: Record<string, string | number | boolean | undefined | null>;
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
  actionPermissions,
  hasPermission,
  customActions,
}: DataGridTableProps) {
  const [rows, setRows] = useState<any[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 20,
  });
  const [sortModel, setSortModel] = useState<GridSortModel>([]);
  const [selectedIds, setSelectedIds] = useState<GridRowId[]>([]);

  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;

  const isLoadingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    setMounted(true);
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const extraParamsKey = useMemo(
    () => (extraParams ? JSON.stringify(extraParams) : ''),
    [extraParams],
  );

  useEffect(() => {
    setPaginationModel((prev) => (prev.page === 0 ? prev : { ...prev, page: 0 }));
  }, [extraParamsKey]);

  const loadData = useCallback(async () => {
    if (isLoadingRef.current || !mountedRef.current) return;

    isLoadingRef.current = true;
    setLoading(true);

    try {
      const sortField = sortModel?.[0]?.field;
      const sortOrder = sortModel?.[0]?.sort;

      const result = await fetchDataRef.current({
        pageNumber: paginationModel.page + 1,
        pageSize: paginationModel.pageSize,
        sortField,
        sortOrder: sortOrder as string | undefined,
      });

      if (mountedRef.current) {
        const data = result?.data || {};
        const list = data.records || data.list || [];
        const total = data.totalRow || data.total || 0;

        const isSuccess = result?.success !== false && (result?.success === true || result?.code === 200 || result?.code === 0 || result?.code === undefined || list.length > 0);

        if (isSuccess) {
          setRows(list);
          setRowCount(total);
        } else {
          console.warn('Fetch returned unsuccessful result:', result);
          setRows([]);
          setRowCount(0);
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      if (mountedRef.current) {
        setRows([]);
        setRowCount(0);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      isLoadingRef.current = false;
    }
  }, [paginationModel.page, paginationModel.pageSize, sortModel, extraParamsKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePaginationModelChange = useCallback((newModel: GridPaginationModel) => {
    setPaginationModel(newModel);
  }, []);

  const handleSortModelChange = useCallback((newModel: GridSortModel) => {
    setSortModel(newModel);
  }, []);

  const handleRowSelectionChange = useCallback((newSelection: GridRowId[]) => {
    setSelectedIds(newSelection);
    if (onSelectionChange) {
      const selectedRows = rows.filter((row) => newSelection.includes(row.id));
      onSelectionChange(selectedRows);
    }
  }, [rows, onSelectionChange]);

  const actionColumn: GridColDef = {
    field: 'actions',
    headerName: '操作',
    flex: 1,
    minWidth: 140,
    sortable: false,
    disableColumnMenu: true,
    align: 'center',
    headerAlign: 'center',
    renderCell: (params) => {
      const canEdit = !actionPermissions?.edit || (hasPermission ? hasPermission(actionPermissions.edit) : true);
      const canDelete = !actionPermissions?.delete || (hasPermission ? hasPermission(actionPermissions.delete) : true);
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
  };

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
  }, [columns]);

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
      {toolBarRender && <Box sx={{ mb: 2 }}>{toolBarRender()}</Box>}
      <Box sx={{ width: '100%' }}>
        <Suspense fallback={<Box sx={{ height: 400 }} />}>
          <DataGrid
            rows={rows}
            columns={centeredColumns}
            loading={loading}
            autoHeight
            paginationModel={paginationModel}
            onPaginationModelChange={handlePaginationModelChange}
            pageSizeOptions={[10, 20, 50, 100]}
            sortModel={sortModel}
            onSortModelChange={handleSortModelChange}
            disableRowSelectionOnClick
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
'use client';

import React, { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import {
  DataGrid,
  GridColDef,
  GridPaginationModel,
  GridSortModel,
  GridRowId,
  GridRowSelectionModel,
} from '@mui/x-data-grid';

interface DataGridTableProps {
  title?: string;
  columns: GridColDef[];
  fetchData: (params: {
    pageNumber: number;
    pageSize: number;
    sortField?: string;
    sortOrder?: string;
    [key: string]: any;
  }) => Promise<{ data: { records: any[]; totalRow: number }; success: boolean }>;
  onEdit?: (row: any) => void;
  onDelete?: (row: any) => void;
  onSelectionChange?: (rows: any[]) => void;
  toolBarRender?: () => React.ReactNode;
}

export function DataGridTable({
  title,
  columns,
  fetchData,
  onEdit,
  onDelete,
  onSelectionChange,
  toolBarRender,
}: DataGridTableProps) {
  const [rows, setRows] = useState<any[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 20,
  });
  const [sortModel, setSortModel] = useState<GridSortModel>([]);
  const [selectedIds, setSelectedIds] = useState<GridRowId[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const sortField = sortModel?.[0]?.field;
      const sortOrder = sortModel?.[0]?.sort;

      const result = await fetchData({
        pageNumber: paginationModel.page + 1,
        pageSize: paginationModel.pageSize,
        sortField,
        sortOrder: sortOrder as string | undefined,
      });

      if (result.success) {
        setRows(result.data.records || []);
        setRowCount(result.data.totalRow || 0);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [paginationModel, sortModel, fetchData]);

  React.useEffect(() => {
    loadData();
  }, [paginationModel, sortModel]);

  const handlePaginationModelChange = (newModel: GridPaginationModel) => {
    setPaginationModel(newModel);
  };

  const handleSortModelChange = (newModel: GridSortModel) => {
    setSortModel(newModel);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleRowSelectionChange = (newSelection: any) => {
    const selectionArray = Array.from(newSelection as Iterable<GridRowId>);
    setSelectedIds(selectionArray);
    if (onSelectionChange) {
      const selectedRows = rows.filter((row) => selectionArray.includes(row.id));
      onSelectionChange(selectedRows);
    }
  };

  const actionColumn: GridColDef = {
    field: 'actions',
    headerName: '操作',
    width: 150,
    sortable: false,
    disableColumnMenu: true,
    renderCell: (params) => {
      return (
        <Box sx={{ display: 'flex', gap: 1 }}>
          {onEdit && (
            <Button size="small" variant="text" onClick={() => onEdit(params.row)}>
              编辑
            </Button>
          )}
          {onDelete && (
            <Button size="small" color="error" variant="text" onClick={() => onDelete(params.row)}>
              删除
            </Button>
          )}
        </Box>
      );
    },
  };

  const columnsWithActions = [...columns, actionColumn];

  return (
    <Paper sx={{ width: '100%', p: 2 }}>
      {title && (
        <Typography variant="h6" sx={{ mb: 2 }}>
          {title}
        </Typography>
      )}
      {toolBarRender && <Box sx={{ mb: 2 }}>{toolBarRender()}</Box>}
      <DataGrid
        rows={rows}
        columns={columnsWithActions}
        loading={loading}
        rowCount={rowCount}
        paginationMode="server"
        paginationModel={paginationModel}
        onPaginationModelChange={handlePaginationModelChange}
        pageSizeOptions={[10, 20, 50, 100]}
        sortingMode="server"
        sortModel={sortModel}
        onSortModelChange={handleSortModelChange}
        checkboxSelection
        disableRowSelectionOnClick
        onRowSelectionModelChange={handleRowSelectionChange}
        sx={{ border: 0, minHeight: 400 }}
      />
    </Paper>
  );
}

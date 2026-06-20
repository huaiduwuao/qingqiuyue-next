'use client';

import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { RichTreeView } from '@mui/x-tree-view';
import { tree, save, update, remove } from '@/apis/system-dict-data';
import type { DictDataItem } from '@/beans/system';
import { listDictTypes } from '@/apis/system-dict-type';
import { DictDataFormDialog } from '@/components/dict/DictDataFormDialog';

interface TreeItem {
  id: string;
  label: string;
  data: DictDataItem;
  children?: TreeItem[];
}

/**
 * 把后端扁平 / 嵌套的树拍平或转换,统一为 RichTreeView 需要的嵌套结构。
 * 后端字段可能是 parentId 或 pid(兼容)。
 */
function buildTree(records: DictDataItem[]): TreeItem[] {
  if (!records?.length) return [];
  // 后端已经返回嵌套 children 时的情形
  const hasNested = records.some((r) => Array.isArray((r as any).children) && (r as any).children.length > 0);
  if (hasNested) {
    const map = (list: DictDataItem[]): TreeItem[] =>
      list.map((r) => ({
        id: String(r.id),
        label: (r as any).label || r.name || r.value || `#${r.id}`,
        data: r,
        children: Array.isArray((r as any).children) ? map((r as any).children) : undefined,
      }));
    return map(records);
  }
  // 扁平 → 自己组装
  const items = records.filter((r) => !(r as any).children || (Array.isArray((r as any).children) && (r as any).children.length === 0));
  const byId = new Map<number, DictDataItem & { children: any[] }>();
  items.forEach((r) => byId.set(r.id!, { ...r, children: [] }));
  const roots: (DictDataItem & { children: any[] })[] = [];
  items.forEach((r) => {
    const pid = r.parentId ?? r.pid ?? 0;
    if (pid && byId.has(pid)) {
      byId.get(pid)!.children.push(r);
    } else {
      roots.push(byId.get(r.id!)!);
    }
  });
  const map = (list: any[]): TreeItem[] =>
    list.map((r) => ({
      id: String(r.id),
      label: (r as any).label || r.name || r.value || `#${r.id}`,
      data: r,
      children: r.children?.length ? map(r.children) : undefined,
    }));
  return map(roots);
}

function countDescendants(item: DictDataItem): number {
  if (!Array.isArray((item as any).children) || (item as any).children.length === 0) return 0;
  return (item as any).children.reduce(
    (sum: number, c: DictDataItem) => sum + 1 + countDescendants(c),
    0,
  );
}

export default function SystemDictDataPage() {
  const qc = useQueryClient();
  const [selectedType, setSelectedType] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DictDataItem | null>(null);
  const [parentForCreate, setParentForCreate] = useState<DictDataItem | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false,
    msg: '',
    severity: 'success',
  });

  const showMsg = (msg: string, severity: 'success' | 'error' = 'success') =>
    setSnack({ open: true, msg, severity });

  // 1. 字典类型下拉
  const { data: typeResp } = useQuery({
    queryKey: ['system', 'dict-type', 'all-for-select'],
    queryFn: async () => {
      const res: any = await listDictTypes({ pageSize: 999 });
      return res.data?.list || res.data?.records || [];
    },
  });

  // 选中第一个类型(默认)
  const types = typeResp || [];
  React.useEffect(() => {
    if (!selectedType && types.length) {
      const first = types[0];
      setSelectedType(first.type || first.code || String(first.id));
    }
  }, [types, selectedType]);

  // 2. 加载字典树
  const treeQuery = useQuery({
    queryKey: ['dict-data-tree', selectedType],
    queryFn: async () => {
      if (!selectedType) return [];
      const res: any = await tree(selectedType);
      const list = Array.isArray(res.data) ? res.data : res.data?.list || res.data?.records || [];
      return list as DictDataItem[];
    },
    enabled: !!selectedType,
  });

  const treeItems = useMemo(() => buildTree(treeQuery.data || []), [treeQuery.data]);

  // id -> DictDataItem 反查表,供 item slot 通过 itemId 找到原始数据
  const itemLookup = useMemo(() => {
    const m = new Map<string, DictDataItem>();
    const walk = (list: TreeItem[]) => {
      list.forEach((it) => {
        m.set(it.id, it.data);
        if (it.children) walk(it.children);
      });
    };
    walk(treeItems);
    return m;
  }, [treeItems]);

  // 3. mutations
  const saveMut = useMutation({
    mutationFn: async (vals: Partial<DictDataItem>) => {
      if (vals.id) {
        return update(vals as DictDataItem);
      }
      return save({ ...vals, type: selectedType, typeName: selectedType } as any);
    },
    onSuccess: () => {
      showMsg(editing ? '更新成功' : '创建成功');
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ['dict-data-tree', selectedType] });
    },
    onError: (err: any) => showMsg(err?.message || '操作失败', 'error'),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => remove([id]),
    onSuccess: () => {
      showMsg('删除成功');
      qc.invalidateQueries({ queryKey: ['dict-data-tree', selectedType] });
    },
    onError: (err: any) => showMsg(err?.message || '删除失败', 'error'),
  });

  const handleDelete = (item: DictDataItem) => {
    const childrenCount = countDescendants(item);
    if (childrenCount > 0) {
      showMsg(`该节点有 ${childrenCount} 个子项,请先删除子项`, 'error');
      return;
    }
    if (!confirm(`确认删除 “${(item as any).label || item.name || item.value}” ?`)) return;
    deleteMut.mutate(item.id!);
  };

  const handleEdit = (item: DictDataItem) => {
    setEditing(item);
    setParentForCreate(null);
    setDialogOpen(true);
  };

  const handleAddRoot = () => {
    setEditing(null);
    setParentForCreate(null);
    setDialogOpen(true);
  };

  const handleAddChild = (parent: DictDataItem) => {
    setEditing(null);
    setParentForCreate(parent);
    setDialogOpen(true);
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 } }}>
      <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: 'center' }}>
        <Typography variant="h5">字典数据</Typography>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddRoot} disabled={!selectedType}>
          新增根项
        </Button>
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2, alignItems: { md: 'center' } }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>字典类型</InputLabel>
          <Select
            value={selectedType}
            label="字典类型"
            onChange={(e) => setSelectedType(e.target.value)}
          >
            {types.map((t: any) => (
              <MenuItem key={t.id ?? t.type} value={t.type || t.code || String(t.id)}>
                {t.name} ({t.type || t.code})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="caption" color="text.secondary">
          共 {treeItems.length} 个根节点 / {treeQuery.data?.length || 0} 条记录
        </Typography>
      </Stack>

      <Paper variant="outlined" sx={{ p: 1, minHeight: 240 }}>
        {treeQuery.isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        ) : treeItems.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
            <Typography variant="body2">该字典类型下暂无数据</Typography>
            <Button sx={{ mt: 1 }} size="small" startIcon={<AddIcon />} onClick={handleAddRoot}>
              新增根项
            </Button>
          </Box>
        ) : (
          <RichTreeView
            items={treeItems}
            getItemId={(it) => (it as unknown as TreeItem).id}
            getItemLabel={(it) => (it as unknown as TreeItem).label}
            defaultExpandedItems={treeItems.map((it) => it.id)}
            sx={{
              '& .MuiTreeItem-content': {
                py: 0.5,
                borderRadius: 1,
              },
              '& .MuiTreeItem-label': {
                fontSize: 13,
              },
            }}
            slots={{
              item: (props: any) => {
                const itemId: string = props.itemId ?? props.id;
                const node = itemLookup.get(String(itemId));
                if (!node) {
                  return <Box sx={{ fontSize: 13 }}>{props.label}</Box>;
                }
                const isDisabled = node.status === 'DISABLED' || node.status === 0;
                return (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      width: '100%',
                      pr: 1,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, minWidth: 0 }}>
                      <Typography
                        component="span"
                        sx={{ fontSize: 13, color: isDisabled ? 'text.disabled' : 'text.primary', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        {props.label}
                      </Typography>
                      {node.value ? (
                        <Chip size="small" variant="outlined" label={node.value} sx={{ height: 18, fontSize: 10 }} />
                      ) : null}
                      {isDisabled ? (
                        <Chip size="small" color="default" label="禁用" sx={{ height: 18, fontSize: 10 }} />
                      ) : (
                        <Chip size="small" color="success" label="启用" sx={{ height: 18, fontSize: 10 }} />
                      )}
                      {node.sort !== undefined && node.sort !== null ? (
                        <Typography component="span" sx={{ fontSize: 10, color: 'text.disabled' }}>
                          #{node.sort}
                        </Typography>
                      ) : null}
                    </Box>
                    <Stack direction="row" spacing={0.25}>
                      <Tooltip title="新增子项">
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleAddChild(node); }}>
                          <AddIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="编辑">
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleEdit(node); }}>
                          <EditIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="删除">
                        <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDelete(node); }}>
                          <DeleteIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Box>
                );
              },
            }}
          />
        )}
      </Paper>

      <DictDataFormDialog
        open={dialogOpen}
        record={editing}
        dictType={selectedType}
        parent={parentForCreate}
        parentLabel={parentForCreate ? (parentForCreate as any).label || parentForCreate.name || parentForCreate.value : undefined}
        submitting={saveMut.isPending}
        onClose={() => setDialogOpen(false)}
        onSubmit={async (vals) => {
          await saveMut.mutateAsync(vals);
        }}
      />

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={snack.severity} sx={{ width: '100%' }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
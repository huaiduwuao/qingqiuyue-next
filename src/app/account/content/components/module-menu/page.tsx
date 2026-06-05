'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { clientTree, save, update, remove, ModuleMenuItem } from '@/apis/module-menu';
import AddIcon from '@mui/icons-material/Add';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';

const LIST_KEY = ['content', 'module-menu'];

interface Props {
  moduleId: number;
}

const firstButtons = [{ id: 1, name: '新建目录' }, { id: 2, name: '导入内容' }];
const pageButtons = [{ id: 4, name: '删除' }, { id: 5, name: '移动到' }];

export default function ModuleMenuPage({ moduleId }: Props) {
  const qc = useQueryClient();
  const [hoverMenu, setHoverMenu] = useState<ModuleMenuItem | null>(null);
  const [editMenu, setEditMenu] = useState<ModuleMenuItem | null>(null);
  const [editType, setEditType] = useState<string>('');
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [popoverAnchorEl, setPopoverAnchorEl] = useState<HTMLElement | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => setSnackbar({ open: true, message, severity });
  const invalidate = () => qc.invalidateQueries({ queryKey: LIST_KEY });

  const treeQuery = useQuery({
    queryKey: ['module-menu', 'tree', moduleId],
    queryFn: () => clientTree({ moduleId }).then((r: any) => r.data || []),
    placeholderData: [],
  });
  const treeData: any[] = treeQuery.data || [];

  const loadTree = () => treeQuery.refetch();

  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => remove(ids),
    onSuccess: () => { showMessage('删除成功'); loadTree(); },
    onError: (err: any) => showMessage(err.message || '删除失败', 'error'),
  });

  const saveMutation = useMutation({
    mutationFn: (vals: any) => save(vals),
    onSuccess: () => { showMessage('操作成功'); loadTree(); invalidate(); },
    onError: (err: any) => showMessage(err.message || '操作失败', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: (vals: any) => update(vals),
    onSuccess: () => { showMessage('操作成功'); loadTree(); invalidate(); },
    onError: (err: any) => showMessage(err.message || '操作失败', 'error'),
  });

  const handleClick = (type: number, menu: ModuleMenuItem | null) => {
    setEditMenu(menu);
    if (type === 1) {
      saveMutation.mutate({ moduleId, name: '新建目录', pid: menu?.id, type: 'MENU' });
    } else if (type === 4) {
      if (menu) {
        deleteMutation.mutate([menu.id]);
      }
    }
    setPopoverAnchorEl(null);
  };

  const handleRename = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && editMenu) {
      updateMutation.mutate(
        { id: editMenu.id, name: (e.target as HTMLInputElement).value },
        {
          onSuccess: () => {
            setEditType('');
            setEditMenu(null);
          },
        },
      );
    }
  };

  const renderMenu = (menus: ModuleMenuItem[]): React.ReactNode => {
    return menus.map((menu) => (
      <ListItem key={menu.id} disablePadding>
        {editMenu?.id === menu.id && editType === '3' ? (
          <TextField defaultValue={menu.name} onKeyDown={handleRename} autoFocus size="small" />
        ) : (
          <ListItemButton
            onMouseEnter={() => setHoverMenu(menu)}
            sx={{ pl: 2 }}
          >
            <ListItemText primary={menu.name} />
            {hoverMenu?.id === menu.id && (
              <Box onClick={(e) => { e.stopPropagation(); setEditMenu(menu); setPopoverAnchorEl(e.currentTarget); }}
                sx={{ cursor: 'pointer', display: 'flex', gap: 0.5 }}>
                <Popover
                  open={popoverAnchorEl !== null && editMenu?.id === menu.id}
                  anchorEl={popoverAnchorEl}
                  onClose={() => setPopoverAnchorEl(null)}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                >
                  <List dense>
                    <ListItemButton onClick={() => handleClick(1, menu)}><Button>新建目录</Button></ListItemButton>
                    {menu.type === 'PAGE' && pageButtons.map(btn => (
                      <ListItemButton key={btn.id} onClick={() => handleClick(btn.id, menu)}><Button>{btn.name}</Button></ListItemButton>
                    ))}
                  </List>
                </Popover>
                <MoreHorizIcon />
              </Box>
            )}
          </ListItemButton>
        )}
        {menu.children && menu.children.length > 0 && (
          <List component="div" disablePadding sx={{ pl: 2 }}>
            {renderMenu(menu.children)}
          </List>
        )}
      </ListItem>
    ));
  };

  return (
    <Box sx={{ height: "100%", overflow: "hidden" }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>目录</Typography>
        <Button startIcon={<AddIcon />} onClick={(e) => { setEditMenu(null); setPopoverAnchorEl(e.currentTarget); }}>
          新建
        </Button>
        <Popover
          open={popoverAnchorEl !== null && editMenu === null}
          anchorEl={popoverAnchorEl}
          onClose={() => setPopoverAnchorEl(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          <List dense>
            {firstButtons.map(btn => (
              <ListItemButton key={btn.id} onClick={() => handleClick(btn.id, null)}>
                <Button>{btn.name}</Button>
              </ListItemButton>
            ))}
          </List>
        </Popover>
      </Box>
      <List>{renderMenu(treeData)}</List>
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
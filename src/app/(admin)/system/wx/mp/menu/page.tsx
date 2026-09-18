'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getWxMenu, saveWxMenu } from '@/apis/wx-mp';
import { formatApiError } from '@/lib/api/client';
import { WxMpStatusBar } from '@/components/admin/WxMpStatusBar';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { v4 as uuidv4 } from 'uuid';

const LIST_KEY = ['wx-mp-menu'];

// 后端(internal/wxmp)支持的三种菜单。扫码、发图、选位置那几种需要各自的事件处理,没接的不放出来。
const menuOptions = [
  { value: 'view', label: '跳转网页' },
  { value: 'miniprogram', label: '跳转小程序' },
  { value: 'click', label: '点击回复文字' },
];

export default function WxMpMenuPage() {
  const qc = useQueryClient();
  const [checkedFirstMenu, setCheckedFirstMenu] = useState<any>(null);
  const [checked, setChecked] = useState<any>('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => setSnackbar({ open: true, message, severity });

  const menuQuery = useQuery({
    queryKey: LIST_KEY,
    // 菜单树存在 wx_menu 里。以前这棵树只活在浏览器内存里,「发布」的请求体后端根本不读,刷新就没了
    queryFn: () => getWxMenu().then((r) => r.buttons || []),
    staleTime: Infinity, // 编辑中的树就放在这个缓存里,不能被后台重新拉取冲掉
    placeholderData: [],
  });
  const data: any[] = menuQuery.data || [];

  const publishMutation = useMutation({
    mutationFn: (publish: boolean) => saveWxMenu(data, publish),
    onSuccess: (r: any) => {
      showMessage(r?.msg || r?.message || '已保存');
      qc.invalidateQueries({ queryKey: LIST_KEY }); // 拿回落库后的真实 id
    },
    onError: (err: any) => showMessage(formatApiError(err) || '保存失败', 'error'),
  });

  const dealPublish = () => {
    if (!confirm('保存并发布到微信?发布后用户最长 24 小时内看到新菜单。')) return;
    publishMutation.mutate(true);
  };

  const addFirstMenu = () => {
    if (data.length >= 3) {
      showMessage('最多只能添加3个一级菜单', 'error');
      return;
    }
    const newData = [...data, { name: '一级菜单', id: uuidv4(), sub_button: [], type: '' }];
    qc.setQueryData(LIST_KEY, newData);
  };

  const addSubMenu = (firMenu: any) => {
    const newData = data.map(ele => {
      if (ele.id === firMenu.id) {
        return { ...ele, sub_button: [...(ele.sub_button || []), { name: '子菜单', id: uuidv4(), type: '' }] };
      }
      return ele;
    });
    qc.setQueryData(LIST_KEY, newData);
  };

  const handleCheckMenu = (id: string, firId: string) => {
    setChecked(id);
    setCheckedFirstMenu(firId);
  };

  const deleteMenu = () => {
    if (!checked) return;

    let newData;
    if (checkedFirstMenu === checked) {
      newData = data.filter(ele => ele.id !== checked);
    } else {
      newData = data.map(ele => {
        if (ele.id === checkedFirstMenu) {
          return { ...ele, sub_button: ele.sub_button?.filter((sub: any) => sub.id !== checked) || [] };
        }
        return ele;
      });
    }
    qc.setQueryData(LIST_KEY, newData);
    setChecked('');
    setCheckedFirstMenu(null);
  };

  const handleTypeObjChange = (key: string, value: any) => {
    const newData = data.map(ele => {
      if (checkedFirstMenu === checked && ele.id === checked) {
        return { ...ele, [key]: value };
      }
      if (ele.id === checkedFirstMenu) {
        return {
          ...ele,
          sub_button: ele.sub_button?.map((sub: any) => {
            if (sub.id === checked) {
              return { ...sub, [key]: value };
            }
            return sub;
          }) || []
        };
      }
      return ele;
    });
    qc.setQueryData(LIST_KEY, newData);
  };

  const handleMenuNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newData = data.map(ele => {
      if (checkedFirstMenu === checked && ele.id === checked) {
        return { ...ele, name: e.target.value };
      }
      if (ele.id === checkedFirstMenu) {
        return {
          ...ele,
          sub_button: ele.sub_button?.map((sub: any) => {
            if (sub.id === checked) {
              return { ...sub, name: e.target.value };
            }
            return sub;
          }) || []
        };
      }
      return ele;
    });
    qc.setQueryData(LIST_KEY, newData);
  };

  const getCheckedMenu = () => {
    if (!checked) return null;
    if (checkedFirstMenu === checked) {
      return data.find(ele => ele.id === checked);
    } else {
      const firMenu = data.find(ele => ele.id === checkedFirstMenu);
      return firMenu?.sub_button?.find((sub: any) => sub.id === checked);
    }
  };

  const checkMenu = getCheckedMenu();

  return (
    <>
    <WxMpStatusBar />
    <Box sx={{ p: { xs: 1.5, md: 2 } }}>
      <Typography variant="h5" sx={{ mb: 2 }}>微信菜单</Typography>

      <Box sx={{ display: 'flex', gap: 2 }}>
        {/* Left: Menu Preview */}
        <Card sx={{ width: 300, p: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 2, textAlign: 'center' }}>公众号</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center', mb: 2 }}>
            {data.map((firMenu: any) => (
              <Box key={firMenu.id} sx={{ position: 'relative' }}>
                <Button
                  variant={checked === firMenu.id ? 'contained' : 'outlined'}
                  onClick={() => handleCheckMenu(firMenu.id, firMenu.id)}
                  sx={{ minWidth: 60 }}
                >
                  {firMenu.name}
                </Button>
                {checkedFirstMenu === firMenu.id && (
                  <Box sx={{ position: 'absolute', top: '100%', left: 0, mt: 1, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1, minWidth: 100, zIndex: 1 }}>
                    {firMenu.sub_button?.map((subMenu: any) => (
                      <Box key={subMenu.id}>
                        <Button
                          fullWidth
                          size="small"
                          onClick={() => handleCheckMenu(subMenu.id, firMenu.id)}
                          sx={{ justifyContent: 'flex-start' }}
                        >
                          {subMenu.name}
                        </Button>
                      </Box>
                    ))}
                    {firMenu.sub_button?.length < 5 && (
                      <Button size="small" startIcon={<AddIcon />} onClick={() => addSubMenu(firMenu)} sx={{ justifyContent: 'flex-start' }}>
                        添加
                      </Button>
                    )}
                  </Box>
                )}
              </Box>
            ))}
            {data.length < 3 && (
              <Button variant="outlined" startIcon={<AddIcon />} onClick={addFirstMenu}>
                添加
              </Button>
            )}
          </Box>
          <Button variant="outlined" fullWidth disabled={publishMutation.isPending} onClick={() => publishMutation.mutate(false)} sx={{ mb: 1 }}>仅保存</Button>
          <Button variant="contained" fullWidth disabled={publishMutation.isPending} onClick={dealPublish}>保存并发布到微信</Button>
        </Card>

        {/* Right: Menu Configuration */}
        <Card sx={{ flex: 1, p: 2 }}>
          {checked ? (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle1">菜单配置</Typography>
                <Button color="error" startIcon={<DeleteIcon />} onClick={deleteMenu}>删除</Button>
              </Box>
              <Box sx={{ mb: 2 }}>
                <TextField
                  label="菜单名称"
                  value={checkMenu?.name || ''}
                  onChange={handleMenuNameChange}
                  fullWidth
                />
              </Box>
              <Box sx={{ mb: 2 }}>
                <Select
                  label="菜单类型"
                  value={checkMenu?.type || ''}
                  onChange={(e) => handleTypeObjChange('type', e.target.value)}
                  fullWidth
                >
                  {menuOptions.map((ele) => (
                    <MenuItem key={ele.value} value={ele.value}>{ele.label}</MenuItem>
                  ))}
                </Select>
              </Box>
              {checkMenu?.type === 'view' && (
                <TextField
                  label="跳转链接"
                  value={checkMenu?.url || ''}
                  onChange={(e) => handleTypeObjChange('url', e.target.value)}
                  fullWidth
                  placeholder="请输入链接"
                />
              )}
              {checkMenu?.type === 'click' && (
                <TextField
                  label="点击后回复的文字"
                  value={checkMenu?.content || ''}
                  onChange={(e) => handleTypeObjChange('content', e.target.value)}
                  fullWidth
                  multiline
                  minRows={3}
                  helperText="用户点这个菜单时,公众号回复这段文字"
                />
              )}
              {checkMenu?.type === 'miniprogram' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="小程序的appid"
                    value={checkMenu?.appid || ''}
                    onChange={(e) => handleTypeObjChange('appid', e.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="小程序的页面路径"
                    value={checkMenu?.pagepath || ''}
                    onChange={(e) => handleTypeObjChange('pagepath', e.target.value)}
                    fullWidth
                    placeholder="如：pages/index"
                  />
                  <TextField
                    label="备用网页"
                    value={checkMenu?.url || ''}
                    onChange={(e) => handleTypeObjChange('url', e.target.value)}
                    fullWidth
                    placeholder="不支持小程序的老版本客户端将打开本网页"
                  />
                </Box>
              )}
            </Box>
          ) : (
            <Typography color="text.secondary">请选择菜单配置</Typography>
          )}
        </Card>
      </Box>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
    </>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import { clientGet, publish } from '@/apis/wx-mp-menu';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { v4 as uuidv4 } from 'uuid';

const menuOptions = [
  { value: 'view', label: '跳转网页' },
  { value: 'miniprogram', label: '跳转小程序' },
  { value: 'click', label: '点击回复' },
  { value: 'view_limited', label: '跳转图文消息' },
  { value: 'scancode_push', label: '扫码直接返回结果' },
  { value: 'scancode_waitmsg', label: '扫码回复' },
  { value: 'pic_sysphoto', label: '系统拍照发图' },
  { value: 'pic_photo_or_album', label: '拍照或者相册' },
  { value: 'pic_weixin', label: '微信相册' },
  { value: 'location_select', label: '选择地理位置' },
];

export default function WxMpMenuPage() {
  const [data, setData] = useState<any[]>([]);
  const [checkedFirstMenu, setCheckedFirstMenu] = useState<any>(null);
  const [checked, setChecked] = useState<any>('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => setSnackbar({ open: true, message, severity });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await clientGet({ mpAppId: 'qingqiuyue' });
      setData(res.data?.buttons || []);
    } catch (err: any) {
      showMessage(err.message || '获取数据失败', 'error');
    }
  };

  const dealPublish = async () => {
    try {
      await publish({
        buttons: data,
        mpAppId: 'qingqiuyue',
      });
      showMessage('保存并发布菜单成功');
    } catch (err: any) {
      showMessage(err.message || '发布失败', 'error');
    }
  };

  const addFirstMenu = () => {
    if (data.length >= 3) {
      showMessage('最多只能添加3个一级菜单', 'error');
      return;
    }
    const newData = [...data, { name: '一级菜单', id: uuidv4(), sub_button: [], type: '' }];
    setData(newData);
  };

  const addSubMenu = (firMenu: any) => {
    const newData = data.map(ele => {
      if (ele.id === firMenu.id) {
        return { ...ele, sub_button: [...(ele.sub_button || []), { name: '子菜单', id: uuidv4(), type: '' }] };
      }
      return ele;
    });
    setData(newData);
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
    setData(newData);
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
    setData(newData);
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
    setData(newData);
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
    <Box sx={{ p: 2 }}>
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
          <Button variant="contained" fullWidth onClick={dealPublish}>保存并发布菜单</Button>
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
  );
}

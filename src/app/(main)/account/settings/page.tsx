'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Avatar from '@mui/material/Avatar';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import { useApp } from '@/contexts/AppContext';
import { updateUser, upload } from '@/apis/account';
import { isNameAvail } from '@/apis/user';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

export default function AccountSettingsPage() {
  const { currentUser } = useApp();
  const [tab, setTab] = useState(0);
  const [formValues, setFormValues] = useState({
    name: currentUser?.name || '',
    nickname: currentUser?.nickname || '',
    info: currentUser?.info || '',
    avatar: currentUser?.avatar || '',
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleChange = (field: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      await upload(formData);
      showMessage('头像上传成功');
    } catch (err: any) {
      showMessage(err.message || '上传失败', 'error');
    }
  };

  const handleSubmit = async () => {
    try {
      await updateUser(formValues);
      showMessage('保存成功');
    } catch (err: any) {
      showMessage(err.message || '保存失败', 'error');
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ mb: 3 }}>设置</Typography>
        <Card>
          <CardContent>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
              <Tab label="基本设置" />
              <Tab label="安全设置" />
              <Tab label="账号绑定" />
              <Tab label="通知设置" />
            </Tabs>

            <TabPanel value={tab} index={0}>
              <Box sx={{ display: 'flex', gap: 4 }}>
                <Box sx={{ flex: 1, maxWidth: 500 }}>
                  <Box sx={{ mb: 3 }}>
                    <TextField
                      fullWidth
                      label="用户名"
                      value={formValues.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      helperText="用户名长度3-20位"
                    />
                  </Box>
                  <Box sx={{ mb: 3 }}>
                    <TextField
                      fullWidth
                      label="昵称"
                      value={formValues.nickname}
                      onChange={(e) => handleChange('nickname', e.target.value)}
                    />
                  </Box>
                  <Box sx={{ mb: 3 }}>
                    <TextField
                      fullWidth
                      label="个人简介"
                      multiline
                      rows={3}
                      value={formValues.info}
                      onChange={(e) => handleChange('info', e.target.value)}
                    />
                  </Box>
                  <Button variant="contained" onClick={handleSubmit}>
                    保存
                  </Button>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>头像</Typography>
                  <Avatar
                    src={currentUser?.avatar || '/no_avatar.webp'}
                    sx={{ width: 100, height: 100, mb: 2 }}
                  />
                  <Button variant="outlined" component="label">
                    上传头像
                    <input type="file" hidden accept="image/*" onChange={handleAvatarUpload} />
                  </Button>
                </Box>
              </Box>
            </TabPanel>

            <TabPanel value={tab} index={1}>
              <Box sx={{ maxWidth: 500 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>安全设置</Typography>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2">修改密码</Typography>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    定期修改密码可以提高账号安全性
                  </Typography>
                  <Button variant="outlined" sx={{ mt: 1 }}>
                    修改密码
                  </Button>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2">绑定手机</Typography>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    已绑定: {currentUser?.phone || '未绑定'}
                  </Typography>
                  <Button variant="outlined" sx={{ mt: 1 }}>
                    {currentUser?.phone ? '更换手机' : '绑定手机'}
                  </Button>
                </Box>
              </Box>
            </TabPanel>

            <TabPanel value={tab} index={2}>
              <Box sx={{ maxWidth: 500 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>账号绑定</Typography>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2">微信</Typography>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    绑定微信后可快速登录
                  </Typography>
                  <Button variant="outlined" sx={{ mt: 1 }}>
                    绑定微信
                  </Button>
                </Box>
              </Box>
            </TabPanel>

            <TabPanel value={tab} index={3}>
              <Box sx={{ maxWidth: 500 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>通知设置</Typography>
                <Typography color="text.secondary">
                  通知设置功能开发中...
                </Typography>
              </Box>
            </TabPanel>
          </CardContent>
        </Card>
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}

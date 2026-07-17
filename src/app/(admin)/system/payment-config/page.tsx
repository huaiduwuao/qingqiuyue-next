'use client';

import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Collapse from '@mui/material/Collapse';
import AlertTitle from '@mui/material/AlertTitle';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LinkIcon from '@mui/icons-material/Link';

// 支付配置 API
const paymentConfigAPI = {
  get: async () => {
    const res = await fetch('/api/admin/payment/config');
    return res.json();
  },
  save: async (data: any) => {
    const res = await fetch('/api/admin/payment/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
};

interface PaymentConfig {
  // 微信登录
  wxLoginAppId: string;
  wxLoginAppSecret: string;
  wxLoginRedirectUri: string;
  // 微信支付
  wechatAppId: string;
  wechatAppSecret: string;
  wechatMchId: string;
  wechatApiV3Key: string;
  wechatSerialNo: string;
  wechatPrivateKey: string;
  wechatNotifyUrl: string;
  // 支付宝
  alipayAppId: string;
  alipayPrivateKey: string;
  alipayPublicCert: string;
  alipayNotifyUrl: string;
  alipayIsProd: boolean;
}

const DEFAULT_CONFIG: PaymentConfig = {
  wxLoginAppId: '',
  wxLoginAppSecret: '',
  wxLoginRedirectUri: '',
  wechatAppId: '',
  wechatAppSecret: '',
  wechatMchId: '',
  wechatApiV3Key: '',
  wechatSerialNo: '',
  wechatPrivateKey: '',
  wechatNotifyUrl: '',
  alipayAppId: '',
  alipayPrivateKey: '',
  alipayPublicCert: '',
  alipayNotifyUrl: '',
  alipayIsProd: false,
};

export default function PaymentConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState(0);
  const [config, setConfig] = useState<PaymentConfig>(DEFAULT_CONFIG);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await paymentConfigAPI.get();
      if (res.code === 0 && res.data) {
        setConfig({ ...DEFAULT_CONFIG, ...res.data });
      }
    } catch (err) {
      console.error('加载支付配置失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await paymentConfigAPI.save(config);
      showMessage('配置保存成功');
    } catch (err) {
      showMessage('保存失败: ' + (err instanceof Error ? err.message : '未知错误'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof PaymentConfig, value: any) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const toggleSecret = (field: string) => {
    setShowSecrets((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const isWxLoginValid = () => config.wxLoginAppId && config.wxLoginAppSecret;
  const isWechatPayValid = () => config.wechatAppId && config.wechatMchId && config.wechatApiV3Key && config.wechatPrivateKey;
  const isAlipayValid = () => config.alipayAppId && config.alipayPrivateKey && config.alipayPublicCert;

  const InputPassword = ({ label, field, value, onChange, placeholder, helper }: {
    label: string;
    field: keyof PaymentConfig;
    value: string;
    onChange: (v: any) => void;
    placeholder?: string;
    helper?: string;
  }) => (
    <TextField
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      fullWidth
      multiline={field === 'wechatPrivateKey' || field === 'alipayPrivateKey' || field === 'alipayPublicCert'}
      rows={field === 'wechatPrivateKey' || field === 'alipayPrivateKey' || field === 'alipayPublicCert' ? 6 : 1}
      type={showSecrets[field] ? 'text' : 'password'}
      placeholder={placeholder}
      helperText={helper}
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton onClick={() => setShowSecrets((p) => ({ ...p, [field]: !p[field] }))} edge="end" size="small">
                {showSecrets[field] ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 } }}>
      <Typography variant="h5" sx={{ mb: 1 }}>微信 & 支付配置</Typography>
      <Typography color="text.secondary" sx={{ mb: 3, fontSize: 13 }}>
        配置微信公众号登录、微信支付、支付宝。敏感信息请妥善保管。
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="微信登录" icon={<CloudDoneIcon fontSize="small" />} iconPosition="start" />
        <Tab label="微信支付" icon={<CloudDoneIcon fontSize="small" />} iconPosition="start" />
        <Tab label="支付宝" icon={<CloudDoneIcon fontSize="small" />} iconPosition="start" />
      </Tabs>

      {/* 微信登录配置 */}
      {tab === 0 && (
        <Card sx={{ maxWidth: 800 }}>
          <CardHeader
            title="微信公众号登录配置"
            avatar={isWxLoginValid() ? <CloudDoneIcon color="success" /> : <CloudOffIcon color="disabled" />}
            titleTypographyProps={{ variant: 'h6' }}
          />
          <CardContent>
            <Collapse in={!isWxLoginValid()}>
              <Alert severity="info" sx={{ mb: 2 }}>
                <AlertTitle>配置说明</AlertTitle>
                微信登录需要使用微信开放平台账号。前往{' '}
                <strong>微信开放平台</strong> (open.weixin.qq.com) 注册网站应用，获取 AppID 和 AppSecret。
              </Alert>
            </Collapse>

            <Alert severity="warning" icon={<WarningRoundedIcon />} sx={{ mb: 3 }}>
              <AlertTitle>重要提示</AlertTitle>
              回调地址格式: <code>https://你的域名/api/core/oauth/wechat/callback</code>，
              需在微信开放平台应用设置中填写此地址。
            </Alert>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                label="AppID"
                value={config.wxLoginAppId}
                onChange={(e) => handleChange('wxLoginAppId', e.target.value)}
                fullWidth
                placeholder="在开放平台应用详情页获取"
                helperText="微信开放平台网站应用的 AppID"
                slotProps={{
                  input: {
                    startAdornment: <InputAdornment position="start"><LinkIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment>,
                  },
                }}
              />

              <InputPassword
                label="AppSecret"
                field="wxLoginAppSecret"
                value={config.wxLoginAppSecret}
                onChange={(v) => handleChange('wxLoginAppSecret', v)}
                placeholder="在开放平台应用详情页获取"
                helper="微信开放平台网站应用的 AppSecret，请勿泄露"
              />

              <Divider />

              <TextField
                label="回调地址 (Redirect URI)"
                value={config.wxLoginRedirectUri}
                onChange={(e) => handleChange('wxLoginRedirectUri', e.target.value)}
                fullWidth
                placeholder="https://your-domain.com/api/core/oauth/wechat/callback"
                helperText="此地址需在微信开放平台应用设置中配置"
              />

              <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>配置步骤：</Typography>
                <Typography component="ol" sx={{ pl: 2, m: 0, color: 'text.secondary', fontSize: 13 }}>
                  <li>访问 <strong>open.weixin.qq.com</strong> 注册并登录</li>
                  <li>创建「网站应用」，填写应用基本信息</li>
                  <li>在应用设置中配置「网站回调域」</li>
                  <li>将回调地址填入上方输入框（格式见提示框）</li>
                  <li>将 AppID 和 AppSecret 填入上方对应输入框</li>
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* 微信支付配置 */}
      {tab === 1 && (
        <Card sx={{ maxWidth: 800 }}>
          <CardHeader
            title="微信支付配置"
            avatar={isWechatPayValid() ? <CloudDoneIcon color="success" /> : <CloudOffIcon color="disabled" />}
            titleTypographyProps={{ variant: 'h6' }}
          />
          <CardContent>
            <Collapse in={!isWechatPayValid()}>
              <Alert severity="info" sx={{ mb: 2 }}>
                <AlertTitle>配置说明</AlertTitle>
                微信支付需要使用微信支付商户号。前往 <strong>微信支付商户平台</strong> (pay.weixin.qq.com) 申请接入。
              </Alert>
            </Collapse>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                label="公众号 AppID"
                value={config.wechatAppId}
                onChange={(e) => handleChange('wechatAppId', e.target.value)}
                fullWidth
                placeholder="wx开头"
                helperText="关联到商户号的公众号 AppID"
              />

              <InputPassword
                label="公众号 AppSecret"
                field="wechatAppSecret"
                value={config.wechatAppSecret}
                onChange={(v) => handleChange('wechatAppSecret', v)}
                helper="在公众号设置中获取"
              />

              <Divider sx={{ my: 1 }} />

              <TextField
                label="商户号 (MchID)"
                value={config.wechatMchId}
                onChange={(e) => handleChange('wechatMchId', e.target.value)}
                fullWidth
                placeholder="在商户平台获取"
              />

              <InputPassword
                label="API v3 密钥"
                field="wechatApiV3Key"
                value={config.wechatApiV3Key}
                onChange={(v) => handleChange('wechatApiV3Key', v)}
                placeholder="32位字符"
                helper="在商户平台 - API安全 中设置 v3 密钥"
              />

              <TextField
                label="证书序列号 (SerialNo)"
                value={config.wechatSerialNo}
                onChange={(e) => handleChange('wechatSerialNo', e.target.value)}
                fullWidth
                placeholder="在商户平台获取证书后查看"
              />

              <InputPassword
                label="商户私钥 (PKCS8 PEM)"
                field="wechatPrivateKey"
                value={config.wechatPrivateKey}
                onChange={(v) => handleChange('wechatPrivateKey', v)}
                placeholder="-----BEGIN PRIVATE KEY-----"
                helper="在商户平台下载证书后，从 apiclient_key.pem 读取内容"
              />

              <Divider sx={{ my: 1 }} />

              <TextField
                label="支付回调地址"
                value={config.wechatNotifyUrl}
                onChange={(e) => handleChange('wechatNotifyUrl', e.target.value)}
                fullWidth
                placeholder="https://your-domain.com/api/core/payment/notify/wechat"
                helperText="微信支付成功后会回调此地址，需公网可访问"
              />

              <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>配置步骤：</Typography>
                <Typography component="ol" sx={{ pl: 2, m: 0, color: 'text.secondary', fontSize: 13 }}>
                  <li>访问 <strong>pay.weixin.qq.com</strong> 登录商户号</li>
                  <li>在「账户设置 - API安全」中设置 APIv3 密钥</li>
                  <li>下载证书，获取证书序列号和私钥文件</li>
                  <li>将回调地址配置到商户平台的「支付配置」中</li>
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* 支付宝配置 */}
      {tab === 2 && (
        <Card sx={{ maxWidth: 800 }}>
          <CardHeader
            title="支付宝配置"
            avatar={isAlipayValid() ? <CloudDoneIcon color="success" /> : <CloudOffIcon color="disabled" />}
            titleTypographyProps={{ variant: 'h6' }}
          />
          <CardContent>
            <Collapse in={!isAlipayValid()}>
              <Alert severity="info" sx={{ mb: 2 }}>
                <AlertTitle>配置说明</AlertTitle>
                支付宝支付需要使用支付宝开放平台账号。前往 <strong>支付宝开放平台</strong> (open.alipay.com) 申请应用。
              </Alert>
            </Collapse>

            <Alert severity="warning" icon={<WarningRoundedIcon />} sx={{ mb: 3 }}>
              <AlertTitle>重要提示</AlertTitle>
              支付宝配置需要使用 RSA2 密钥，密钥格式为 PKCS8。推荐使用沙箱环境测试后再切换到生产环境。
            </Alert>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                label="应用 AppID"
                value={config.alipayAppId}
                onChange={(e) => handleChange('alipayAppId', e.target.value)}
                fullWidth
                placeholder="在开放平台应用详情页获取"
              />

              <InputPassword
                label="应用私钥 (PKCS8 PEM)"
                field="alipayPrivateKey"
                value={config.alipayPrivateKey}
                onChange={(v) => handleChange('alipayPrivateKey', v)}
                placeholder="-----BEGIN RSA PRIVATE KEY----- 或 -----BEGIN PRIVATE KEY-----"
                helper="使用支付宝密钥工具生成，格式选择 PKCS8"
              />

              <Divider sx={{ my: 1 }} />

              <InputPassword
                label="支付宝公钥证书内容 (PEM)"
                field="alipayPublicCert"
                value={config.alipayPublicCert}
                onChange={(v) => handleChange('alipayPublicCert', v)}
                placeholder="-----BEGIN CERTIFICATE-----"
                helper="从支付宝开放平台下载应用公钥证书"
              />

              <Divider sx={{ my: 1 }} />

              <TextField
                label="支付回调地址"
                value={config.alipayNotifyUrl}
                onChange={(e) => handleChange('alipayNotifyUrl', e.target.value)}
                fullWidth
                placeholder="https://your-domain.com/api/core/payment/notify/alipay"
                helperText="支付宝成功后会回调此地址，需公网可访问"
              />

              <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>配置步骤：</Typography>
                <Typography component="ol" sx={{ pl: 2, m: 0, color: 'text.secondary', fontSize: 13 }}>
                  <li>访问 <strong>open.alipay.com</strong> 创建应用</li>
                  <li>在「开发设置」中生成 RSA2 密钥（选择 PKCS8）</li>
                  <li>配置应用公钥，获取支付宝公钥证书</li>
                  <li>将回调地址配置到应用设置中</li>
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}
        >
          {saving ? '保存中...' : '保存配置'}
        </Button>
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
    </Box>
  );
}

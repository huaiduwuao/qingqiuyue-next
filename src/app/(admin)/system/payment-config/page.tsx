'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import { adminClient, formatApiError } from '@/lib/api/client';

// 支付配置(只读)
//
// 以前这是一张可编辑表单,但「保存」只写进 core-api 进程内存:真正收款的 paymentapp 从来只读环境变量,
// 重启就丢;GET 回来的密钥是打码的,原样再存一次还会把缓存里的密钥覆盖成 abcd****wxyz。
// 支付密钥属于服务器机密,不该经网页明文往返,所以这里改成只读:展示每个通道读到了哪些环境变量、
// 网关客户端有没有真正初始化成功。要改,编辑服务器 docker/.env 后重启 core-api。
//
// 微信登录(网站应用 / 移动应用 / 公众号 / 小程序)在「系统 → 微信配置」。

interface PaymentConfig {
  wechatAppId?: string;
  wechatAppSecret?: string;
  wechatMchId?: string;
  wechatApiV3Key?: string;
  wechatSerialNo?: string;
  wechatPrivateKey?: string;
  wechatNotifyUrl?: string;
  alipayAppId?: string;
  alipayPrivateKey?: string;
  alipayPublicCert?: string;
  alipayNotifyUrl?: string;
  alipayIsProd?: boolean;
}

type Row = { env: string; field: keyof PaymentConfig; label: string; required?: boolean };

const WECHAT_ROWS: Row[] = [
  { env: 'WECHAT_APP_ID', field: 'wechatAppId', label: '关联 AppID(公众号/网站应用)', required: true },
  { env: 'WECHAT_MCH_ID', field: 'wechatMchId', label: '商户号', required: true },
  { env: 'WECHAT_API_V3_KEY', field: 'wechatApiV3Key', label: 'APIv3 密钥', required: true },
  { env: 'WECHAT_SERIAL_NO', field: 'wechatSerialNo', label: '商户证书序列号', required: true },
  { env: 'WECHAT_PRIVATE_KEY', field: 'wechatPrivateKey', label: '商户私钥 apiclient_key.pem', required: true },
  { env: 'WECHAT_NOTIFY_URL', field: 'wechatNotifyUrl', label: '回调地址', required: true },
  { env: 'WECHAT_APP_SECRET', field: 'wechatAppSecret', label: 'AppSecret(JSAPI 取 openid 用)' },
];

const ALIPAY_ROWS: Row[] = [
  { env: 'ALIPAY_APP_ID', field: 'alipayAppId', label: '应用 AppID', required: true },
  { env: 'ALIPAY_PRIVATE_KEY', field: 'alipayPrivateKey', label: '应用私钥(PKCS8)', required: true },
  { env: 'ALIPAY_PUBLIC_CERT', field: 'alipayPublicCert', label: '支付宝公钥证书', required: true },
  { env: 'ALIPAY_NOTIFY_URL', field: 'alipayNotifyUrl', label: '回调地址', required: true },
];

function ChannelCard({ title, ready, rows, config, extra }: {
  title: string;
  ready: boolean;
  rows: Row[];
  config: PaymentConfig;
  extra?: React.ReactNode;
}) {
  return (
    <Card sx={{ maxWidth: 800, mb: 3 }}>
      <CardHeader
        title={title}
        avatar={ready ? <CloudDoneIcon color="success" /> : <CloudOffIcon color="disabled" />}
        action={<Chip size="small" color={ready ? 'success' : 'default'} label={ready ? '已开通' : '未开通'} sx={{ mt: 1, mr: 1 }} />}
        titleTypographyProps={{ variant: 'h6' }}
      />
      <CardContent sx={{ pt: 0 }}>
        <Table size="small">
          <TableBody>
            {rows.map((r) => {
              const v = config[r.field];
              const set = typeof v === 'string' && v !== '';
              return (
                <TableRow key={r.env}>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{r.env}</TableCell>
                  <TableCell sx={{ fontSize: 13 }}>{r.label}{r.required ? '' : '(可选)'}</TableCell>
                  <TableCell sx={{ fontSize: 12, fontFamily: 'monospace', color: set ? 'text.primary' : r.required ? 'error.main' : 'text.disabled', wordBreak: 'break-all' }}>
                    {set ? (v as string) : '未设置'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {extra}
      </CardContent>
    </Card>
  );
}

export default function PaymentConfigPage() {
  const cfgQuery = useQuery({
    queryKey: ['admin', 'payment-config'],
    queryFn: async () => (await adminClient<PaymentConfig | null>('/payment/config')) ?? {},
  });
  const chQuery = useQuery({
    queryKey: ['payment', 'channels'],
    queryFn: async () => (await adminClient<{ wechat?: boolean; alipay?: boolean } | null>('/payment/channels')) ?? {},
  });

  if (cfgQuery.isLoading || chQuery.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <CircularProgress />
      </Box>
    );
  }

  const config = cfgQuery.data || {};
  const ch = chQuery.data || {};
  const err = cfgQuery.error || chQuery.error;

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 } }}>
      <Typography variant="h5" sx={{ mb: 1 }}>支付配置</Typography>
      <Typography color="text.secondary" sx={{ mb: 2, fontSize: 13 }}>
        钻石充值、会员购买走这里的微信支付 / 支付宝通道。微信登录请到 <strong>系统 → 微信配置</strong>。
      </Typography>

      {err && <Alert severity="error" sx={{ mb: 2, maxWidth: 800 }}>加载失败:{formatApiError(err)}</Alert>}

      <Alert severity="info" sx={{ mb: 3, maxWidth: 800 }}>
        <AlertTitle>怎么修改</AlertTitle>
        支付密钥只放在服务器上,不经网页保存。编辑服务器上 qingqiuyue-go 的 <code>docker/.env</code>,
        填入下表的环境变量,然后重启 core-api。密钥多行内容(PEM)可写成一行并用 <code>\n</code> 表示换行。
        「已开通」表示 core-api 启动时网关客户端初始化成功,充值页才会显示该通道。
      </Alert>

      <ChannelCard
        title="微信支付"
        ready={!!ch.wechat}
        rows={WECHAT_ROWS}
        config={config}
        extra={
          <Typography sx={{ mt: 1.5, fontSize: 12, color: 'text.secondary' }}>
            回调验签:新商户用「微信支付公钥」,另设 <code>WECHAT_PAY_PUBLIC_KEY</code> 和 <code>WECHAT_PAY_PUBLIC_KEY_ID</code>;
            不设则自动下载平台证书。回调地址填 <code>https://qingqiuyue.com/api/core/payment/notify/wechat</code>。
          </Typography>
        }
      />
      <ChannelCard
        title="支付宝"
        ready={!!ch.alipay}
        rows={ALIPAY_ROWS}
        config={config}
        extra={
          <Typography sx={{ mt: 1.5, fontSize: 12, color: 'text.secondary' }}>
            <code>ALIPAY_IS_PROD</code> = {config.alipayIsProd ? 'true(正式环境)' : 'false(沙箱)'}。
            回调地址填 <code>https://qingqiuyue.com/api/core/payment/notify/alipay</code>。
          </Typography>
        }
      />
    </Box>
  );
}

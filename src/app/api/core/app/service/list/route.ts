/**
 * GET /api/core/app/service/list
 * 后端网关未实现此接口时, Next.js 路由优先于 rewrite 拦截, 返回 mock 数据。
 */

const APP_SERVICES = [
  { id: 1, name: '阿里云 OSS', provider: 'aliyun', endpoint: 'https://oss-cn-hangzhou.aliyuncs.com', bucket: 'douyin-oss', status: 'ENABLED' },
  { id: 2, name: '腾讯云 COS', provider: 'tencent', endpoint: 'https://cos.ap-shanghai.myqcloud.com', bucket: 'douyin-125', status: 'ENABLED' },
  { id: 3, name: '七牛云存储', provider: 'qiniu', endpoint: 'https://upload.qiniup.com', bucket: 'douyin-qiniu', status: 'ENABLED' },
  { id: 4, name: '短信服务', provider: 'aliyun', endpoint: 'https://dysmsapi.aliyuncs.com', bucket: '', status: 'ENABLED' },
  { id: 5, name: '邮件服务', provider: 'tencent', endpoint: 'https://dm.aliyuncs.com', bucket: '', status: 'ENABLED' },
  { id: 6, name: '支付服务', provider: 'alipay', endpoint: 'https://openapi.alipay.com', bucket: '', status: 'ENABLED' },
];

export async function GET() {
  return Response.json({
    code: 200,
    msg: 'OK',
    data: { list: APP_SERVICES, total: APP_SERVICES.length },
  });
}

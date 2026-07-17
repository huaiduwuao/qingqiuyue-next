import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/api/client';

// GET /api/admin/payment/config - 获取支付配置
export async function GET() {
  try {
    const res = await adminClient.get('/payment/config');
    return NextResponse.json(res.data);
  } catch (err: any) {
    console.error('获取支付配置失败:', err);
    return NextResponse.json(
      { code: 1, msg: err.message || '获取失败' },
      { status: 500 }
    );
  }
}

// POST /api/admin/payment/config - 保存支付配置
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await adminClient.post('/payment/config', body);
    return NextResponse.json(res.data);
  } catch (err: any) {
    console.error('保存支付配置失败:', err);
    return NextResponse.json(
      { code: 1, msg: err.message || '保存失败' },
      { status: 500 }
    );
  }
}

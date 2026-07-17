import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// 后端 API 地址
const API_BASE = process.env.API_PROXY_TARGET || 'http://localhost:10005';

// GET /api/admin/payment/config - 获取支付配置
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value || '';

    const res = await fetch(`${API_BASE}/api/core/payment/config`, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    const data = await res.json();
    return NextResponse.json(data);
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
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value || '';
    const body = await req.json();

    const res = await fetch(`${API_BASE}/api/core/payment/config`, {
      method: 'POST',
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('保存支付配置失败:', err);
    return NextResponse.json(
      { code: 1, msg: err.message || '保存失败' },
      { status: 500 }
    );
  }
}

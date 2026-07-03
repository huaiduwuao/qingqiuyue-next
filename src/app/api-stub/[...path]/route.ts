/**
 * /api-stub catch-all — 当后端网关不可用时(next.config.ts rewrites 把 /api/* 转发到这里),
 * 返回合法空数据响应, 避免 404 / 500 / ECONNREFUSED 拖垮 dev server。
 *
 * 响应格式对齐后端约定: { code: 200, msg: 'OK', data: ... }
 * 分页端点返回 { records: [], totalRow: 0, list: [], total: 0 }
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const last = path[path.length - 1];
  const fullPath = path.join('/');

  // 分页端点
  if (last === 'page') {
    return Response.json({
      code: 200,
      msg: 'OK',
      data: { records: [], totalRow: 0, list: [], total: 0, page: 1, pageSize: 20 },
    });
  }

  // 列表端点
  if (last === 'list' || last === 'all' || last === 'listApp') {
    return Response.json({
      code: 200,
      msg: 'OK',
      data: { list: [], total: 0 },
    });
  }

  // suggest 端点
  if (last === 'suggest' || last === 'suggestUser' || last === 'suggestPermission') {
    return Response.json({ code: 200, msg: 'OK', data: [] });
  }

  // 统计数据端点
  if (
    fullPath.includes('dashboard') ||
    fullPath.includes('stats') ||
    fullPath.includes('chart')
  ) {
    return Response.json({ code: 200, msg: 'OK', data: {} });
  }

  // 通用成功响应
  return Response.json({ code: 200, msg: 'OK', data: {} });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  void params;
  return Response.json({ code: 200, msg: 'OK', data: { id: 0 } });
}

export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  void params;
  return Response.json({ code: 200, msg: 'OK', data: { updated: 1 } });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  void params;
  return Response.json({ code: 200, msg: 'OK', data: { removed: 1 } });
}

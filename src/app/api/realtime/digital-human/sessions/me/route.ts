/**
 * /api/realtime/digital-human/sessions/me
 * 数字人会话管理
 */

export const dynamic = 'force-static';

// 内存存储会话（生产环境应该用数据库）
const sessions = new Map<string, {
  userId: string;
  positionX: number;
  positionZ: number;
  yOffset: number;
  scene: string;
  updatedAt: string;
}>();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');

  if (!userId) {
    return Response.json({ session: null });
  }

  const session = sessions.get(userId);
  return Response.json({ session: session || null });
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { userId, positionX = 0, positionZ = 0, yOffset = 0, scene = 'concert' } = body;

    if (!userId) {
      return Response.json({ error: 'userId required' }, { status: 400 });
    }

    const session = {
      userId,
      positionX,
      positionZ,
      yOffset,
      scene,
      updatedAt: new Date().toISOString(),
    };

    sessions.set(userId, session);
    return Response.json({ session });
  } catch (e) {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

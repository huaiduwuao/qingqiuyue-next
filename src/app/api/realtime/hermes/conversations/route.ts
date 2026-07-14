/**
 * /api/realtime/hermes/conversations
 * 会话列表 API
 */

export const dynamic = 'force-static';

// 内存存储（生产环境用数据库）
const conversations = new Map<string, Array<{
  id: string;
  userId: string;
  title: string;
  lastMessageAt: string;
  createdAt: string;
}>>();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  const limit = parseInt(url.searchParams.get('limit') || '20');

  if (!userId || userId === '0') {
    return Response.json({ data: [], total: 0 });
  }

  const userConversations = conversations.get(userId) || [];
  const result = userConversations.slice(-limit).reverse();

  return Response.json({
    data: result,
    total: userConversations.length,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, title = '新对话' } = body;

    if (!userId) {
      return Response.json({ error: 'userId required' }, { status: 400 });
    }

    const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const conv = {
      id,
      userId,
      title,
      lastMessageAt: now,
      createdAt: now,
    };

    const userConversations = conversations.get(userId) || [];
    userConversations.push(conv);
    conversations.set(userId, userConversations);

    return Response.json({ data: conv });
  } catch (e) {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

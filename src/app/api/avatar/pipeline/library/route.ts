import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { getUserFromRequest, unauthorizedResponse } from '@/lib/avatar-pipeline/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LIB_PATH = path.join(process.cwd(), 'public', 'avatars', 'library', 'library.json');

// GET /api/avatar/pipeline/library —— 列出预制二次元角色
// 任何登录用户都能看(只读,公开内容)
export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return unauthorizedResponse();

  if (!existsSync(LIB_PATH)) {
    return NextResponse.json({
      version: 1,
      characters: [],
      msg: 'library.json 不存在 —— 请先跑 blender scripts/blender/build_anime_avatar.py 生成预制角色',
    });
  }
  try {
    const text = readFileSync(LIB_PATH, 'utf8');
    const data = JSON.parse(text);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { error: 'parse_failed', msg: `library.json 解析失败: ${e?.message || e}` },
      { status: 500 },
    );
  }
}

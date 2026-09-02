import { NextRequest, NextResponse } from 'next/server';

const API_TARGET = process.env.API_PROXY_TARGET ?? "http://10.9.1.2:10005";

// 测试用 B站视频（不需要浏览器解析）
const DEMO_VIDEO_URL = "https://www.bilibili.com/video/BV1ZG4y1v7TL";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const types = searchParams.get('types')?.toUpperCase();
  const size = parseInt(searchParams.get('size') || '10');

  // 转发请求到后端
  const resp = await fetch(`${API_TARGET}/api/content/recommend/feed${request.nextUrl.search}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!resp.ok) {
    return NextResponse.json({ code: 500, msg: '后端请求失败' }, { status: 500 });
  }

  const data = await resp.json();

  // 如果是 VIDEO 类型，尝试获取真实播放地址
  if (types === 'VIDEO' && data?.data?.list) {
    const processedList = await Promise.all(
      data.data.list.slice(0, size).map(async (item: any) => {
        // 从 metadata 提取 sourceUrl
        let sourceUrl = DEMO_VIDEO_URL;
        let cover = item.cover || 'https://picsum.photos/800/450';

        if (item.metadata) {
          try {
            const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
            if (meta.source_url && (meta.source_url.includes('douyin.com') || meta.source_url.includes('bilibili.com'))) {
              // 调用 stream resolve API 获取真实播放地址
              const resolveResp = await fetch(
                `${API_TARGET}/api/content/stream/resolve?url=${encodeURIComponent(meta.source_url)}`,
                { cache: 'no-store' }
              );
              if (resolveResp.ok) {
                const resolveData = await resolveResp.json();
                if (resolveData.code === 200 && resolveData.data?.defaultStream?.url) {
                  sourceUrl = resolveData.data.defaultStream.url;
                }
              }
            }
            // 使用 metadata 中的 cover
            if (meta.cover_url) {
              cover = meta.cover_url;
            }
          } catch (e) {
            // 解析 metadata 失败，使用默认值
          }
        }

        return {
          ...item,
          sourceUrl,
          cover,
        };
      })
    );

    data.data.list = processedList;
  }

  return NextResponse.json(data);
}

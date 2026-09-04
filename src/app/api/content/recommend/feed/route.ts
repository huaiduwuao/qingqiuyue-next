import { NextRequest, NextResponse } from 'next/server';

const API_TARGET = process.env.API_PROXY_TARGET ?? "http://10.9.1.2:10005";

// 测试用 B站视频（不需要浏览器解析）
const DEMO_VIDEO_URL = "https://www.bilibili.com/video/BV1ZG4y1v7TL";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
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

  // 为每条item补充可播放地址:凡是带 metadata.source_url 的条目(短视频/短剧等,
  // 不局限于单一 contentType)都尝试实时解析。平台分发交给后端 stream/resolve
  // (配置驱动 module_stream_parser),这里不再按域名白名单预筛——新平台入库即用,
  // 不用同步改前端。
  if (data?.data?.list) {
    const processedList = await Promise.all(
      data.data.list.slice(0, size).map(async (item: any) => {
        let sourceUrl = '';
        let cover = item.cover || '';

        if (item.metadata) {
          try {
            const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
            if (meta.source_url) {
              sourceUrl = meta.source_url; // 兜底:即便解析失败也保留原页面URL,而不是替换成无关的演示视频
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
            // 解析 metadata 失败，保留上面已设置的兜底值
          }
        }

        // 完全没有 source_url 时(极少数缺元数据的旧条目)才用演示视频兜底，
        // 保证播放器至少有内容可展示，而不是让真实条目被顶替。
        if (!sourceUrl) {
          sourceUrl = DEMO_VIDEO_URL;
        }
        if (!cover) {
          cover = 'https://picsum.photos/800/450';
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

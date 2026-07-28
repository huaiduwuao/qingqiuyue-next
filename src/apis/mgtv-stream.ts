interface MgtvStreamResponse {
  code: number;
  data?: {
    stream?: Array<{
      name: string;
      url: string;
      needPay: number;
      videoFormat: string;
      fileFormat: string;
      standardName: string;
      videoWidth: string;
      videoHeight: string;
    }>;
    stream_h265?: Array<{
      name: string;
      url: string;
      needPay: number;
      videoFormat: string;
      fileFormat: string;
      standardName: string;
      videoWidth: string;
      videoHeight: string;
      disp?: {
        info: string;
      };
    }>;
    stream_domain?: string[];
    info?: {
      video_id: string;
      duration: string;
      title: string;
    };
  };
  msg?: string;
}

/**
 * 调用芒果 TV 流媒体接口获取 m3u8 播放地址
 */
export async function parseMgtvStream(bid: string, cid: string) {
  if (!bid || !cid) {
    return { code: 400, msg: '缺少 bid 或 cid 参数' };
  }

  try {
    const did = generateRandomId(32);
    const suuid = generateRandomId(36);

    const url = new URL('https://pcweb.api.mgtv.com/video/streamList');
    url.searchParams.set('playType', '1');
    url.searchParams.set('auth_mode', '1');
    url.searchParams.set('definitionType', '2');
    url.searchParams.set('definition', '2');
    url.searchParams.set('fileSourceType', '1');
    url.searchParams.set('video_id', cid);
    url.searchParams.set('did', did);
    url.searchParams.set('suuid', suuid);
    url.searchParams.set('vf', 'av01,h265,h264');
    url.searchParams.set('cxid', '');
    url.searchParams.set('entranceType', '0');
    url.searchParams.set('type', 'pch5');
    url.searchParams.set('_support', '10000000');
    url.searchParams.set('src', 'mgtv');
    url.searchParams.set('abroad', '0');
    url.searchParams.set('appVersion', '9.0.4');
    url.searchParams.set('allowedRC', '1');

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
        'Origin': 'https://www.mgtv.com',
        'Referer': 'https://www.mgtv.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      return { code: 502, msg: `芒果TV接口响应错误: ${response.status}` };
    }

    const data: MgtvStreamResponse = await response.json();

    if (data.code !== 200) {
      return { code: data.code, msg: data.msg || '芒果TV接口返回错误' };
    }

    const streams = data.data?.stream || [];
    const streamsH265 = data.data?.stream_h265 || [];
    const domains = data.data?.stream_domain || ['https://web-disp.titan.mgtv.com'];

    const allStreams = [...streams, ...streamsH265];

    const availableStreams = allStreams
      .filter(s => s.url && s.url.length > 10)
      .map(s => ({
        name: s.name,
        quality: s.standardName || s.name,
        resolution: `${s.videoWidth}x${s.videoHeight}`,
        url: buildM3u8Url(s.url, domains[0]),
        needPay: s.needPay === 1,
        format: s.videoFormat,
      }));

    if (availableStreams.length === 0) {
      return {
        code: 0,
        msg: '该视频可能需要VIP或无法解析',
        data: {
          videoId: cid,
          bid: bid,
          streams: [],
          info: data.data?.info,
        },
      };
    }

    availableStreams.sort((a, b) => {
      const aRes = parseInt(a.resolution.split('x')[0]) || 0;
      const bRes = parseInt(b.resolution.split('x')[0]) || 0;
      return bRes - aRes;
    });

    return {
      code: 0,
      msg: 'success',
      data: {
        videoId: cid,
        bid: bid,
        streams: availableStreams,
        defaultStream: availableStreams[0],
        info: data.data?.info,
      },
    };

  } catch (error) {
    console.error('MGTV stream parse error:', error);
    return { code: 500, msg: `解析失败: ${error instanceof Error ? error.message : '未知错误'}` };
  }
}

function buildM3u8Url(tokenUrl: string, domain: string): string {
  if (!tokenUrl) return '';
  if (tokenUrl.startsWith('http')) return tokenUrl;
  return `${domain}${tokenUrl}`;
}

function generateRandomId(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

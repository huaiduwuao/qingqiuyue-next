/**
 * mediaUrl —— 把后端返回的图片/音频/视频地址，改写成"经 APISIX 网关"的可用地址。
 *
 * 线上只有 APISIX 对外暴露，浏览器能直接打开的只有本站同源路径（nginx 把
 * /api、/ws、/logs、/qq-* 全部转给 APISIX）。但库里的地址有两类打不开：
 *
 *  1) MinIO 内网直链 `http://10.9.1.2:10000/qq-media/...`
 *     —— 10000 端口不对外，外网访问必然 ERR_CONNECTION_TIMED_OUT。
 *     bucket 名就是路径第一段，所以只要把 origin 去掉、留下 `/qq-media/...`，
 *     就会走同源 → nginx → APISIX → minio:9000（见 apisix.yaml 的 minio 上游）。
 *
 *  2) 第三方站点的图片 `http://i2.hdslb.com/...`（爬虫抓来的封面）
 *     —— 一是 http 混合内容会被 https 页面拦掉，二是不少站点校验 Referer 直接 403。
 *     统一包一层 `/api/proxy?url=`（后端 StreamProxyHandler，会按域名补 Referer）。
 *
 * 后端 MINIO_PUBLIC_BASE 已经改成网关域名，新数据本来就是对的；这里主要兜住
 * 存量数据，以及任何还没跟着改的服务。已经是同源/相对路径的地址原样返回。
 */

/** MinIO public bucket —— 与后端 pkg/storage 的常量一一对应,匿名可读。 */
const PUBLIC_BUCKETS = ['qq-media', 'qq-audio', 'qq-video', 'qq-text'];

/**
 * private bucket:地址是后端签的 presigned URL。
 * SigV4 把 Host 算进签名,所以这类地址一个字都不能改 —— 既不能换 host,
 * 也不能包进 /api/proxy(那会给私有对象加上 public 缓存头)。原样返回。
 */
const PRIVATE_BUCKETS = ['qq-avatar', 'qq-tmp'];

/**
 * 网关基地址,与 lib/api/client.ts 的 API_GATEWAY 同一约定:
 * Web 同源部署时为空串(走相对路径,nginx 转 APISIX);桌面端(Tauri)页面
 * 是本地 origin,必须带上绝对域名才能拿到远端资源。
 */
const GATEWAY = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

/** 路径第一段的 bucket 名（`/qq-media/image/...` → `qq-media`）。 */
function bucketOf(pathname: string): string {
  return pathname.replace(/^\/+/, '').split('/')[0];
}

export function mediaUrl(raw?: string | null): string {
  if (!raw) return '';
  const url = raw.trim();
  if (!url) return '';

  // data:/blob: 原样用。
  if (/^(data:|blob:)/i.test(url)) return url;
  // 已经是相对路径:public bucket 路径补网关前缀(桌面端需要绝对地址),
  // 其它相对路径(前端自己的 /images/xxx 等本地资源)不动。
  if (url.startsWith('/')) {
    return PUBLIC_BUCKETS.includes(bucketOf(url.split('?')[0])) ? GATEWAY + url : url;
  }
  if (!/^https?:\/\//i.test(url)) return url;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  // 同源：本来就走网关，不动。
  if (typeof window !== 'undefined' && parsed.origin === window.location.origin) {
    return url;
  }

  const bucket = bucketOf(parsed.pathname);

  // presigned URL:签名绑死了 Host，一个字都不能动。
  if (PRIVATE_BUCKETS.includes(bucket)) return url;

  // public bucket 直链（任意 host）：只保留 /<bucket>/<key>，交给网关。
  if (PUBLIC_BUCKETS.includes(bucket)) return GATEWAY + parsed.pathname + parsed.search;

  // 其余外站资源：走后端代理（补 Referer + 消除混合内容）。
  return `${GATEWAY}/api/proxy?url=${encodeURIComponent(url)}`;
}

/** 绝对 URL 且路径第一段是 public bucket —— 也就是"一条 MinIO 直链"。 */
function isPublicBucketUrl(s: string): boolean {
  if (s.length > 2048 || !/^https?:\/\//i.test(s)) return false;
  try {
    return PUBLIC_BUCKETS.includes(bucketOf(new URL(s).pathname));
  } catch {
    return false;
  }
}

/** 遍历深度上限:响应结构再深也不至于此,纯粹防环形引用打死递归。 */
const MAX_WALK_DEPTH = 12;

/**
 * normalizeMediaUrls —— 就地深度遍历接口响应，把 MinIO 直链改写成网关地址。
 *
 * 为什么放在响应层而不是各个渲染点:图片不只经过 CoverImage,还有几十处
 * `<Avatar src>`、`<Box component="img">`,字段名也五花八门(cover/coverUrl/
 * avatar/banner/images[]…)。这些地址的共同点只有一个——host 是内网 MinIO,
 * 谁都打不开。与其在每个渲染点补一次,不如在数据进来的地方一次改干净。
 *
 * 刻意只做这一种改写:
 *  - 只碰"绝对 URL + 路径第一段是 public bucket"的字符串,等于一次纯换 host,
 *    不存在改错的可能(这种地址本来就 100% 不可达)。
 *  - 不碰 private bucket:presigned URL 的签名绑死 Host,改了必然 403。
 *  - 不把外站地址包进 /api/proxy:响应里还有 sourceUrl 这类"要拿去解析的
 *    页面地址",包了会让播放器解析不出流。外站图的代理留在渲染点(mediaUrl)做。
 *
 * 与 applyAliases 一样就地改对象(响应体是刚反序列化出来的临时对象)。
 */
export function normalizeMediaUrls(value: unknown, depth = 0): void {
  if (!value || typeof value !== 'object' || depth > MAX_WALK_DEPTH) return;

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      if (typeof item === 'string') {
        if (isPublicBucketUrl(item)) value[i] = mediaUrl(item);
      } else {
        normalizeMediaUrls(item, depth + 1);
      }
    }
    return;
  }

  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (typeof v === 'string') {
      if (isPublicBucketUrl(v)) obj[key] = mediaUrl(v);
    } else {
      normalizeMediaUrls(v, depth + 1);
    }
  }
}

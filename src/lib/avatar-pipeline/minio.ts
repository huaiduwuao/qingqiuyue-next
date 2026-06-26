/**
 * avatar-pipeline minio.ts —— MinIO 客户端单例 + presigned URL helpers
 *
 * 桶布局(见 plan):
 *   uploads/<jobId>/input.mp4
 *   mixamo/<jobId>/*.fbx
 *   events/<jobId>.ndjson          (append-only)
 *   artifacts/<jobId>/model.glb
 *   artifacts/<jobId>/outfits/*.glb
 *   state/<jobId>.json             (durable snapshot)
 *
 * 注意:
 *   - MINIO_ENDPOINT 是 Next.js 进程内部用的(同 Docker 网络或同机)
 *   - MINIO_PUBLIC_ENDPOINT 是浏览器直传 presigned URL 时用的(公网可达)
 *   - 桶是 private,所有下载经 Next.js 代理(/api/.../artifacts/...)
 */

import { Client as MinioClient } from 'minio';

const ENDPOINT = process.env.MINIO_ENDPOINT || 'minio';
const PORT = parseInt(process.env.MINIO_PORT || '9000', 10);
const USE_SSL = process.env.MINIO_USE_SSL === 'true';
const ACCESS_KEY = process.env.MINIO_ACCESS_KEY || '';
const SECRET_KEY = process.env.MINIO_SECRET_KEY || '';
export const BUCKET = process.env.MINIO_BUCKET || 'qingqiuyue-avatars';

const PUBLIC_HOST = process.env.MINIO_PUBLIC_ENDPOINT || `localhost:${PORT}`;
const PUBLIC_USE_SSL = process.env.MINIO_PUBLIC_USE_SSL === 'true';

let _client: MinioClient | null = null;
let _bucketReady = false;

function getClient(): MinioClient {
  if (_client) return _client;
  if (!ACCESS_KEY || !SECRET_KEY) {
    throw new Error('MINIO_ACCESS_KEY / MINIO_SECRET_KEY 未配置;复制 .env.example 到 .env.local');
  }
  _client = new MinioClient({
    endPoint: ENDPOINT,
    port: PORT,
    useSSL: USE_SSL,
    accessKey: ACCESS_KEY,
    secretKey: SECRET_KEY,
  });
  return _client;
}

/** 惰性建桶(幂等)。模块加载时不建,首次需要时建。 */
export async function ensureBucket(): Promise<void> {
  if (_bucketReady) return;
  const c = getClient();
  const exists = await c.bucketExists(BUCKET);
  if (!exists) {
    await c.makeBucket(BUCKET, 'us-east-1');
  }
  _bucketReady = true;
}

/**
 * 浏览器直传用:返回一个 presigned PUT URL(1h 有效)。
 * 浏览器直接 PUT,字节不经过 Next.js。
 */
export async function presignedPutUrl(key: string, expiresInSec = 3600): Promise<string> {
  await ensureBucket();
  const c = getClient();
  // 协议头要匹配 public endpoint(浏览器会用)
  const proto = PUBLIC_USE_SSL ? 'https' : 'http';
  // minio 库生成的是基于内网 endpoint 的 URL,我们需要替换为公网 host
  const internal = await c.presignedPutObject(BUCKET, key, expiresInSec);
  // 替换 host
  return internal
    .replace(/^https?:\/\/[^/]+/, `${proto}://${PUBLIC_HOST}`);
}

/**
 * 下载用(内部 Node 调用):拿一个临时 GET URL(15 分钟有效)。
 * 主要给 Blender / bash 脚本拉 input.mp4 用。
 */
export async function presignedGetUrl(key: string, expiresInSec = 900): Promise<string> {
  await ensureBucket();
  const c = getClient();
  return c.presignedGetObject(BUCKET, key, expiresInSec);
}

/** Node 内部:流式上传 Buffer/Stream 到 MinIO */
export async function putObject(
  key: string,
  body: Buffer | import('stream').Readable,
  contentType: string,
  size?: number,
): Promise<void> {
  await ensureBucket();
  const c = getClient();
  await c.putObject(BUCKET, key, body, size, { 'Content-Type': contentType });
}

/** Node 内部:把本地文件上传到 MinIO */
export async function putFile(
  key: string,
  localPath: string,
  contentType: string,
): Promise<void> {
  await ensureBucket();
  const c = getClient();
  await c.fPutObject(BUCKET, key, localPath, { 'Content-Type': contentType });
}

/** Node 内部:把本地目录递归上传到 MinIO prefix */
export async function putDir(localDir: string, prefix: string): Promise<string[]> {
  const fs = await import('fs/promises');
  const path = await import('path');
  const uploaded: string[] = [];

  async function walk(dir: string, basePrefix: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const rel = path.join(basePrefix, e.name).replace(/\\/g, '/');
      if (e.isDirectory()) {
        await walk(full, rel);
      } else {
        await putFile(rel, full, 'application/octet-stream');
        uploaded.push(rel);
      }
    }
  }

  await walk(localDir, prefix);
  return uploaded;
}

/** Node 内部:从 MinIO 下载对象到本地文件 */
export async function getFile(key: string, localPath: string): Promise<void> {
  const fs = await import('fs/promises');
  const path = await import('path');
  await fs.mkdir(path.dirname(localPath), { recursive: true });
  const c = getClient();
  await c.fGetObject(BUCKET, key, localPath);
}

/** Node 内部:追加一行到 ndjson(append-only 事件流) */
export async function appendNdjson(key: string, obj: unknown): Promise<void> {
  const c = getClient();
  const line = JSON.stringify(obj) + '\n';
  // MinIO 没有原生 append,用 putObject 覆盖(单行场景,频率不高)
  // 如果想支持并发 append,需要用 lock + read-modify-write
  // 这里简单粗暴:每次都 putObject 整个文件
  // 生产实现建议用 Redis 或 Postgres 做事件流
  // 先读老内容
  let existing = '';
  try {
    const stream = await c.getObject(BUCKET, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Buffer>) {
      chunks.push(chunk);
    }
    existing = Buffer.concat(chunks).toString('utf8');
  } catch (e: any) {
    if (e?.code !== 'NoSuchKey' && e?.code !== 'NotFound') {
      throw e;
    }
    // 文件不存在,existing 留空
  }
  await putObject(key, Buffer.from(existing + line, 'utf8'), 'application/x-ndjson');
}

/** Node 内部:读 ndjson 全部行 */
export async function readNdjson<T = unknown>(key: string): Promise<T[]> {
  const c = getClient();
  const out: T[] = [];
  try {
    const stream = await c.getObject(BUCKET, key);
    let buf = '';
    for await (const chunk of stream as AsyncIterable<Buffer>) {
      buf += chunk.toString('utf8');
    }
    for (const line of buf.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        out.push(JSON.parse(trimmed) as T);
      } catch {
        // 忽略坏行
      }
    }
  } catch (e: any) {
    if (e?.code !== 'NoSuchKey' && e?.code !== 'NotFound') {
      throw e;
    }
  }
  return out;
}

/** Node 内部:从 MinIO 读对象(返回 Buffer) */
export async function getObjectBuffer(key: string): Promise<Buffer | null> {
  const c = getClient();
  try {
    const stream = await c.getObject(BUCKET, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Buffer>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (e: any) {
    if (e?.code === 'NoSuchKey' || e?.code === 'NotFound') return null;
    throw e;
  }
}

/** Node 内部:对象 stat */
export async function statObject(key: string): Promise<{ size: number; contentType: string } | null> {
  const c = getClient();
  try {
    const s = await c.statObject(BUCKET, key);
    return {
      size: s.size,
      contentType: (s.metaData && (s.metaData['content-type'] || s.metaData['Content-Type'])) || 'application/octet-stream',
    };
  } catch (e: any) {
    if (e?.code === 'NoSuchKey' || e?.code === 'NotFound') return null;
    throw e;
  }
}

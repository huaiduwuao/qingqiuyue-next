#!/usr/bin/env node
// 零依赖静态服务器:给 e2e 静态冒烟(playwright.static.config.ts)伺服 `out/`。
//
// 路径解析与 nginx.conf 的 `try_files $uri $uri.html $uri/index.html` 一致:
//   /home/recommend → out/home/recommend(文件)→ out/home/recommend.html → out/home/recommend/index.html
// 都找不到就回 out/404.html(状态码 404)。/api/* 不在这里处理 —— 冒烟用例里全部由 page.route 拦截。
//
// 用法:node scripts/serve-static.mjs [dir=out] [port=4173]
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] || process.env.STATIC_DIR || 'out');
const port = Number(process.argv[3] || process.env.PORT || 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.vrm': 'application/octet-stream',
  '.webmanifest': 'application/manifest+json',
};

async function fileAt(p) {
  // 防目录穿越:解析后必须仍在 root 内
  if (p !== root && !p.startsWith(root + sep)) return null;
  try {
    const s = await stat(p);
    return s.isFile() ? { path: p, size: s.size } : null;
  } catch {
    return null;
  }
}

async function resolveUri(pathname) {
  const base = join(root, pathname);
  const candidates = pathname.endsWith('/')
    ? [join(base, 'index.html')]
    : [base, `${base}.html`, join(base, 'index.html')];
  for (const c of candidates) {
    const f = await fileAt(c);
    if (f) return f;
  }
  return null;
}

function send(req, res, status, file) {
  const type = TYPES[extname(file.path).toLowerCase()] || 'application/octet-stream';
  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
  // <video> 要靠 Range 请求才能 seek
  const range = status === 200 && req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
  if (range && file.size > 0) {
    let start = range[1] === '' ? file.size - Number(range[2]) : Number(range[1]);
    let end = range[1] !== '' && range[2] !== '' ? Number(range[2]) : file.size - 1;
    start = Math.max(0, start);
    end = Math.min(end, file.size - 1);
    if (start > end) {
      res.writeHead(416, { 'Content-Range': `bytes */${file.size}` });
      res.end();
      return;
    }
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${file.size}`, 'Content-Length': end - start + 1 });
    if (req.method === 'HEAD') return void res.end();
    createReadStream(file.path, { start, end }).pipe(res);
    return;
  }
  res.writeHead(status, { ...headers, 'Content-Length': file.size });
  if (req.method === 'HEAD') return void res.end();
  createReadStream(file.path).pipe(res);
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end();
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url || '/', 'http://x').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  const hit = await resolveUri(pathname);
  if (hit) return send(req, res, 200, hit);
  const notFound = await fileAt(join(root, '404.html'));
  if (notFound) return send(req, res, 404, notFound);
  res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not Found');
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[serve-static] ${root} → http://127.0.0.1:${port}`);
});

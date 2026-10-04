/**
 * 原生 HTTP(tauri-plugin-http):浏览器不许页面自己设的请求头(Referer / Origin / Cookie / User-Agent)
 * 和跨域限制,在这里都不存在。只在客户端里可用;能请求哪些域名由 capabilities 里的 http 权限限定
 * (src-tauri/capabilities/default.json),服务器下发的规则出不了这个范围。
 *
 * 没有引 @tauri-apps/plugin-http 这个 npm 包:它只是下面这 4 个 IPC 调用的薄封装,
 * 这里直接用 withGlobalTauri 暴露的 window.__TAURI__.core.invoke(与 lib/clientAuth 同一做法)。
 * 协议照 plugin-http 2.6.1 的 dist-js 写,Rust 侧 crate 固定在 ~2.6(src-tauri/Cargo.toml),两边一起升。
 */

import { isDesktopClient } from '@/lib/clientAuth';

type Invoke = <T = unknown>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

function invoke(): Invoke {
  const t = (window as unknown as { __TAURI__?: { core?: { invoke?: Invoke } } }).__TAURI__;
  if (!t?.core?.invoke) throw new Error('原生 HTTP 不可用(不在客户端里)');
  return t.core.invoke;
}

export function nativeAvailable(): boolean {
  return isDesktopClient();
}

export async function nativeFetch(url: string, init: { headers?: Record<string, string>; signal?: AbortSignal } = {}): Promise<Response> {
  const call = invoke();
  const { signal } = init;
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const rid = await call<number>('plugin:http|fetch', {
    clientConfig: {
      method: 'GET',
      url,
      headers: Object.entries(init.headers ?? {}),
      data: null,
      connectTimeout: 15000,
    },
  });
  const cancel = () => void call('plugin:http|fetch_cancel', { rid }).catch(() => {});
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    const res = await call<{ status: number; statusText: string; headers: [string, string][]; rid: number }>('plugin:http|fetch_send', { rid });
    // 响应体按块读:每块最后一个字节是结束标记(1 = 读完)
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      if (signal?.aborted) {
        void call('plugin:http|fetch_cancel_body', { rid: res.rid }).catch(() => {});
        throw new DOMException('Aborted', 'AbortError');
      }
      const raw = await call<ArrayBuffer | number[]>('plugin:http|fetch_read_body', { rid: res.rid });
      const data = raw instanceof ArrayBuffer ? new Uint8Array(raw) : Uint8Array.from(raw);
      const done = data[data.byteLength - 1] === 1;
      const part = data.subarray(0, data.byteLength - 1);
      if (part.byteLength) {
        chunks.push(part);
        total += part.byteLength;
      }
      if (done) break;
    }
    const body = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      body.set(c, off);
      off += c.byteLength;
    }
    const nullBody = [101, 103, 204, 205, 304].includes(res.status);
    return new Response(nullBody ? null : body, { status: res.status, statusText: res.statusText, headers: new Headers(res.headers) });
  } finally {
    signal?.removeEventListener('abort', cancel);
  }
}

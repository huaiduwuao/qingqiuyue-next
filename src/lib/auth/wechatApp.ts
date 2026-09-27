/**
 * 安卓客户端的微信 App SDK 登录(微信开放平台「移动应用」)。
 *
 * 1. POST /oauth/wx/app/start → 后端发移动应用的 appId + 一次性 state(和我们自己的 client_state 绑定)
 * 2. window.QQNative.wxLogin(appId, state) → 跳到微信,用户点「同意」
 * 3. 微信回到 App(WXEntryActivity)→ window.__qqWxAuthResult({errCode, code, state})
 * 4. POST /oauth/wx/app/login {code, state, client_state} → 会话
 *
 * 原生那一半在 src-tauri/gen/android/.../WechatLogin.kt。没装微信、或后台没配移动应用(/auth/options.wechatApp)
 * 时不走这里,仍是系统浏览器里的扫码页。
 */
import { adminClient } from '@/lib/api/client';
import { authPlatform } from '@/lib/clientAuth';

interface QQNative {
  wxInstalled(): boolean;
  wxLogin(appId: string, state: string): boolean;
}

interface WxAuthResult {
  errCode: number;
  code: string;
  state: string;
  errStr?: string;
}

declare global {
  interface Window {
    QQNative?: QQNative;
    __qqWxAuthResult?: (r: WxAuthResult) => void;
  }
}

/** 用户在微信里点了取消 / 拒绝:调用方不必提示错误。 */
export class WechatAppCancelled extends Error {}

/** 这台设备能不能走 SDK 登录:安卓客户端 + 有原生接口 + 装了微信。 */
export function canWechatAppLogin(): boolean {
  if (typeof window === 'undefined' || authPlatform() !== 'android') return false;
  try {
    return !!window.QQNative?.wxInstalled();
  } catch {
    return false;
  }
}

function randomHex(bytes: number): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** 等微信回到 App;用户在微信里一直不回来就 5 分钟后放弃。 */
function waitForResult(timeoutMs = 5 * 60_000): Promise<WxAuthResult> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      window.__qqWxAuthResult = undefined;
      reject(new WechatAppCancelled('微信登录超时'));
    }, timeoutMs);
    window.__qqWxAuthResult = (r) => {
      window.clearTimeout(timer);
      window.__qqWxAuthResult = undefined;
      resolve(r);
    };
  });
}

/** 走完整个 SDK 登录,返回会话 ID。用户取消抛 WechatAppCancelled,其余失败抛带中文说明的 Error。 */
export async function wechatAppLogin(from: string): Promise<string> {
  const native = window.QQNative;
  if (!native) throw new Error('当前版本不支持微信一键登录,请更新客户端');
  const clientState = randomHex(24);
  const start = await adminClient<{ appId: string; state: string }>('/oauth/wx/app/start', {
    method: 'POST',
    data: { platform: 'android', client_state: clientState, from },
  });
  if (!start?.appId || !start?.state) throw new Error('微信登录暂不可用');

  const result = waitForResult();
  if (!native.wxLogin(start.appId, start.state)) {
    window.__qqWxAuthResult = undefined;
    throw new Error('打不开微信,请确认已安装并登录微信');
  }
  const r = await result;
  if (r.errCode === -2 || r.errCode === -4) throw new WechatAppCancelled('已取消微信登录');
  if (r.errCode !== 0 || !r.code) throw new Error(`微信授权失败(${r.errCode}${r.errStr ? ` ${r.errStr}` : ''})`);
  // 微信原样带回我们给的 state;对不上说明不是这次发起的回调
  if (r.state !== start.state) throw new Error('微信登录状态不一致,请重试');

  const resp = await adminClient<{ session_id?: string; sessionId?: string }>('/oauth/wx/app/login', {
    method: 'POST',
    data: { code: r.code, state: start.state, client_state: clientState },
  });
  const sessionId = resp?.session_id ?? resp?.sessionId ?? '';
  if (!sessionId) throw new Error('微信登录失败,请重试');
  return sessionId;
}

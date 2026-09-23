// 微信登录的 state:防登录 CSRF(别人把自己的会话塞给你)。
//
// 发起授权前生成一个随机 state 存进 sessionStorage,作为 client_state 带给后端,后端把它和回跳的
// 一次性 code 绑在一起;回调页用 code 换会话时再把 state 交上去,对不上后端就拒绝。
// 本浏览器没发起过登录 → 手里没有 state → 直接拒绝。
// 没有这道校验时,任何人发一条 /user/social-login/wx?session_id=<攻击者的会话>(或 qingqiuyue:// deep link)
// 就能让受害者悄悄登进攻击者的账号,之后上传的东西、填的收款信息全进了攻击者那边。

const STORAGE_KEY = 'wx_oauth_state';
/** 扫码 + 授权通常一两分钟;给足 10 分钟 */
const TTL_MS = 10 * 60 * 1000;

interface Pending {
  state: string;
  ts: number;
}

function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function readPending(): Pending | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Pending;
    if (typeof p?.state !== 'string' || typeof p?.ts !== 'number') return null;
    if (Date.now() - p.ts > TTL_MS) return null;
    return p;
  } catch {
    return null;
  }
}

/** 发起微信授权前调用:生成并记住本次的 state。 */
export function createOauthState(): string {
  const state = randomState();
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ state, ts: Date.now() } satisfies Pending));
  } catch {
    /* 隐私模式等写不进去:回调时对不上,会提示重新登录 */
  }
  return state;
}

/** 本浏览器是否有一次还没用掉、没过期的微信登录(deep link 转发前先看一眼,不消费)。 */
export function hasPendingOauthState(): boolean {
  return readPending() !== null;
}

/**
 * 取出并清除本次登录的 state,一次性:同一个 state 不能用第二次。
 * 回跳地址不带 state(后端把它和一次性 code 绑在一起),换会话时由前端交给后端核对;
 * 本浏览器没发起过登录(或已过期)时返回 null —— 那就是别人塞过来的链接。
 */
export function consumeOauthState(): string | null {
  const p = readPending();
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return p?.state ?? null;
}

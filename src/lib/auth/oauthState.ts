// 微信登录的 state:防登录 CSRF(别人把自己的会话塞给你)。
//
// 发起授权前生成一个随机 state 存进 sessionStorage,并带给后端;后端回跳时原样带回。
// 回调页只认「本浏览器自己发起、还没过期」的那一次登录:state 对不上 → 拒绝。
// 否则任何人发一条 /user/social-login/wx?session_id=<攻击者的会话>(或 qingqiuyue:// deep link)
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

/**
 * 回跳带回的 state 是否就是本浏览器发起的那次(不消费,deep link 转发前先看一眼用)。
 * received 为 null 表示回跳没带 state(老后端只带 session_id):只要本浏览器确实发起过登录就放行。
 */
export function matchesOauthState(received: string | null): boolean {
  const p = readPending();
  if (!p) return false;
  return received === null || received === p.state;
}

/** 校验并清除本次 state,一次性:同一个 state 不能用第二次。 */
export function consumeOauthState(received: string | null): boolean {
  const ok = matchesOauthState(received);
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return ok;
}

import { reportBehavior } from '@/apis/recommend';
import { contentClient, homeClient } from '@/lib/api/client';
import { reportClientError, safeErrorLog } from './error-handler';
import { toEntityId } from './id';
import { getAuthToken } from '@/lib/api/auth';
import { API_PREFIX } from '@/lib/api/prefix';

// 推荐/大数据的源头:前端行为埋点(fire-and-forget,失败不影响业务)。
// 不传 userId:用户由后端按登录会话认定。以前从 localStorage 的 userId/uid 读(正常登录根本不写),
// 客户端可控的 userId 只会让人伪造别人的行为、刷别人的榜单。

/** 检查用户是否已登录 */
function isLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  const hasToken = !!getAuthToken();
  if (!hasToken) {
    console.debug('[track] 未登录，跳过埋点');
  }
  return hasToken;
}

// 浏览器级匿名访客 id(随机生成,不含任何个人信息),只用于站点 UV 去重。
function visitorId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = localStorage.getItem('qq_vid');
    if (!id) {
      id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem('qq_vid', id);
    }
    return id;
  } catch {
    return ''; // 隐私模式等拿不到存储时照常上报 PV,只是不参与 UV 去重
  }
}

export function track(itemId: number | string, action: string, itemType = 'NOVEL', duration = 0) {
  // 未登录不发送埋点（隐私保护）
  if (!isLoggedIn()) return;
  // 内容 id 超 2^53,Number() 会截断成另一条内容;按字符串原样上报(见 lib/id.ts)
  const id = toEntityId(itemId);
  if (id === null) return;
  try {
    // itemType 统一大写:Doris module_content.content_type 为大写规范值,
    // user_behavior_log.target_type 必须与之同口径,榜单(按 target_type 聚合)才能匹配。
    void reportBehavior({ itemId: id, itemType: itemType.toUpperCase(), action, duration });
  } catch {
    /* 埋点失败静默 */
  }
}

// trackFinish 看完率埋点(适用于视频/小说/文章等有明确完播/读完概念的内容)
// contentId: 内容ID
// itemType: 内容类型
// duration: 实际观看/阅读时长(秒)
export function trackFinish(contentId: number | string, itemType = 'NOVEL', duration = 0) {
  track(contentId, 'finish', itemType, duration);
}

// 观看时长追踪 hook - 返回 stop 函数
// 用法: const stop = useWatchDuration(contentId, 'VIDEO'); // 视频
// 当用户离开页面或调用 stop() 时自动上报观看时长 + finish
export function useWatchDuration(contentId: number | string, itemType = 'NOVEL') {
  const startTime = Date.now();
  const id = toEntityId(contentId);

  return () => {
    if (!isLoggedIn()) return; // 未登录不记录
    const duration = Math.round((Date.now() - startTime) / 1000);
    if (id !== null && duration > 5) {
      track(id, 'view', itemType, duration);
      recordHistory(id);
    }
  };
}

// 观看历史:写 Doris user_content_collect(type=history),供 /me 历史 tab 读取。
// fire-and-forget,失败静默(未登录后端返 FailWithMsg,前端拦截器 reject 被这里吞掉)。
export function recordHistory(contentId: number | string) {
  if (!isLoggedIn()) return; // 未登录不记录历史
  const id = toEntityId(contentId);
  if (id === null) return;
  try {
    void homeClient.post('/history/record', { contentId: id }).catch((e) => safeErrorLog('recordHistory', e));
  } catch {
    /* 静默 */
  }
}

// trackPageView 上报页面曝光埋点(统计 PV/UV)。
// 在 layout 或页面组件 mount 时调用,fire-and-forget.
// 站点流量要算上未登录访客,所以这里不做登录校验;UV 按匿名访客 id 去重。
export function trackPageView(pathname: string, search = '') {
  const page = search ? `${pathname}${search}` : pathname;
  try {
    // 行为上报在 /api/content/behavior(recommendapp),homeClient 会拼成不存在的 /home/behavior。
    // 用户由后端按会话认定;pageview 落 page_view 表,不进推荐用的 behavior_event。
    void contentClient.post('/behavior', {
      itemType: 'PAGE',
      action: 'pageview',
      page,
      visitorId: visitorId(),
    }).catch((e) => safeErrorLog('trackPageView', e));
  } catch {
    /* 静默 */
  }
}

// trackRewardAction 悬赏相关行为埋点
export function trackRewardAction(action: 'view_demand' | 'claim_task' | 'submit_task' | 'review_task', targetId: number | string) {
  const id = toEntityId(targetId);
  if (id === null) return;
  try {
    void reportBehavior({
      itemId: id,
      itemType: 'REWARD',
      action,
      duration: 0,
    });
  } catch {
    /* 静默 */
  }
}

// trackCreatorAction 创作者相关行为埋点
export function trackCreatorAction(action: 'follow' | 'unfollow', targetUserId: number | string) {
  const id = toEntityId(targetUserId);
  if (id === null) return;
  try {
    void reportBehavior({
      itemId: id,
      itemType: 'CREATOR',
      action,
      duration: 0,
    });
  } catch {
    /* 静默 */
  }
}

// ──────────────────────────────────────────────────────────────────
// §5 / §7 搜索结果埋点 — 不走 isLoggedIn() 闸门(匿名也是合法点击来源)
// ──────────────────────────────────────────────────────────────────

/**
 * 搜索结果点击埋点。
 *
 * @param kw 当前搜索关键词
 * @param contentId 内容 id
 * @param contentType 类型(大写,如 FILM/MUSIC/NOVEL)
 * @param position 搜索结果中的位置(0-indexed)
 */
export function trackSearchClick(kw: string, contentId: number | string, contentType: string, position: number) {
  if (typeof window === 'undefined' || !kw) return;
  const id = toEntityId(contentId);
  if (id === null) return;
  try {
    void contentClient.post('/search/feedback', {
      keyword: kw,
      contentId: id,
      contentType: (contentType || '').toUpperCase(),
      position,
      visitorId: visitorId(),
      event: 'click',
    }).catch((e) => safeErrorLog('trackSearchClick', e));
  } catch (e) {
    reportClientError('trackSearchClick', e);
  }
}

/**
 * 搜索结果曝光埋点(IntersectionObserver 触发)。
 *
 * @param kw 当前搜索关键词
 * @param contentId 内容 id
 * @param position 搜索结果中的位置(0-indexed)
 */
export function trackSearchImpression(kw: string, contentId: number | string, position: number) {
  if (typeof window === 'undefined' || !kw) return;
  const id = toEntityId(contentId);
  if (id === null) return;
  try {
    void contentClient.post('/search/feedback', {
      keyword: kw,
      contentId: id,
      contentType: '',
      position,
      visitorId: visitorId(),
      event: 'impression',
    }).catch((e) => safeErrorLog('trackSearchImpression', e));
  } catch (e) {
    reportClientError('trackSearchImpression', e);
  }
}

/**
 * §6.3 EventSource 订阅 discover:events:<kw>,新增条目通过 onHit 回调返回。
 * 失败时 onError 触发,调用方应降级到轮询(老的 2.5s × 16 次)。
 */
export function subscribeSearchStream(
  kw: string,
  onHit: (h: { type: 'indexed' | 'done'; id?: number; title?: string; contentType?: string }) => void,
  onError: (e: Event) => void,
): () => void {
  if (typeof window === 'undefined' || !kw || typeof EventSource === 'undefined') {
    return () => {};
  }
  const url = `${API_PREFIX}/api/content/search/stream?q=${encodeURIComponent(kw)}`;
  const es = new EventSource(url);
  es.addEventListener('discover', (ev) => {
    try {
      const env = ev as MessageEvent;
      const outer = JSON.parse(env.data);
      const payload = outer?.payload ? JSON.parse(outer.payload) : null;
      if (!payload) return;
      onHit(payload);
    } catch {
      /* 静默 */
    }
  });
  es.onerror = (e) => {
    onError(e);
    es.close();
  };
  return () => es.close();
}

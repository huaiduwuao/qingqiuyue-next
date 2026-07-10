import { reportBehavior } from '@/apis/recommend';
import { homeClient } from '@/lib/api/client';

// 推荐/大数据的源头:前端行为埋点(fire-and-forget,失败不影响业务)。
// userId 取本地存储(匿名则 0,后端会回退热门 feed)。
function currentUserId(): number {
  if (typeof window === 'undefined') return 0;
  const raw = localStorage.getItem('userId') || localStorage.getItem('uid') || '';
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

export function track(itemId: number | string, action: string, itemType = 'NOVEL', duration = 0) {
  const id = Number(itemId);
  if (!id) return;
  try {
    // itemType 统一大写:Doris module_content.content_type 为大写规范值,
    // user_behavior_log.target_type 必须与之同口径,榜单(按 target_type 聚合)才能匹配。
    void reportBehavior({ userId: currentUserId(), itemId: id, itemType: itemType.toUpperCase(), action, duration });
  } catch {
    /* 埋点失败静默 */
  }
}

// 观看历史:写 Doris user_content_collect(type=history),供 /me 历史 tab 读取。
// fire-and-forget,失败静默(未登录后端返 FailWithMsg,前端拦截器 reject 被这里吞掉)。
export function recordHistory(contentId: number | string) {
  const id = Number(contentId);
  if (!id) return;
  try {
    void homeClient.post('/history/record', { contentId: id }).catch(() => {});
  } catch {
    /* 静默 */
  }
}

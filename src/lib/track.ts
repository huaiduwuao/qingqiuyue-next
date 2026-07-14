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
  const id = Number(contentId);

  return () => {
    const duration = Math.round((Date.now() - startTime) / 1000);
    if (id && duration > 5) {
      track(id, 'view', itemType, duration);
      recordHistory(id);
    }
  };
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

// trackPageView 上报页面曝光埋点(统计 PV/UV)。
// 在 layout 或页面组件 mount 时调用,fire-and-forget.
export function trackPageView(pathname: string, search = '') {
  const uid = currentUserId();
  const page = search ? `${pathname}${search}` : pathname;
  try {
    void homeClient.post('/behavior', {
      userId: uid,
      itemId: 0,
      itemType: 'PAGE',
      action: 'pageview',
      duration: 0,
    }).catch(() => {});
  } catch {
    /* 静默 */
  }
}

// trackRewardAction 悬赏相关行为埋点
export function trackRewardAction(action: 'view_demand' | 'claim_task' | 'submit_task' | 'review_task', targetId: number | string) {
  const id = Number(targetId);
  if (!id) return;
  try {
    void reportBehavior({
      userId: currentUserId(),
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
  const id = Number(targetUserId);
  if (!id) return;
  try {
    void reportBehavior({
      userId: currentUserId(),
      itemId: id,
      itemType: 'CREATOR',
      action,
      duration: 0,
    });
  } catch {
    /* 静默 */
  }
}

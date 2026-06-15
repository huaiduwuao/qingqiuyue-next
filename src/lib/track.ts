import { reportBehavior } from '@/apis/recommend';

// 推荐/大数据的源头:前端行为埋点(fire-and-forget,失败不影响业务)。
// userId 取本地存储(匿名则 0,后端会回退热门 feed)。
function currentUserId(): number {
  if (typeof window === 'undefined') return 0;
  const raw = localStorage.getItem('userId') || localStorage.getItem('uid') || '';
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

export function track(itemId: number | string, action: string, itemType = 'novel', duration = 0) {
  const id = Number(itemId);
  if (!id) return;
  try {
    void reportBehavior({ userId: currentUserId(), itemId: id, itemType, action, duration });
  } catch {
    /* 埋点失败静默 */
  }
}

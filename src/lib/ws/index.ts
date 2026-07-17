/**
 * WebSocket 统一接口
 * 支持多种实时数据：通知、私信、直播数据等
 */

// 导出客户端
export { WSClient, getWSClient, destroyWSClient, type WSMessage, type WSMessageType } from './client';
export type {
  NotificationPayload,
  DMPayload,
  LiveStatsPayload,
  WSConnectionState,
} from './client';

// 导出 Hooks
export { useNotification, type UseNotificationOptions, type UseNotificationReturn } from './useNotification';
export {
  useDirectMessage,
  useDMHistory,
  type UseDirectMessageOptions,
  type UseDirectMessageReturn,
  type UseDMHistoryOptions,
  type UseDMHistoryReturn,
  type DMSession,
} from './useDirectMessage';
export {
  useLiveStats,
  useLiveRanking,
  useRealtime,
  type UseLiveStatsOptions,
  type UseLiveStatsReturn,
  type UseLiveRankingOptions,
  type UseLiveRankingReturn,
  type UseRealtimeOptions,
  type UseRealtimeReturn,
  type LiveRoom,
  type LiveRankingItem,
} from './useLiveStats';
export type { NotificationItem } from './useNotification';

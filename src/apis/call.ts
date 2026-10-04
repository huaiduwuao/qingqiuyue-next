import { accountClient } from '@/lib/api/client';

// 一对一语音 / 视频通话(core-api /api/core/call/*,后端 internal/callapp)。
// 这里只有状态变更;SDP / ICE 走全站长连接的上行(realtime.send call.signal),媒体点对点直连不经服务器。

export type CallMedia = 'audio' | 'video';

export interface IceServer {
  urls: string[];
  username?: string;
  credential?: string;
}

export interface InviteResult {
  callId: string;
  /** 对方正在另一通电话里 —— 没有响铃,直接结束 */
  busy?: boolean;
  /** 对方此刻有没有长连接在线;不在线也会响(他可能马上打开 App),只是提示一下 */
  online: boolean;
  iceServers: IceServer[];
}

export async function inviteCall(calleeId: string | number, media: CallMedia, dev: string): Promise<InviteResult> {
  return (await accountClient('/call/invite', {
    method: 'POST',
    data: { calleeId: String(calleeId), media, dev },
  })) as InviteResult;
}

export async function getIceServers(): Promise<IceServer[]> {
  const r = (await accountClient('/call/ice')) as { iceServers?: IceServer[] };
  return r?.iceServers || [];
}

export async function acceptCall(callId: string, dev: string): Promise<{ iceServers: IceServer[] }> {
  return (await accountClient(`/call/${callId}/accept`, { method: 'POST', data: { dev } })) as { iceServers: IceServer[] };
}

export type EndReason = 'cancel' | 'timeout' | 'reject' | 'busy' | 'hangup' | 'failed';

export async function endCall(callId: string, reason: EndReason): Promise<void> {
  await accountClient(`/call/${callId}/end`, { method: 'POST', data: { reason } });
}

/** 私信里的通话记录(dm_message.type = 'call' 的 content)。 */
export interface CallRecord {
  media: CallMedia;
  result: 'done' | 'missed' | 'rejected' | 'busy' | 'failed';
  seconds: number;
}

export function callRecordText(r: CallRecord, mine: boolean): string {
  const kind = r.media === 'video' ? '视频通话' : '语音通话';
  switch (r.result) {
    case 'done': {
      const m = Math.floor(r.seconds / 60);
      const s = r.seconds % 60;
      return `${kind} ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    case 'missed':
      return mine ? `${kind} 对方未接听` : `${kind} 未接来电`;
    case 'rejected':
      return mine ? `${kind} 对方已拒绝` : `${kind} 已拒绝`;
    case 'busy':
      return mine ? `${kind} 对方忙线` : `${kind} 忙线未接`;
    default:
      return `${kind} 未接通`;
  }
}

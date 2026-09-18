'use client';

/**
 * 全站推送的接线板:挂在根 Providers 里,登录后建立唯一一条长连接,把收到的事件
 * 翻译成 react-query 的缓存失效 + 一条右下角提示。
 *
 * 组件侧因此不需要认识 WebSocket —— 它们照常 useQuery,只是不再需要 refetchInterval。
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useAuth } from '@/contexts/AuthContext';
import { useHomeSettings } from '@/hooks/useHomeSettings';
import { realtime, type DMEventData, type KfEventData, type NoticeEventData, type RealtimeEvent } from '@/lib/realtime';

/** 一条右下角提示。 */
interface Toast {
  key: number;
  title: string;
  body: string;
  avatar?: string;
  href?: string;
}

/** 互动消息类型 → 设置页里对应的开关。没列到的(点赞等)一律展示。 */
const NOTICE_TOGGLE: Record<string, 'notifMention' | 'notifComment' | 'notifFollow'> = {
  mention: 'notifMention',
  comment: 'notifComment',
  follow: 'notifFollow',
};

export default function RealtimeProvider() {
  const { isAuthenticated, sessionId } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  // 人已经在对应的页面上盯着了就别再弹一遍。当前路径和偏好都放 ref:
  // 它们只在事件回调(异步)里读,进依赖数组的话换一次路由/翻一个开关就要重建订阅。
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);
  const on = useCallback((prefix: string) => (pathRef.current || '').startsWith(prefix), []);
  const { settings } = useHomeSettings();
  const [toast, setToast] = useState<Toast | null>(null);
  const seq = useRef(0);

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const show = useCallback((t: Omit<Toast, 'key'>) => {
    seq.current += 1;
    setToast({ ...t, key: seq.current });
  }, []);

  /** 铃铛相关的所有 query。互动/系统消息、未读数各处键名不统一,这里一次扫干净。 */
  const invalidateNotice = useCallback(() => {
    for (const key of [
      ['notice-count'],
      ['notice', 'count'],
      ['notice-interaction'],
      ['notice-interaction-page'],
      ['notice-system'],
    ]) {
      qc.invalidateQueries({ queryKey: key });
    }
  }, [qc]);

  /** 私信相关的所有 query(会话列表、角标、当前会话的消息)。 */
  const invalidateDM = useCallback(
    (sessionId?: string) => {
      qc.invalidateQueries({ queryKey: ['dm-sessions-page'] });
      qc.invalidateQueries({ queryKey: ['dm-sessions-badge'] });
      qc.invalidateQueries({ queryKey: ['contact-sessions'] });
      if (sessionId) {
        qc.invalidateQueries({ queryKey: ['dm-messages-page', Number(sessionId)] });
        qc.invalidateQueries({ queryKey: ['contact-messages', Number(sessionId)] });
      } else {
        qc.invalidateQueries({ queryKey: ['dm-messages-page'] });
        qc.invalidateQueries({ queryKey: ['contact-messages'] });
      }
    },
    [qc],
  );

  const invalidateKf = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['kf-messages'] });
    qc.invalidateQueries({ queryKey: ['kf-summary'] });
    qc.invalidateQueries({ queryKey: ['kf-sessions'] });
    qc.invalidateQueries({ queryKey: ['kf-thread'] });
  }, [qc]);

  const onEvent = useCallback(
    (ev: RealtimeEvent) => {
      switch (ev.type) {
        case 'dm': {
          const d = ev.data as DMEventData | undefined;
          invalidateDM(d?.sessionId);
          // 免打扰的会话只更新未读,不打断用户;人在私信页时列表自己会亮起来
          if (!d?.muted && !on('/account/msg')) {
            show({
              title: ev.title || d?.nickname || '新私信',
              body: ev.body || d?.preview || '',
              avatar: d?.avatar,
              href: '/account/msg',
            });
          }
          break;
        }
        case 'dm.sent':
        case 'dm.recall':
          // 自己在别处发/撤回的:同步过来,不提示
          invalidateDM((ev.data as DMEventData | undefined)?.sessionId);
          break;
        case 'notice': {
          const d = ev.data as NoticeEventData | undefined;
          invalidateNotice();
          const toggle = d?.kind ? NOTICE_TOGGLE[d.kind] : undefined;
          if (toggle && !settingsRef.current[toggle]) break;
          show({
            title: ev.title || '新消息',
            body: ev.body || '',
            avatar: d?.avatar,
            href: '/account/msg?tab=interaction',
          });
          break;
        }
        case 'system':
          invalidateNotice();
          show({ title: ev.title || '系统通知', body: ev.body || '', href: '/account/msg?tab=system' });
          break;
        case 'kf': {
          const d = ev.data as KfEventData | undefined;
          invalidateKf();
          // 客服发来的才提示;自己发的那条回显不提示
          if (d?.role === 'staff' || d?.role === 'system') {
            if (!on('/kf-chat')) {
              show({ title: ev.title || '在线客服', body: ev.body || d?.preview || '', href: '/kf-chat' });
            }
          } else if (d?.role === 'user' && !on('/system/kf')) {
            // 客服台侧:有人来了
            show({ title: `${d.nickname || '用户'} 发来客服消息`, body: d.preview, avatar: d.avatar, href: '/system/kf' });
          }
          break;
        }
        default:
          break;
      }
    },
    [invalidateDM, invalidateKf, invalidateNotice, on, show],
  );

  // 登录后才有连接:未登录时没有任何按人投递的事件可收。
  useEffect(() => {
    if (!isAuthenticated) return;
    return realtime.subscribe(onEvent);
    // onEvent 的依赖都是 useCallback,引用稳定;这里只跟着登录态开关。
  }, [isAuthenticated, onEvent]);

  // 换了账号要重新握手,不然连接还挂在上一个用户身上。
  // 只在 sessionId 真的变过之后才 restart —— 首次登录时上面的 subscribe 已经建过连接了,
  // 无条件 restart 会白白多换一次票。
  const lastSession = useRef<string | null>(null);
  useEffect(() => {
    const prev = lastSession.current;
    lastSession.current = sessionId;
    if (prev && sessionId && prev !== sessionId) realtime.restart();
  }, [sessionId]);

  if (!toast) return null;
  return (
    <Snackbar
      key={toast.key}
      open
      autoHideDuration={5000}
      onClose={() => setToast(null)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      sx={{ zIndex: (t) => t.zIndex.snackbar + 10, mb: { xs: 9, sm: 2 } }}
    >
      <Alert
        severity="info"
        variant="filled"
        icon={false}
        onClose={() => setToast(null)}
        onClick={() => {
          if (toast.href) router.push(toast.href);
          setToast(null);
        }}
        sx={{ cursor: toast.href ? 'pointer' : 'default', maxWidth: 360, alignItems: 'center' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          {toast.avatar && <Avatar src={toast.avatar} sx={{ width: 28, height: 28 }} />}
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }} noWrap>
              {toast.title}
            </Typography>
            {toast.body && (
              <Typography sx={{ fontSize: 12, opacity: 0.9, lineHeight: 1.4 }} noWrap>
                {toast.body}
              </Typography>
            )}
          </Box>
        </Box>
      </Alert>
    </Snackbar>
  );
}

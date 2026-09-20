'use client';

import * as React from 'react';
import { useEffect } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { useRouter } from 'next/navigation';
import { realtime, type RealtimeEvent } from '@/lib/realtime/client';
import { getDetailRoute } from '@/lib/contentRoute';

/**
 * PushPreviewToast —— 监听 realtime Bus 的 digitalhuman.bubble 事件。
 *
 * 收到时弹 Snackbar + 跳详情按钮;挂在 RootLayout 的 children 内一次即可。
 * 已被 content-api 的 dispatcher.publishToRecipients 推送;
 * 见 internal/ingest/outbox_dispatcher.go:148。
 */
export function PushPreviewToast() {
  const [open, setOpen] = React.useState(false);
  const [event, setEvent] = React.useState<RealtimeEvent | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsub = realtime.subscribe((ev) => {
      if (ev?.type === 'digitalhuman.bubble') {
        setEvent(ev);
        setOpen(true);
      }
    });
    return unsub;
  }, []);

  const handleClick = () => {
    const data = (event?.data ?? {}) as {
      module_content_id?: number | string;
      subcategory_code?: string;
    };
    if (data.module_content_id) {
      const url = getDetailRoute('NEWS', data.module_content_id);
      if (url) {
        const u = new URL(url, window.location.origin);
        if (data.subcategory_code) u.searchParams.set('sub', data.subcategory_code);
        router.push(u.pathname + u.search);
      }
    }
    setOpen(false);
  };

  if (!event) return null;

  const data = (event.data ?? {}) as { module_content_id?: number | string };

  return (
    <Snackbar
      open={open}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      onClose={() => setOpen(false)}
      autoHideDuration={6000}
    >
      <Alert
        onClose={() => setOpen(false)}
        severity="info"
        variant="filled"
        action={
          data.module_content_id ? (
            <Button color="inherit" size="small" onClick={handleClick}>
              查看
            </Button>
          ) : undefined
        }
        sx={{ width: '100%' }}
      >
        {event.title ?? '专题更新'}: {event.body}
      </Alert>
    </Snackbar>
  );
}

export default PushPreviewToast;
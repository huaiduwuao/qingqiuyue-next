'use client';

/**
 * 浏览器登录 —— 在后台操作服务器上的浏览器,亲手完成站点的验证与登录,点「保存登录状态」时
 * 服务器把这个站的 Cookie(连同那台浏览器的 UA)收进凭据仓库(后端 internal/crawler/remote_login.go)。
 *
 * 画面是服务器浏览器的截屏帧(长轮询,有新帧才返回);鼠标、滚轮、键盘、粘贴转发回去。
 * 按键只转发、不记录;Cookie 值不回到页面上,保存后只告诉你收到了哪些 Cookie 名。
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  startRemoteLogin, remoteLoginFrame, remoteLoginInput, remoteLoginNavigate, saveRemoteLogin, closeRemoteLogin,
  type CrawlCredential, type RemoteInput, type RemoteLoginSession,
} from '@/apis/sourceSetup';

/** 父组件只在要用时挂载它(关闭 = 卸载,卸载时关掉服务器上的会话)。 */
interface Props {
  /** 重新登录已有凭据;不传 = 新建 */
  credential?: CrawlCredential | null;
  onClose: () => void;
  onSaved?: (c: CrawlCredential, cookieNames: string[]) => void;
}

/** 非可打印键 → Windows 虚拟键码(CDP 要它才认得 Enter / 退格这些)。 */
const SPECIAL_KEYS: Record<string, number> = {
  Enter: 13, Backspace: 8, Tab: 9, Escape: 27, Delete: 46, Home: 36, End: 35, PageUp: 33, PageDown: 34,
  ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40,
};

/** CDP 的修饰键位:Alt=1 Ctrl=2 Meta=4 Shift=8。 */
function modifiersOf(e: { altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): number {
  return (e.altKey ? 1 : 0) | (e.ctrlKey ? 2 : 0) | (e.metaKey ? 4 : 0) | (e.shiftKey ? 8 : 0);
}

function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

export default function RemoteLoginDialog({ credential, onClose, onSaved }: Props) {
  const [startUrl, setStartUrl] = useState(credential ? `https://www.${credential.domain}/` : '');
  const [name, setName] = useState(credential?.name ?? '');
  const [session, setSession] = useState<RemoteLoginSession | null>(null);
  const [starting, setStarting] = useState(false);
  const [frame, setFrame] = useState<{ src: string; w: number; h: number } | null>(null);
  const [addr, setAddr] = useState('');
  const [error, setError] = useState('');
  const [closedReason, setClosedReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string[] | null>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<RemoteLoginSession | null>(null);
  const frameSize = useRef({ w: 1280, h: 800 });
  const queue = useRef<RemoteInput[]>([]);
  const sending = useRef<Promise<void>>(Promise.resolve());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMove = useRef(0);
  const buttonDown = useRef(false);

  const start = useCallback(async (url: string) => {
    setStarting(true);
    setError('');
    try {
      const s = await startRemoteLogin({ url: url.trim() || undefined, credential_id: credential?.id, name: name.trim() || undefined });
      sessionRef.current = s;
      frameSize.current = { w: s.width, h: s.height };
      setSession(s);
      setTimeout(() => screenRef.current?.focus(), 50);
    } catch (e) {
      setError(errMsg(e, '打开浏览器失败'));
    } finally {
      setStarting(false);
    }
  }, [credential, name]);

  // 截屏帧长轮询。
  useEffect(() => {
    if (!session) return;
    const ctrl = new AbortController();
    let seq = 0;
    let stop = false;
    let lastUrl = '';
    (async () => {
      while (!stop) {
        try {
          const f = await remoteLoginFrame(session.id, seq, ctrl.signal);
          if (stop) return;
          if (f.data) {
            const w = f.width || frameSize.current.w;
            const h = f.height || frameSize.current.h;
            frameSize.current = { w, h };
            setFrame({ src: `data:image/jpeg;base64,${f.data}`, w, h });
          }
          // 页面跳转了才改地址栏,别覆盖正在输入的网址。
          if (f.url && f.url !== lastUrl) {
            lastUrl = f.url;
            setAddr(f.url);
          }
          seq = f.seq || seq;
          if (f.closed) {
            setClosedReason(f.reason || '会话已结束');
            return;
          }
        } catch (e) {
          if (stop || ctrl.signal.aborted) return;
          setError(errMsg(e, '画面连接中断,正在重试…'));
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    })();
    return () => {
      stop = true;
      ctrl.abort();
    };
  }, [session]);

  // 卸载时关掉服务器上的会话(登录态不留在共享浏览器里)。
  useEffect(() => () => {
    const s = sessionRef.current;
    sessionRef.current = null;
    if (s) closeRemoteLogin(s.id).catch(() => {});
  }, []);

  // 输入按顺序发:攒 30ms 一批,上一批回来再发下一批。
  const send = useCallback((ev: RemoteInput) => {
    if (!sessionRef.current) return;
    queue.current.push(ev);
    if (flushTimer.current) return;
    flushTimer.current = setTimeout(() => {
      flushTimer.current = null;
      const batch = queue.current.splice(0, 100);
      const s = sessionRef.current;
      if (!s || batch.length === 0) return;
      sending.current = sending.current
        .then(() => remoteLoginInput(s.id, batch).then(() => undefined))
        .catch((e) => setError(errMsg(e, '操作没发出去')));
    }, 30);
  }, []);

  const toDevice = (clientX: number, clientY: number) => {
    const el = screenRef.current?.querySelector('img');
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(((clientX - r.left) / r.width) * frameSize.current.w),
      y: Math.round(((clientY - r.top) / r.height) * frameSize.current.h),
    };
  };
  const btnName = (b: number) => (b === 2 ? 'right' : b === 1 ? 'middle' : 'left');

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    screenRef.current?.focus();
    buttonDown.current = true;
    send({ t: 'mouse', type: 'mousePressed', ...toDevice(e.clientX, e.clientY), button: btnName(e.button), clickCount: e.detail || 1, modifiers: modifiersOf(e) });
  };
  const onMouseUp = (e: React.MouseEvent) => {
    e.preventDefault();
    buttonDown.current = false;
    send({ t: 'mouse', type: 'mouseReleased', ...toDevice(e.clientX, e.clientY), button: btnName(e.button), clickCount: e.detail || 1, modifiers: modifiersOf(e) });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    const now = Date.now();
    // 拖动(滑块之类)要跟手;悬停只需大致位置。
    if (now - lastMove.current < (buttonDown.current ? 30 : 120)) return;
    lastMove.current = now;
    send({ t: 'mouse', type: 'mouseMoved', ...toDevice(e.clientX, e.clientY), button: buttonDown.current ? 'left' : 'none', modifiers: modifiersOf(e) });
  };

  // 滚轮要 passive:false 才能拦住外层滚动。
  useEffect(() => {
    const el = screenRef.current;
    if (!el || !session) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      send({ t: 'wheel', ...toDevice(e.clientX, e.clientY), dx: e.deltaX, dy: e.deltaY });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [session, send]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const mods = modifiersOf(e);
    // Ctrl/⌘+V 交给 onPaste 读剪贴板文本。
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') return;
    e.preventDefault();
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      send({ t: 'text', text: e.key });
      return;
    }
    const code = SPECIAL_KEYS[e.key] ?? (e.ctrlKey || e.metaKey ? e.keyCode : 0);
    if (code) send({ t: 'key', key: e.key, code: e.code, keyCode: code, modifiers: mods });
  };
  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (text) send({ t: 'text', text: text.slice(0, 2000) });
  };

  const nav = async (body: { url?: string; action?: 'back' | 'forward' | 'reload' }) => {
    const s = sessionRef.current;
    if (!s) return;
    try {
      await remoteLoginNavigate(s.id, body);
    } catch (e) {
      setError(errMsg(e, '跳转失败'));
    }
  };

  const save = async () => {
    const s = sessionRef.current;
    if (!s) return;
    setSaving(true);
    setError('');
    try {
      const r = await saveRemoteLogin(s.id);
      setSaved(r.cookie_names);
      onSaved?.(r.credential, r.cookie_names);
    } catch (e) {
      setError(errMsg(e, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const ratio = frame ? `${frame.w} / ${frame.h}` : '1280 / 800';

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle sx={{ pb: 1 }}>
        {credential ? `浏览器登录 · 重新登录「${credential.name}」(${credential.domain})` : '浏览器登录 · 新建凭据'}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {!session ? (
          <>
            <Typography variant="body2" color="text.secondary">
              会在服务器的浏览器里打开这个网站,画面显示在下面。你在画面里亲手完成验证和登录,然后点「保存登录状态」,
              服务器把这个站的 Cookie 加密存进凭据仓库。服务器浏览器和抓取走同一个出口,不会因为换了 IP 而失效。
            </Typography>
            {!credential && (
              <TextField id="rl-name" label="凭据名称" size="small" value={name} onChange={(e) => setName(e.target.value)} placeholder="如:挂了影视" />
            )}
            <TextField id="rl-url" label="登录页网址" size="small" value={startUrl} onChange={(e) => setStartUrl(e.target.value)}
              placeholder="https://www.example.com/" helperText="凭据绑定这个网址的域名(含子域)" />
            <Box>
              <Button variant="contained" onClick={() => start(startUrl)} disabled={starting || (!credential && !startUrl.trim())}
                startIcon={starting ? <CircularProgress size={16} color="inherit" /> : undefined}>
                打开浏览器
              </Button>
            </Box>
          </>
        ) : (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Tooltip title="后退"><IconButton size="small" onClick={() => nav({ action: 'back' })}><ArrowBackIcon fontSize="small" /></IconButton></Tooltip>
              <Tooltip title="前进"><IconButton size="small" onClick={() => nav({ action: 'forward' })}><ArrowForwardIcon fontSize="small" /></IconButton></Tooltip>
              <Tooltip title="刷新"><IconButton size="small" onClick={() => nav({ action: 'reload' })}><RefreshIcon fontSize="small" /></IconButton></Tooltip>
              <TextField id="rl-addr" size="small" fullWidth value={addr} onChange={(e) => setAddr(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') nav({ url: addr }); }}
                slotProps={{ htmlInput: { style: { fontFamily: 'monospace', fontSize: 13 } } }} />
            </Box>
            <Box
              ref={screenRef}
              tabIndex={0}
              onMouseDown={onMouseDown}
              onMouseUp={onMouseUp}
              onMouseMove={onMouseMove}
              onContextMenu={(e) => e.preventDefault()}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              sx={{
                position: 'relative', width: '100%', aspectRatio: ratio, bgcolor: '#111', borderRadius: 1, overflow: 'hidden',
                outline: 'none', cursor: 'default', border: 2, borderColor: 'divider',
                '&:focus': { borderColor: 'primary.main' },
              }}
            >
              {frame ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={frame.src} alt="服务器浏览器画面" draggable={false}
                  style={{ width: '100%', height: '100%', display: 'block', userSelect: 'none', pointerEvents: 'none' }} />
              ) : (
                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'grey.400' }}>
                  <CircularProgress size={28} color="inherit" />
                </Box>
              )}
              {closedReason && (
                <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,.6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {closedReason}
                </Box>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              点一下画面后可以直接打字,粘贴用 Ctrl+V。按键只转发给服务器浏览器,不记录;会话闲置 10 分钟或满 30 分钟自动关闭。
            </Typography>
            {saved && (
              <Alert severity="success">
                已保存到凭据仓库(收到 {saved.length} 个 Cookie:{saved.join('、')})。可以继续操作后再保存一次覆盖,或直接关闭。
              </Alert>
            )}
          </>
        )}
        {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{saved ? '完成' : '关闭'}</Button>
        {session && (
          <Button variant="contained" onClick={save} disabled={saving || !!closedReason}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}>
            保存登录状态
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

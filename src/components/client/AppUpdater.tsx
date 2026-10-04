'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import LinearProgress from '@mui/material/LinearProgress';
import Snackbar from '@mui/material/Snackbar';
import Alert, { type AlertColor } from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import SystemUpdateAltRoundedIcon from '@mui/icons-material/SystemUpdateAltRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import IconButton from '@mui/material/IconButton';
import type { Update } from '@tauri-apps/plugin-updater';
import {
  ANDROID_APK_URL,
  APP_UPDATE_CHECK_EVENT,
  fetchLatestRelease,
  isNewerVersion,
} from '@/lib/appUpdate';
import { useUpdateMode } from '@/components/client/ClientVersionCard';

/**
 * 客户端自动更新(网页 / iOS 里是空组件)。
 *
 * - 启动 10 秒后查一次,之后每 6 小时查一次;任何地方 requestUpdateCheck() 触发手动检查。
 * - 桌面端:tauri-plugin-updater 读 latest.json、验签、下载安装;Windows 上 NSIS 安装器
 *   (passive)会自己退出并重启应用,macOS 装完后调 relaunch()。
 * - 安卓:比对 GitHub 上的最新版本号,「立即更新」交给系统浏览器下载 APK。
 * - 自动检查失败一律静默;「稍后」过的版本本次运行里不再自动提示,手动检查照样弹。
 * - 自动检查发现新版只在顶部给一条可关掉的小提示,不弹模态框:启动 10 秒正是在刷推荐流的时候,
 *   突然一个对话框盖住整屏、还得点掉才能继续,体验很差。点「更新」才打开带更新说明的对话框;
 *   用户自己点「检查更新」时直接弹对话框。
 */

const FIRST_CHECK_DELAY_MS = 10_000;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

type Offer = { version: string; current: string; notes: string };
type Phase = 'idle' | 'downloading' | 'installing' | 'error';
type Snack = { msg: string; severity: AlertColor; sticky?: boolean } | null;

async function currentVersion(): Promise<string> {
  const { getVersion } = await import('@tauri-apps/api/app');
  return getVersion();
}

function formatMb(bytes: number): string {
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function AppUpdater() {
  const mode = useUpdateMode();
  const [offer, setOffer] = useState<Offer | null>(null);
  // 自动检查发现的新版本:只显示顶部小提示
  const [nudge, setNudge] = useState<Offer | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState<{ done: number; total?: number }>({ done: 0 });
  const [snack, setSnack] = useState<Snack>(null);

  const updateRef = useRef<Update | null>(null);
  const checkingRef = useRef(false);
  const busyRef = useRef(false);
  const dismissedRef = useRef<Set<string>>(new Set());

  const releaseResource = useCallback(() => {
    const u = updateRef.current;
    updateRef.current = null;
    if (u) void u.close().catch(() => {});
  }, []);

  const runCheck = useCallback(
    async (manual: boolean) => {
      if (!mode || checkingRef.current || busyRef.current) return;
      checkingRef.current = true;
      if (manual) setSnack({ msg: '正在检查更新…', severity: 'info', sticky: true });
      try {
        if (mode === 'desktop') {
          const { check } = await import('@tauri-apps/plugin-updater');
          const upd = await check({ timeout: 30_000 });
          if (!upd) {
            if (manual) setSnack({ msg: `已是最新版本 ${await currentVersion()}`, severity: 'success' });
            return;
          }
          if (!manual && dismissedRef.current.has(upd.version)) {
            void upd.close().catch(() => {});
            return;
          }
          releaseResource();
          updateRef.current = upd;
          setSnack(null);
          const found = { version: upd.version, current: upd.currentVersion, notes: upd.body || '' };
          if (manual) setOffer(found);
          else setNudge(found);
        } else {
          const [current, latest] = await Promise.all([currentVersion(), fetchLatestRelease()]);
          if (!isNewerVersion(latest.version, current)) {
            if (manual) setSnack({ msg: `已是最新版本 ${current}`, severity: 'success' });
            return;
          }
          if (!manual && dismissedRef.current.has(latest.version)) return;
          setSnack(null);
          const found = { version: latest.version, current, notes: latest.notes };
          if (manual) setOffer(found);
          else setNudge(found);
        }
        setPhase('idle');
      } catch (e) {
        console.warn('[AppUpdater] check failed', e);
        if (manual) setSnack({ msg: '检查更新失败,请稍后再试', severity: 'error' });
      } finally {
        checkingRef.current = false;
      }
    },
    [mode, releaseResource],
  );

  // 启动后延迟检查 + 每 6 小时一次
  useEffect(() => {
    if (!mode) return;
    const first = setTimeout(() => void runCheck(false), FIRST_CHECK_DELAY_MS);
    const every = setInterval(() => void runCheck(false), CHECK_INTERVAL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, [mode, runCheck]);

  // 手动检查(设置页 / 头像菜单里的「检查更新」)
  useEffect(() => {
    if (!mode) return;
    const onManual = () => void runCheck(true);
    window.addEventListener(APP_UPDATE_CHECK_EVENT, onManual);
    return () => window.removeEventListener(APP_UPDATE_CHECK_EVENT, onManual);
  }, [mode, runCheck]);

  useEffect(() => releaseResource, [releaseResource]);

  const later = () => {
    if (busyRef.current || !offer) return;
    dismissedRef.current.add(offer.version);
    setOffer(null);
    releaseResource();
  };

  const openNudge = () => {
    if (!nudge) return;
    setOffer(nudge);
    setNudge(null);
  };
  const dismissNudge = () => {
    if (!nudge) return;
    dismissedRef.current.add(nudge.version);
    setNudge(null);
    releaseResource();
  };

  const updateNow = async () => {
    if (!offer || busyRef.current) return;
    if (mode === 'android') {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('open_external', { url: ANDROID_APK_URL });
        setOffer(null);
        setSnack({ msg: '已在浏览器中开始下载,下载完成后点开安装包即可更新', severity: 'info' });
      } catch (e) {
        console.warn('[AppUpdater] open apk url failed', e);
        setSnack({ msg: '无法打开浏览器,请到官网下载页获取最新安装包', severity: 'error' });
      }
      return;
    }

    const upd = updateRef.current;
    if (!upd) return;
    busyRef.current = true;
    setPhase('downloading');
    setProgress({ done: 0 });
    try {
      let done = 0;
      await upd.downloadAndInstall((ev) => {
        if (ev.event === 'Started') {
          setProgress({ done: 0, total: ev.data.contentLength || undefined });
        } else if (ev.event === 'Progress') {
          done += ev.data.chunkLength;
          setProgress((p) => ({ ...p, done }));
        } else if (ev.event === 'Finished') {
          setPhase('installing');
        }
      });
      // Windows 走到这里之前安装器已经接管并退出了应用;macOS 需要自己重启
      setPhase('installing');
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (e) {
      console.warn('[AppUpdater] install failed', e);
      busyRef.current = false;
      setPhase('error');
    }
  };

  if (!mode) return null;

  const busy = phase === 'downloading' || phase === 'installing';
  const pct = progress.total ? Math.min(100, (progress.done / progress.total) * 100) : undefined;

  return (
    <>
      <Dialog open={!!offer} onClose={busy ? undefined : later} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SystemUpdateAltRoundedIcon color="primary" />
          发现新版本 {offer?.version}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            当前版本 {offer?.current}
          </Typography>
          {offer?.notes ? (
            <Box
              sx={{
                maxHeight: 240,
                overflow: 'auto',
                p: 1.5,
                borderRadius: 1,
                bgcolor: 'action.hover',
                fontSize: 13,
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {offer.notes}
            </Box>
          ) : null}
          {busy ? (
            <Box sx={{ mt: 2 }}>
              <LinearProgress variant={pct === undefined || phase === 'installing' ? 'indeterminate' : 'determinate'} value={pct} />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                {phase === 'installing'
                  ? '正在安装,应用将自动重启…'
                  : progress.total
                    ? `正在下载 ${formatMb(progress.done)} / ${formatMb(progress.total)}`
                    : `正在下载 ${formatMb(progress.done)}`}
              </Typography>
            </Box>
          ) : null}
          {phase === 'error' ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              更新失败,请检查网络后重试,或到官网下载页手动安装新版本。
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={later} disabled={busy}>
            稍后
          </Button>
          <Button variant="contained" onClick={() => void updateNow()} disabled={busy}>
            {phase === 'error' ? '重试' : '立即更新'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!nudge && !offer && !snack} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} sx={{ top: 'calc(8px + var(--sat, 0px)) !important' }}>
        <Alert
          severity="info"
          variant="filled"
          icon={<SystemUpdateAltRoundedIcon fontSize="inherit" />}
          onClose={dismissNudge}
          action={
            <>
              <Button color="inherit" size="small" onClick={openNudge} sx={{ fontWeight: 700 }}>
                更新
              </Button>
              <IconButton color="inherit" size="small" aria-label="关闭" onClick={dismissNudge}>
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            </>
          }
        >
          新版本 {nudge?.version} 可用
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!snack}
        autoHideDuration={snack?.sticky ? null : 4000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        {snack ? (
          <Alert severity={snack.severity} variant="filled" onClose={() => setSnack(null)}>
            {snack.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </>
  );
}

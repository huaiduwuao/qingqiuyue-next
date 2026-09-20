'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import {
  getPlaylistImportStatus,
  previewPlaylistImport,
  startPlaylistImport,
  type PlaylistImportJob,
  type PlaylistImportPreview,
} from '@/apis/my-list';
import { formatApiError } from '@/lib/api/client';
import { CoverImage } from '@/components/common/CoverImage';
import type { EntityId } from '@/lib/id';

/**
 * 从网易云音乐 / QQ 音乐 / 酷狗音乐 / 汽水音乐导入歌单:贴分享链接 → 确认是不是这张 → 后台导入,这里看进度。
 *
 * 导入在服务端跑,关掉这个框不会中断;再打开时(或刷新页面后)会把还在跑的任务接回来。
 * target 给了就是「导进这张已有的歌单」,不给就新建一张。
 */
export default function PlaylistImportDialog({
  open,
  target,
  onClose,
  onFinished,
}: {
  open: boolean;
  target?: { id: EntityId; name: string };
  onClose: () => void;
  /** 任务结束(成功或中途失败)时调一次,listId 是曲目落进去的那张歌单 */
  onFinished?: (listId: EntityId, job: PlaylistImportJob) => void;
}) {
  const qc = useQueryClient();
  const [link, setLink] = useState('');
  const [preview, setPreview] = useState<PlaylistImportPreview | null>(null);
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [jobId, setJobId] = useState<EntityId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const finished = useRef<string | null>(null);

  // 每次打开从头来;如果上一次的导入还在跑,直接接到进度那一步。
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setLink('');
      setPreview(null);
      setName('');
      setIsPublic(false);
      setJobId(null);
      setError('');
    }
  }
  useEffect(() => {
    if (!open) return;
    let alive = true;
    getPlaylistImportStatus()
      .then((j) => {
        if (alive && j?.status === 'running') setJobId(j.id);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open]);

  const jobQ = useQuery({
    queryKey: ['playlist-import', String(jobId)],
    queryFn: () => getPlaylistImportStatus(jobId!),
    enabled: open && jobId != null,
    refetchInterval: (q) => (q.state.data?.status === 'running' || !q.state.data ? 1500 : false),
  });
  const job = jobQ.data ?? null;

  // 歌是一批一批写进歌单的,进度一动就让歌单列表/详情跟着刷新;结束时通知一次。
  const done = job?.done ?? 0;
  useEffect(() => {
    if (!job) return;
    qc.invalidateQueries({ queryKey: ['my-lists'] });
    if (job.status !== 'running' && finished.current !== String(job.id)) {
      finished.current = String(job.id);
      onFinished?.(job.listId, job);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, job?.status]);

  const readLink = async () => {
    if (!link.trim()) return setError('先把歌单的分享链接贴进来');
    setBusy(true);
    setError('');
    try {
      const p = await previewPlaylistImport(link.trim());
      setPreview(p);
      setName(p.name.slice(0, 40));
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    if (!preview) return;
    setBusy(true);
    setError('');
    try {
      const r = await startPlaylistImport(
        target ? { url: preview.url, listId: target.id } : { url: preview.url, name: name.trim() || preview.name, isPublic },
      );
      setJobId(r.jobId);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const step: 'link' | 'preview' | 'job' = jobId != null ? 'job' : preview ? 'preview' : 'link';
  const partial = preview && preview.fetched < preview.total;

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>{target ? `导入到「${target.name}」` : '导入歌单'}</DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        {step === 'link' && (
          <>
            <TextField
              autoFocus
              multiline
              minRows={2}
              maxRows={4}
              size="small"
              label="歌单分享链接"
              placeholder="例如 https://music.163.com/playlist?id=…  或  https://y.qq.com/n/ryqq/playlist/…"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  readLink();
                }
              }}
              slotProps={{ htmlInput: { maxLength: 2000, 'aria-label': '歌单分享链接' } }}
            />
            <Box sx={{ fontSize: 12.5, color: 'text.secondary', lineHeight: 1.8 }}>
              支持<b>网易云音乐</b>、<b>QQ 音乐</b>、<b>酷狗音乐</b>和<b>汽水音乐</b>。在 App 里打开歌单 → 分享 → 复制链接,整段粘贴进来就行。
              <br />
              歌单需要是公开的;导入的是歌曲信息,能不能在本站播放取决于这首歌有没有可用音源,会员歌曲会标注并给出原平台入口。
            </Box>
          </>
        )}

        {step === 'preview' && preview && (
          <>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <Box sx={{ width: 72, height: 72, borderRadius: 2, overflow: 'hidden', bgcolor: 'action.selected', flexShrink: 0 }}>
                {preview.coverUrl && (
                  <CoverImage src={preview.coverUrl} alt="" referrerPolicy="no-referrer" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview.name || '未命名歌单'}</Typography>
                <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
                  {preview.platformName}
                  {preview.owner ? ` · ${preview.owner}` : ''} · {preview.total} 首
                </Typography>
              </Box>
            </Box>

            {partial && (
              <Alert severity="info" sx={{ fontSize: 12.5 }}>
                {preview.platform === 'qishui'
                  ? `汽水音乐的分享页只给出歌单开头的一部分,这次能导入前 ${preview.fetched} 首(共 ${preview.total} 首)。`
                  : preview.total > preview.maxItems
                    ? `一张歌单最多 ${preview.maxItems} 首,这次导入前 ${preview.fetched} 首(共 ${preview.total} 首)。`
                    : `读到了 ${preview.fetched} 首(共 ${preview.total} 首),其余的在原平台已下架,读不到歌曲信息。`}
              </Alert>
            )}

            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, maxHeight: 220, overflowY: 'auto' }}>
              {preview.tracks.map((t, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.75, borderTop: i ? '1px solid' : 'none', borderColor: 'divider', fontSize: 13 }}>
                  <Box sx={{ width: 22, color: 'text.disabled', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{i + 1}</Box>
                  <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.title}
                    <Box component="span" sx={{ color: 'text.secondary' }}>
                      {' '}
                      — {t.artist || '未知歌手'}
                    </Box>
                  </Box>
                  {t.vip && <Box sx={{ fontSize: 11, color: 'warning.main', flexShrink: 0 }}>会员</Box>}
                </Box>
              ))}
              {preview.fetched > preview.tracks.length && (
                <Box sx={{ px: 1.5, py: 0.75, borderTop: '1px solid', borderColor: 'divider', fontSize: 12, color: 'text.secondary' }}>
                  …还有 {preview.fetched - preview.tracks.length} 首
                </Box>
              )}
            </Box>

            {!target && (
              <>
                <TextField label="歌单名称" size="small" value={name} onChange={(e) => setName(e.target.value)} slotProps={{ htmlInput: { maxLength: 40 } }} />
                <FormControlLabel
                  control={<Switch checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />}
                  label={<Box sx={{ fontSize: 14 }}>公开 —— 拿到链接的人都能看和播放</Box>}
                />
              </>
            )}
          </>
        )}

        {step === 'job' && (
          <JobProgress job={job} loading={jobQ.isLoading} />
        )}

        {error && <Alert severity="error" sx={{ fontSize: 13 }}>{error}</Alert>}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        {step === 'link' && (
          <>
            <Button variant="text" onClick={onClose} disabled={busy}>
              取消
            </Button>
            <Button variant="contained" onClick={readLink} disabled={busy}>
              {busy ? <CircularProgress size={18} color="inherit" /> : '读取歌单'}
            </Button>
          </>
        )}
        {step === 'preview' && (
          <>
            <Button
              variant="text"
              disabled={busy}
              onClick={() => {
                setPreview(null);
                setError('');
              }}
            >
              换一条链接
            </Button>
            <Button variant="contained" onClick={start} disabled={busy || !preview?.fetched}>
              {busy ? <CircularProgress size={18} color="inherit" /> : `导入 ${preview?.fetched ?? 0} 首`}
            </Button>
          </>
        )}
        {step === 'job' && (
          <Button variant={job && job.status !== 'running' ? 'contained' : 'text'} onClick={onClose}>
            {job && job.status !== 'running' ? '完成' : '放到后台'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function JobProgress({ job, loading }: { job: PlaylistImportJob | null; loading: boolean }) {
  if (!job) {
    return (
      <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>{loading ? <CircularProgress size={24} /> : <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>没有找到这次导入</Typography>}</Box>
    );
  }
  const pct = job.total > 0 ? Math.round((job.done / job.total) * 100) : 0;
  const running = job.status === 'running';
  // 歌是攒一批才写进歌单的,跑的过程中 added 落后于 done,这个差值只有结束后才有意义
  const existed = running ? 0 : job.done - job.failed - job.added;
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        {job.status === 'done' && <CheckCircleRoundedIcon color="success" sx={{ fontSize: 20 }} />}
        <Typography sx={{ fontSize: 14, fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {running ? '正在导入' : job.status === 'done' ? '导入完成' : '导入中断'} ·「{job.name}」
        </Typography>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
          {job.done} / {job.total}
        </Typography>
      </Box>
      <LinearProgress variant="determinate" value={pct} color={job.status === 'failed' ? 'warning' : 'primary'} sx={{ height: 6, borderRadius: 3 }} aria-label="导入进度" />
      <Typography sx={{ mt: 1.25, fontSize: 12.5, color: 'text.secondary', lineHeight: 1.8 }}>
        已加入歌单 {job.added} 首
        {existed > 0 ? ` · ${existed} 首本来就在歌单里` : ''}
        {job.created > 0 ? ` · 其中 ${job.created} 首是站内新收录的` : ''}
        {job.failed > 0 ? ` · ${job.failed} 首没导进来` : ''}
        {running && (
          <>
            <br />
            每首歌都要查重再收录,几百首的歌单需要几分钟。可以先关掉这个窗口,导入会在后台继续,歌单里的歌会一批批出现。
          </>
        )}
      </Typography>
      {job.status === 'failed' && job.error && (
        <Alert severity="warning" sx={{ mt: 1.5, fontSize: 12.5 }}>
          {job.error}
        </Alert>
      )}
    </Box>
  );
}

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import GraphicEqRoundedIcon from '@mui/icons-material/GraphicEqRounded';
import IosShareRoundedIcon from '@mui/icons-material/IosShareRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PlaylistAddRoundedIcon from '@mui/icons-material/PlaylistAddRounded';
import QueueMusicRoundedIcon from '@mui/icons-material/QueueMusicRounded';
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded';
import ShuffleRoundedIcon from '@mui/icons-material/ShuffleRounded';
import PublicTopBar from '@/components/layout/PublicTopBar';
import PlaylistCover from '@/components/player/PlaylistCover';
import { ListLayout, ListLayoutSwitch, LIST_ROW } from '@/components/common/ListLayout';
import {
  createMyList,
  deleteMyList,
  getMyListContent,
  getMyListDetail,
  getMyLists,
  removeFromMyList,
  reorderMyList,
  updateMyList,
  type MyListContentItem,
  type MyListItem,
} from '@/apis/my-list';
import { formatApiError } from '@/lib/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { loginHref } from '@/lib/auth/redirect';
import { mediaUrl } from '@/lib/media';
import { currentTrack, useMusicPlayer } from '@/lib/player/musicPlayer';
import {
  LIKED_MUSIC_ID,
  getLikedMusic,
  likedMusicList,
  playTracks,
  playlistHref,
  queueTracks,
  type TrackSeed,
} from '@/lib/player/playlist';

/**
 * 歌单。/playlist 是「我的歌单」;/playlist?id= 是一张歌单(自己的,或别人公开的);
 * /playlist?id=liked 是内置的「我喜欢的音乐」;/playlist?new=1 直接弹新建。
 */
export default function PlaylistPage() {
  const params = useSearchParams();
  const id = params.get('id');
  // ?new=1:从音乐频道的「新建歌单」进来,直接弹出新建框
  return id ? <PlaylistDetail id={id} /> : <MyPlaylists autoCreate={params.get('new') === '1'} />;
}

// ---------------------------------------------------------------------------
// 我的歌单
// ---------------------------------------------------------------------------

function MyPlaylists({ autoCreate }: { autoCreate: boolean }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { isAuthenticated, status } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const created = useRef(false);
  useEffect(() => {
    if (autoCreate && isAuthenticated) setCreateOpen(true);
  }, [autoCreate, isAuthenticated]);

  const lists = useQuery({
    queryKey: ['my-lists', 'playlist'],
    queryFn: () => getMyLists('playlist'),
    enabled: isAuthenticated,
  });
  const liked = useQuery({ queryKey: ['liked-music'], queryFn: getLikedMusic, enabled: isAuthenticated });
  const own = lists.data?.list ?? [];
  const items = [...(liked.data?.length ? [likedMusicList(liked.data)] : []), ...own];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <PublicTopBar title="我的歌单" maxWidth="lg" icon={<QueueMusicRoundedIcon sx={{ fontSize: 18 }} />} />
      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
        {status !== 'loading' && !isAuthenticated ? (
          <Empty
            title="登录后建自己的歌单"
            hint="把喜欢的歌攒成歌单,一键播放全部,换设备也在。"
            action={
              <Button variant="contained" onClick={() => router.push(loginHref())}>
                去登录
              </Button>
            }
          />
        ) : lists.isLoading || status === 'loading' ? (
          <Center>
            <CircularProgress size={28} />
          </Center>
        ) : lists.isError ? (
          <Alert severity="error">歌单加载失败:{formatApiError(lists.error)}</Alert>
        ) : (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2.5 }}>
              <Typography sx={{ flex: 1, fontSize: 14, color: 'text.secondary' }}>{own.length} 个歌单</Typography>
              <ListLayoutSwitch sx={{ mr: 1.5 }} />
              <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setCreateOpen(true)}>
                新建歌单
              </Button>
            </Box>
            {items.length === 0 ? (
              <Empty title="还没有歌单" hint="在歌曲页或播放队列里点「加入歌单」,也可以先建一个空的。" />
            ) : (
              <ListLayout minColumnWidth={180} minColumns={2} gap={20}>
                {items.map((l) => (
                  <Box
                    key={String(l.id)}
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(playlistHref(l.id))}
                    onKeyDown={(e) => e.key === 'Enter' && router.push(playlistHref(l.id))}
                    sx={{
                      cursor: 'pointer',
                      borderRadius: 2,
                      '&:hover .cv': { transform: 'translateY(-3px)' },
                      '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
                      [LIST_ROW]: { display: 'flex', alignItems: 'center', gap: 1.5, p: 1, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' },
                    }}
                  >
                    <Box className="cv" sx={{ transition: 'transform 180ms', boxShadow: 3, borderRadius: 2, overflow: 'hidden', [LIST_ROW]: { width: { xs: 72, sm: 96 }, flexShrink: 0 } }}>
                      <PlaylistCover covers={l.covers} coverUrl={l.coverUrl} size="100%" radius={0} />
                    </Box>
                    <Box sx={{ [LIST_ROW]: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' } }}>
                      <Typography sx={{ mt: 1, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', [LIST_ROW]: { mt: 0 } }}>{l.name}</Typography>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                        {l.itemCount} 首{l.isPublic ? ' · 公开' : ''}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </ListLayout>
            )}
          </>
        )}
      </Container>

      <EditDialog
        open={createOpen}
        title="新建歌单"
        onClose={() => {
          setCreateOpen(false);
          // 取消了就把 ?new=1 去掉,免得刷新又弹;建好了会跳详情,别再拉回来
          if (autoCreate && !created.current) router.replace('/playlist');
        }}
        onSubmit={async (v) => {
          const r = await createMyList({ ...v, type: 'playlist' });
          created.current = true;
          qc.invalidateQueries({ queryKey: ['my-lists'] });
          router.push(playlistHref(r.id));
        }}
      />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// 一张歌单
// ---------------------------------------------------------------------------

function PlaylistDetail({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [toast, setToast] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const playingId = useMusicPlayer((s) => (s.playing ? currentTrack(s)?.id : undefined));

  const isLiked = id === LIKED_MUSIC_ID;
  const likedQ = useQuery({ queryKey: ['liked-music'], queryFn: getLikedMusic, retry: false, enabled: isLiked });
  const realMeta = useQuery({ queryKey: ['my-lists', 'detail', id], queryFn: () => getMyListDetail(id), retry: false, enabled: !isLiked });
  const realContent = useQuery({ queryKey: ['my-lists', 'content', id], queryFn: () => getMyListContent(id), retry: false, enabled: !isLiked && realMeta.isSuccess });
  // 「我喜欢的音乐」没有库里的歌单行,用点赞列表拼出同样的形状,下面的渲染不用分两套
  const meta = isLiked
    ? { isLoading: likedQ.isLoading, isError: likedQ.isError, error: likedQ.error, data: likedQ.data ? likedMusicList(likedQ.data) : undefined }
    : realMeta;
  const content = isLiked
    ? { isLoading: likedQ.isLoading, isError: likedQ.isError, error: likedQ.error, data: { list: likedQ.data ?? [], total: likedQ.data?.length ?? 0 } }
    : realContent;

  const list: MyListItem | undefined = meta.data;
  const rows: MyListContentItem[] = content.data?.list ?? [];
  const songs = rows.filter((r) => !r.type || r.type === 'MUSIC');
  const seeds: TrackSeed[] = songs.map((r) => ({ id: r.contentId, title: r.title, artist: r.author, cover: r.coverUrl }));
  const source = { kind: 'playlist' as const, name: list?.name || '歌单', href: playlistHref(id) };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['my-lists'] });
    qc.invalidateQueries({ queryKey: ['liked-music'] });
  };

  // 顺序 / 移除先改本地缓存再发请求,失败了重新拉
  const setRows = (next: MyListContentItem[]) =>
    qc.setQueryData(['my-lists', 'content', id], { list: next, total: next.length });

  const reorder = useMutation({
    mutationFn: (next: MyListContentItem[]) => reorderMyList(id, next.map((r) => r.contentId)),
    onMutate: (next) => setRows(next),
    onError: (e) => {
      setToast(`排序没保存上:${formatApiError(e)}`);
      refresh();
    },
  });

  const remove = useMutation({
    mutationFn: (row: MyListContentItem) => removeFromMyList(id, row.contentId),
    onMutate: (row) => setRows(rows.filter((r) => r.contentId !== row.contentId)),
    onSuccess: () => refresh(),
    onError: (e) => {
      setToast(`移除失败:${formatApiError(e)}`);
      refresh();
    },
  });

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = rows.slice();
    [next[i], next[j]] = [next[j], next[i]];
    reorder.mutate(next);
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}${playlistHref(id)}`);
      setToast('链接已复制');
    } catch {
      setToast('复制失败,请手动复制地址栏');
    }
  };

  if (meta.isLoading) {
    return (
      <Shell>
        <Center>
          <CircularProgress size={28} />
        </Center>
      </Shell>
    );
  }
  if (meta.isError || !list) {
    return (
      <Shell>
        <Empty
          title="看不到这张歌单"
          hint={meta.isError ? formatApiError(meta.error) : '它可能已被删除,或者主人没有公开。'}
          action={
            <Button variant="outlined" onClick={() => router.push('/playlist')}>
              我的歌单
            </Button>
          }
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <Box sx={{ display: 'flex', gap: { xs: 2, md: 3.5 }, flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'center', sm: 'flex-end' }, mb: 3 }}>
        <Box sx={{ width: { xs: 180, md: 220 }, boxShadow: 6, borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
          <PlaylistCover covers={list.covers} coverUrl={list.coverUrl} size="100%" radius={0} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1, textAlign: { xs: 'center', sm: 'left' } }}>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: { xs: 'center', sm: 'flex-start' }, mb: 1 }}>
            <Chip size="small" label="歌单" />
            <Chip size="small" variant="outlined" label={list.isPublic ? '公开' : '仅自己可见'} />
          </Box>
          <Typography component="h1" sx={{ fontSize: { xs: 24, md: 34 }, fontWeight: 800, lineHeight: 1.2, wordBreak: 'break-word' }}>
            {list.name}
          </Typography>
          {list.description && <Typography sx={{ mt: 1, fontSize: 14, color: 'text.secondary', whiteSpace: 'pre-wrap' }}>{list.description}</Typography>}
          <Typography sx={{ mt: 1, fontSize: 13, color: 'text.secondary' }}>
            {songs.length} 首{list.updateTime ? ` · 更新于 ${list.updateTime.slice(0, 10)}` : ''}
          </Typography>

          <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: { xs: 'center', sm: 'flex-start' }, alignItems: 'center' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrowRoundedIcon />}
              disabled={seeds.length === 0}
              onClick={() => playTracks(seeds, { shuffle: false, source })}
              sx={{ borderRadius: 999, px: 3 }}
            >
              播放全部
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<ShuffleRoundedIcon />}
              disabled={seeds.length < 2}
              onClick={() => playTracks(seeds, { shuffle: true, source })}
              sx={{ borderRadius: 999 }}
            >
              随机播放
            </Button>
            <Tooltip title="加到当前播放队列后面">
              <span>
                <IconButton
                  disabled={seeds.length === 0}
                  aria-label="加入播放队列"
                  onClick={() => {
                    const n = queueTracks(seeds);
                    setToast(n > 0 ? `已加入队列 · ${n} 首` : '这些歌已经在队列里了');
                  }}
                >
                  <PlaylistAddRoundedIcon />
                </IconButton>
              </span>
            </Tooltip>
            {list.isPublic && (
              <Tooltip title="复制分享链接">
                <IconButton aria-label="复制分享链接" onClick={share}>
                  <IosShareRoundedIcon />
                </IconButton>
              </Tooltip>
            )}
            {list.mine && (
              <>
                <Tooltip title="编辑歌单信息">
                  <IconButton aria-label="编辑歌单信息" onClick={() => setEditOpen(true)}>
                    <EditRoundedIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="删除歌单">
                  <IconButton aria-label="删除歌单" onClick={() => setConfirmDelete(true)}>
                    <DeleteOutlineRoundedIcon />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Box>
        </Box>
      </Box>

      {content.isLoading ? (
        <Center>
          <CircularProgress size={24} />
        </Center>
      ) : content.isError ? (
        <Alert severity="error">歌曲加载失败:{formatApiError(content.error)}</Alert>
      ) : rows.length === 0 ? (
        <Empty
          title={isLiked ? '还没有点赞过歌曲' : '这张歌单还是空的'}
          hint={isLiked ? '在歌曲页点个赞,它就会出现在这里。' : list.mine ? '去搜几首歌,在歌曲页或播放队列里点「加入歌单」。' : ''}
          action={
            list.mine || isLiked ? (
              <Button variant="outlined" onClick={() => router.push('/search?type=MUSIC')}>
                去找歌
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Box sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden', bgcolor: 'background.paper' }}>
          {rows.map((r, i) => {
            const isPlaying = String(playingId) === String(r.contentId);
            const isSong = !r.type || r.type === 'MUSIC';
            return (
              <Box
                key={String(r.contentId)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: { xs: 1.5, md: 2 },
                  py: 1,
                  borderTop: i === 0 ? 'none' : '1px solid',
                  borderColor: 'divider',
                  '&:hover': { bgcolor: 'action.hover' },
                  '&:hover .ops, &:focus-within .ops': { opacity: 1 },
                }}
              >
                <Box sx={{ width: 24, textAlign: 'center', fontSize: 13, color: isPlaying ? 'primary.main' : 'text.secondary', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  {isPlaying ? <GraphicEqRoundedIcon sx={{ fontSize: 18, verticalAlign: 'middle' }} /> : i + 1}
                </Box>
                <Box
                  component="button"
                  type="button"
                  disabled={!isSong}
                  aria-label={`播放 ${r.title}`}
                  onClick={() => playTracks(seeds, { startId: r.contentId, source })}
                  sx={{ all: 'unset', display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0, cursor: isSong ? 'pointer' : 'default', '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', borderRadius: 1 } }}
                >
                  <Box sx={{ width: 44, height: 44, borderRadius: 1.5, overflow: 'hidden', bgcolor: 'action.selected', flexShrink: 0 }}>
                    {r.coverUrl && <Box component="img" src={mediaUrl(r.coverUrl)} alt="" loading="lazy" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ fontSize: 14, fontWeight: 600, color: isPlaying ? 'primary.main' : 'text.primary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</Box>
                    <Box sx={{ fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.author || '未知歌手'}</Box>
                  </Box>
                </Box>
                {list.mine && (
                  <Box className="ops" sx={{ display: 'flex', opacity: { xs: 1, md: 0 }, transition: 'opacity 120ms', flexShrink: 0 }}>
                    <IconButton size="small" aria-label={`上移 ${r.title}`} disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUpwardRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                    <IconButton size="small" aria-label={`下移 ${r.title}`} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDownwardRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                    <IconButton size="small" aria-label={`从歌单移除 ${r.title}`} onClick={() => remove.mutate(r)}>
                      <RemoveCircleOutlineRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      <EditDialog
        open={editOpen}
        title="编辑歌单"
        initial={list}
        onClose={() => setEditOpen(false)}
        onSubmit={async (v) => {
          await updateMyList(id, v);
          refresh();
        }}
      />

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 17 }}>删除「{list.name}」?</DialogTitle>
        <DialogContent sx={{ fontSize: 14, color: 'text.secondary' }}>歌单删除后无法恢复,里面的歌曲本身不受影响。</DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setConfirmDelete(false)}>
            取消
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={async () => {
              try {
                await deleteMyList(id);
                refresh();
                router.replace('/playlist');
              } catch (e) {
                setConfirmDelete(false);
                setToast(`删除失败:${formatApiError(e)}`);
              }
            }}
          >
            删除
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={2600} onClose={() => setToast('')} message={toast} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} />
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// 小件
// ---------------------------------------------------------------------------

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <PublicTopBar title="歌单" maxWidth="md" icon={<QueueMusicRoundedIcon sx={{ fontSize: 18 }} />} />
      <Container maxWidth="md" sx={{ py: { xs: 2.5, md: 4 } }}>
        {children}
      </Container>
    </Box>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <Box sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>{children}</Box>;
}

function Empty({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <Box sx={{ py: 8, textAlign: 'center' }}>
      <QueueMusicRoundedIcon sx={{ fontSize: 44, color: 'text.disabled' }} />
      <Typography sx={{ mt: 1.5, fontSize: 16, fontWeight: 700 }}>{title}</Typography>
      {hint && <Typography sx={{ mt: 0.75, fontSize: 13, color: 'text.secondary' }}>{hint}</Typography>}
      {action && <Box sx={{ mt: 2.5 }}>{action}</Box>}
    </Box>
  );
}

function EditDialog({
  open,
  title,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initial?: Pick<MyListItem, 'name' | 'description' | 'isPublic'>;
  onClose: () => void;
  onSubmit: (v: { name: string; description: string; isPublic: boolean }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // 每次打开按最新的 initial 重置
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(initial?.name ?? '');
      setDescription(initial?.description ?? '');
      setIsPublic(initial?.isPublic ?? false);
      setError('');
    }
  }

  const submit = async () => {
    if (!name.trim()) return setError('给歌单起个名字');
    setBusy(true);
    setError('');
    try {
      await onSubmit({ name: name.trim(), description: description.trim(), isPublic });
      onClose();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        <TextField autoFocus label="名称" size="small" value={name} onChange={(e) => setName(e.target.value)} slotProps={{ htmlInput: { maxLength: 40 } }} />
        <TextField label="简介(可选)" size="small" multiline minRows={2} value={description} onChange={(e) => setDescription(e.target.value)} slotProps={{ htmlInput: { maxLength: 300 } }} />
        <FormControlLabel
          control={<Switch checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />}
          label={<Box sx={{ fontSize: 14 }}>公开 —— 拿到链接的人都能看和播放</Box>}
        />
        {error && <Box sx={{ fontSize: 12, color: 'error.main' }}>{error}</Box>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="text" onClick={onClose} disabled={busy}>
          取消
        </Button>
        <Button variant="contained" onClick={submit} disabled={busy}>
          {busy ? <CircularProgress size={18} color="inherit" /> : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

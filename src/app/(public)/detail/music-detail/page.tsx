'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import QueueMusicIcon from '@mui/icons-material/QueueMusic';
import Tooltip from '@mui/material/Tooltip';
import { CollectButton } from '@/components/detail/CollectButton';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ShareIcon from '@mui/icons-material/Share';
import { useSearchParams, useRouter } from 'next/navigation';
import { detail as contentDetail } from '@/apis/content-music';
import { useContentInteraction } from '@/hooks/useContentInteraction';
import { formatApiError } from '@/lib/api/client';
import { AsyncState } from '@/components/common/AsyncState';
import { CoverImage } from '@/components/common/CoverImage';
import { mediaUrl } from '@/lib/media';
import { resolveMusic, parseLrc, type LyricLine } from '@/lib/player/resolveMusic';
import { useMusicPlayer, musicPlayer, currentTrack, type MusicTrack } from '@/lib/player/musicPlayer';
import { PlatformLinks, platformsOf } from '@/components/detail/ExternalPlatforms';
import { track, recordHistory } from '@/lib/track';
import { DetailComments } from '@/components/detail/DetailComments';
import { DetailFooter } from '@/components/detail/DetailFooter';

function fmtTime(s: number) {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function MusicDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const playlistId = searchParams.get('playlistId');

  const query = useQuery({
    queryKey: ['detail', 'music', id],
    queryFn: () => contentDetail('music', { id: id! }).then((r) => r.data as any),
    enabled: !!id,
  });

  // 进入详情:行为埋点(供榜单/推荐)+ 写观看历史。itemType 大写以匹配 Doris content_type。
  React.useEffect(() => {
    if (id) {
      track(id, 'view', 'MUSIC');
      recordHistory(id);
    }
  }, [id]);

  // 播放交给全局播放器(lib/player/musicPlayer):离开本页照样放,底栏接着控制。
  // 本页正在展示的歌是不是全局正在放的那首 —— 是才显示真实进度/状态。
  const isCurrent = useMusicPlayer((s) => currentTrack(s)?.id === id);
  const playing = useMusicPlayer((s) => isCurrent && s.playing);
  const currentTime = useMusicPlayer((s) => (isCurrent ? s.currentTime : 0));
  const playerDuration = useMusicPlayer((s) => (isCurrent ? s.duration : 0));
  const volume = useMusicPlayer((s) => Math.round((s.muted ? 0 : s.volume) * 100));
  const playerError = useMusicPlayer((s) => (isCurrent ? s.error : null));
  const inQueue = useMusicPlayer((s) => s.queue.some((q) => q.id === id));
  const duration = playerDuration || Number(query.data?.duration) || 0;
  const [scrub, setScrub] = useState<number | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const lyricRef = useRef<HTMLDivElement>(null);
  // 实时获取的音频URL和歌词
  const [realAudioUrl, setRealAudioUrl] = useState<string>('');
  const [realLyrics, setRealLyrics] = useState<LyricLine[]>([]);
  const [audioLoading, setAudioLoading] = useState(false);
  // <audio> 加载失败(实时签名地址过期、源站拒绝)—— 和"压根没有音源"一样要让用户看见。
  const audioFailed = !!playerError;

  const lyrics = realLyrics.length > 0 ? realLyrics : parseLrc(query.data?.lyrics);
  // 歌词同步跟着全局播放进度走
  const activeLyric = React.useMemo(() => {
    const idx = lyrics.findIndex((l, i) => {
      const next = lyrics[i + 1];
      return currentTime >= l.time && (!next || currentTime < next.time);
    });
    return Math.max(0, idx);
  }, [lyrics, currentTime]);

  // 音源一律经 mediaUrl:MinIO 直链换成同源网关地址,源站 http 直链包进 /api/proxy
  // (补 Referer、避开 https 页面对混合内容的拦截)。
  const audioSrc = realAudioUrl || mediaUrl(query.data?.audioUrl);
  const sourcePage: string = query.data?.sourceUrl || query.data?.source || '';
  const audioUnavailable = query.isSuccess && !audioLoading && (!audioSrc || audioFailed);
  const audioNotice = audioFailed
    ? '音源加载失败（可能已过期或受版权限制），请刷新重试或前往原平台收听'
    : query.data?.audioNotice || '暂无可播放音源（版权或平台限制），可前往原平台收听';
  // VIP 歌曲只拿得到试听片段:照常能播,但要说清楚这不是整首。
  const audioIsPreview = !audioUnavailable && query.data?.audioStatus === 'preview';

  const notify = useCallback((message: string, severity: 'success' | 'error' | 'info' = 'success') => {
    setSnack({ open: true, message, severity });
  }, []);

  // 赞:真实状态从 /interaction 读,操作后以服务端为准并给出提示(见 hooks/useContentInteraction)
  const { liked, likeDelta: optimisticLikes, likeBusy, toggleLike: handleLike } = useContentInteraction(id, { notify });

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const title = query.data?.title || '音乐详情';
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        notify('链接已复制到剪贴板');
      } else {
        notify('当前环境不支持分享', 'info');
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        notify('分享失败', 'error');
      }
    }
  };

  // 实时获取音频URL和歌词(详情里没有 audioUrl 时走爬虫按 hash 取)
  useEffect(() => {
    if (!id || !query.data) return;
    let cancelled = false;
    setAudioLoading(!query.data.audioUrl);
    resolveMusic(query.data)
      .then(({ src, lyrics: lrc }) => {
        if (cancelled) return;
        setRealAudioUrl(src);
        if (lrc.length > 0) setRealLyrics(lrc);
      })
      .finally(() => {
        if (!cancelled) setAudioLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, query.data]);

  const toTrack = (): MusicTrack | null => {
    if (!id || !audioSrc) return null;
    const d = query.data || {};
    return {
      id,
      title: d.title || '未知歌曲',
      artist: d.artist || '',
      album: d.album || '',
      cover: mediaUrl(d.cover),
      src: audioSrc,
      href: `/detail/music-detail?id=${encodeURIComponent(id)}`,
      preview: d.audioStatus === 'preview',
    };
  };

  const togglePlay = () => {
    if (audioUnavailable) {
      notify(audioNotice, 'info');
      return;
    }
    if (isCurrent) {
      musicPlayer.toggle();
      return;
    }
    const t = toTrack();
    if (t) musicPlayer.play(t);
  };

  const addToQueue = () => {
    const t = toTrack();
    if (!t) {
      notify(audioNotice, 'info');
      return;
    }
    notify(musicPlayer.enqueue(t) ? '已加入播放队列' : '已在播放队列中', 'info');
  };

  useEffect(() => {
    if (lyricRef.current) {
      const el = lyricRef.current.querySelector(`[data-idx="${activeLyric}"]`) as HTMLElement;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeLyric]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* 顶部条 */}
      <Box sx={{ display: 'flex', alignItems: 'center', p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <IconButton onClick={() => router.back()} sx={{ color: 'text.tertiary' }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary', ml: 1 }}>
          {query.data?.title || '音乐详情'}
        </Typography>
      </Box>

      <AsyncState query={query} isEmpty={(d) => !d}>
        {(data) => (
          <Container maxWidth="lg" sx={{ py: 3 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '280px 1fr' }, gap: 3, mb: 3 }}>
              <Box>
                <CoverImage
                  src={data.cover}
                  alt={data.title}
                  sx={{
                    width: '100%',
                    aspectRatio: '1/1',
                    borderRadius: 2,
                    boxShadow: '0 8px 32px rgba(254, 44, 85, 0.25)',
                    animation: playing ? 'spin 20s linear infinite' : 'none',
                    '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
                  }}
                />
                <Typography variant="h6" sx={{ color: 'text.primary', mt: 2, fontWeight: 700 }}>
                  {data.title}
                </Typography>
                <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
                  {data.artist} · {data.album}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                  <Chip label={data.release} size="small" variant="outlined" sx={{ borderColor: 'divider', color: 'text.secondary' }} />
                </Box>
              </Box>

              <Box
                ref={lyricRef}
                sx={{
                  height: { xs: 280, sm: 380 },
                  overflow: 'auto',
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  p: 2,
                  '&::-webkit-scrollbar': { width: 4 },
                  '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 2 },
                }}
              >
                {lyrics.length === 0 ? (
                  <Typography sx={{ p: 4, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>
                    暂无歌词
                  </Typography>
                ) : (
                  lyrics.map((l, idx) => (
                    <Box
                      key={idx}
                      data-idx={idx}
                      sx={{
                        py: 1,
                        color: idx === activeLyric ? 'primary.main' : 'text.secondary',
                        fontSize: idx === activeLyric ? 18 : 14,
                        fontWeight: idx === activeLyric ? 600 : 400,
                        textAlign: 'center',
                        transition: 'all 0.2s',
                        transform: idx === activeLyric ? 'scale(1.05)' : 'scale(1)',
                      }}
                    >
                      {l.text}
                    </Box>
                  ))
                )}
              </Box>
            </Box>

            {/* 音频加载提示 */}
            {audioLoading && (
              <Typography sx={{ fontSize: 12, color: 'text.secondary', textAlign: 'center', mb: 1 }}>
                正在加载音频...
              </Typography>
            )}

            {/* 没有音源的歌照样收录、照样搜得到 —— 但必须明说放不了,并给出原平台入口 */}
            {(audioUnavailable || audioIsPreview) && (
              <Alert
                severity={audioIsPreview ? 'info' : 'warning'}
                variant="outlined"
                sx={{ mb: 2 }}
                action={
                  sourcePage ? (
                    <Button color="inherit" size="small" href={sourcePage} target="_blank" rel="noopener noreferrer">
                      去原平台收听
                    </Button>
                  ) : undefined
                }
              >
                {audioNotice}
              </Alert>
            )}
            {audioUnavailable && platformsOf(query.data).length > 1 && (
              <Box sx={{ mb: 2 }}>
                <PlatformLinks platforms={platformsOf(query.data)} dense />
              </Box>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', minWidth: 36, textAlign: 'right' }}>
                {fmtTime(scrub ?? currentTime)}
              </Typography>
              <Slider
                size="small"
                aria-label="播放进度"
                value={Math.min(scrub ?? currentTime, duration || 0)}
                max={duration || 1}
                disabled={!isCurrent || !duration}
                onChange={(_, v) => setScrub(v as number)}
                onChangeCommitted={(_, v) => {
                  musicPlayer.seek(v as number);
                  setScrub(null);
                }}
                sx={{ color: 'primary.main' }}
              />
              <Typography sx={{ fontSize: 11, color: 'text.secondary', minWidth: 36 }}>
                {fmtTime(duration)}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
              <IconButton aria-label="上一首" disabled={!isCurrent} onClick={() => musicPlayer.prev()} sx={{ color: 'text.tertiary' }}>
                <SkipPreviousIcon fontSize="large" />
              </IconButton>
              <IconButton
                onClick={togglePlay}
                disabled={audioUnavailable}
                aria-label={audioUnavailable ? audioNotice : playing ? '暂停' : '播放'}
                sx={{
                  bgcolor: 'primary.main',
                  color: 'text.primary',
                  '&:hover': { bgcolor: '#E0264B' },
                  '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'text.disabled' },
                  width: 56,
                  height: 56,
                }}
              >
                {playing ? <PauseIcon fontSize="large" /> : <PlayArrowIcon fontSize="large" />}
              </IconButton>
              <IconButton aria-label="下一首" disabled={!isCurrent} onClick={() => musicPlayer.next()} sx={{ color: 'text.tertiary' }}>
                <SkipNextIcon fontSize="large" />
              </IconButton>
              <Box sx={{ width: 16 }} />
              <VolumeUpIcon sx={{ color: 'text.secondary' }} />
              <Slider
                size="small"
                value={volume}
                aria-label="音量"
                onChange={(_, v) => musicPlayer.setVolume((v as number) / 100)}
                sx={{ color: 'primary.main', width: 100, ml: 1 }}
              />
              <Box sx={{ flex: 1 }} />
              <Tooltip title={inQueue ? '已在播放队列' : '加入播放队列(边浏览边听)'}>
                <span>
                  <IconButton onClick={addToQueue} disabled={audioUnavailable} aria-label="加入播放队列" sx={{ color: inQueue ? 'primary.main' : 'text.secondary' }}>
                    <QueueMusicIcon />
                  </IconButton>
                </span>
              </Tooltip>
              <IconButton
                onClick={handleLike}
                disabled={likeBusy}
                sx={{ color: liked ? 'primary.main' : 'text.secondary' }}
              >
                {liked ? <ThumbUpIcon /> : <ThumbUpOutlinedIcon />}
              </IconButton>
              <CollectButton contentId={id!} contentType="music" />
              <IconButton onClick={handleShare} sx={{ color: 'text.secondary' }}>
                <ShareIcon />
              </IconButton>
            </Box>

            <Divider sx={{ borderColor: 'divider', my: 3 }} />

            <Typography variant="h6" sx={{ color: 'text.primary', mb: 1.5 }}>
              歌曲简介
            </Typography>
            <Typography sx={{ color: 'text.tertiary', fontSize: 14, lineHeight: 1.8, mb: 3 }}>
              {data.info}
            </Typography>

            <DetailFooter contentId={id!} detail={data} kind="watch" />
            <DetailComments contentId={id!} initialCount={data.commentCount || 0} />
          </Container>
        )}
      </AsyncState>

      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} variant="filled" sx={{ width: '100%' }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default function MusicDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <MusicDetailContent />
    </React.Suspense>
  );
}

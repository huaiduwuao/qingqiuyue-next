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
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { CollectButton } from '@/components/detail/CollectButton';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ShareIcon from '@mui/icons-material/Share';
import { useSearchParams, useRouter } from 'next/navigation';
import { detail as contentDetail } from '@/apis/content-music';
import { moduleContentAction } from '@/apis/home';
import { formatApiError } from '@/lib/api/client';
import { AsyncState } from '@/components/common/AsyncState';
import { CoverImage } from '@/components/common/CoverImage';
import { track, recordHistory } from '@/lib/track';
import { DetailComments } from '@/components/detail/DetailComments';
import { spiderClient } from '@/lib/api/client';

interface LyricLine {
  time: number;
  text: string;
}

function normalizeLyrics(value: unknown): LyricLine[] {
  if (Array.isArray(value)) return value as LyricLine[];
  if (typeof value !== 'string') return [];
  return value.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
    if (!match) return [];
    return [{ time: Number(match[1]) * 60 + Number(match[2]), text: match[3].trim() }];
  });
}

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

  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(180);
  const [volume, setVolume] = useState(70);
  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [optimisticLikes, setOptimisticLikes] = useState(0);
  const [activeLyric, setActiveLyric] = useState(0);
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

  const lyrics = realLyrics.length > 0 ? realLyrics : normalizeLyrics(query.data?.lyrics);

  const notify = useCallback((message: string, severity: 'success' | 'error' | 'info' = 'success') => {
    setSnack({ open: true, message, severity });
  }, []);

  const handleLike = async () => {
    if (!id) {
      notify('内容 ID 缺失', 'error');
      return;
    }
    if (likeBusy) return;
    setLikeBusy(true);
    const next = !liked;
    setLiked(next);
    setOptimisticLikes((prev) => Math.max(0, prev + (next ? 1 : -1)));
    try {
      await moduleContentAction({ contentId: id, action: next ? 'agree' : 'cancel_agree' });
    } catch (err) {
      setLiked(!next);
      setOptimisticLikes((prev) => Math.max(0, prev + (next ? -1 : 1)));
      notify(formatApiError(err), 'error');
    } finally {
      setLikeBusy(false);
    }
  };

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

  // 解析 LRC 格式歌词
  const parseLrcLyrics = (lrcText: string): LyricLine[] => {
    if (!lrcText) return [];
    return lrcText.split(/\r?\n/).flatMap((line) => {
      const match = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
      if (!match) return [];
      return [{ time: Number(match[1]) * 60 + Number(match[2]), text: match[3].trim() }];
    });
  };

  // 提取 hash 从 playSources 或 source
  const extractHash = (): string | null => {
    const playSources = query.data?.playSources as Array<{ source?: string; sourceUrl?: string }>;
    const source = query.data?.source as string;
    const sourceUrl = query.data?.sourceUrl as string;

    const urls = [source, sourceUrl, ...(playSources || []).map(p => p.source || p.sourceUrl)].filter(Boolean);
    for (const url of urls) {
      const match = String(url).match(/hash=([a-f0-9]+)/i);
      if (match) return match[1];
    }
    return null;
  };

  // 实时获取音频URL和歌词
  useEffect(() => {
    if (!id || !query.data) return;

    const fetchAudioAndLyrics = async () => {
      // 优先使用已有的 audioUrl
      if (query.data?.audioUrl) {
        setRealAudioUrl(query.data.audioUrl);
        return; // 已有音频URL，不需要再请求
      }

      // 尝试从后端获取音频URL
      const hash = extractHash();
      if (hash) {
        setAudioLoading(true);
        try {
          // 调用爬虫 API 获取音频 URL
          const audioRes = await spiderClient(`/music/audio/${hash}`);
          const audioData = (audioRes as any)?.data;
          if (audioData?.audio_url) {
            setRealAudioUrl(audioData.audio_url);
          }
          // 获取歌词
          const detailRes = await spiderClient(`/music/detail/${hash}`);
          const detailData = (detailRes as any)?.data;
          if (detailData?.lyrics_lrc || detailData?.lyrics) {
            const lrcText = detailData?.lyrics_lrc || detailData?.lyrics;
            const parsed = parseLrcLyrics(lrcText);
            if (parsed.length > 0) {
              setRealLyrics(parsed);
            }
          }
          // 如果歌词也在详情数据里
          if (detailData?.lyrics) {
            const parsed = parseLrcLyrics(detailData.lyrics);
            if (parsed.length > 0 && realLyrics.length === 0) {
              setRealLyrics(parsed);
            }
          }
        } catch (err) {
          console.error('获取音频/歌词失败:', err);
        } finally {
          setAudioLoading(false);
        }
      }
    };

    fetchAudioAndLyrics();
  }, [id, query.data, query.isSuccess]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
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
          <Container maxWidth="md" sx={{ py: 3 }}>
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

            {(realAudioUrl || data.audioUrl) && (
              <audio
                ref={audioRef}
                src={realAudioUrl || data.audioUrl}
                onTimeUpdate={() => {
                  setCurrentTime(audioRef.current?.currentTime ?? 0);
                  // 歌词同步
                  if (lyrics.length > 0) {
                    const ct = audioRef.current?.currentTime ?? 0;
                    const idx = lyrics.findIndex((l, i) => {
                      const next = lyrics[i + 1];
                      return ct >= l.time && (!next || ct < next.time);
                    });
                    if (idx >= 0) setActiveLyric(idx);
                  }
                }}
                onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 180)}
                onEnded={() => { setPlaying(false); setCurrentTime(0); }}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                style={{ display: 'none' }}
              />
            )}

            {/* 音频加载提示 */}
            {audioLoading && (
              <Typography sx={{ fontSize: 12, color: 'text.secondary', textAlign: 'center', mb: 1 }}>
                正在加载音频...
              </Typography>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', minWidth: 36, textAlign: 'right' }}>
                {fmtTime(currentTime)}
              </Typography>
              <Slider
                size="small"
                value={currentTime}
                max={duration || 180}
                onChange={(_, v) => {
                  setCurrentTime(v as number);
                  if (audioRef.current) audioRef.current.currentTime = v as number;
                }}
                sx={{ color: 'primary.main' }}
              />
              <Typography sx={{ fontSize: 11, color: 'text.secondary', minWidth: 36 }}>
                {fmtTime(duration || 180)}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
              <IconButton onClick={() => { if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play().catch(() => {}); } }} sx={{ color: 'text.tertiary' }}>
                <SkipPreviousIcon fontSize="large" />
              </IconButton>
              <IconButton
                onClick={togglePlay}
                sx={{
                  bgcolor: 'primary.main',
                  color: 'text.primary',
                  '&:hover': { bgcolor: '#E0264B' },
                  width: 56,
                  height: 56,
                }}
              >
                {playing ? <PauseIcon fontSize="large" /> : <PlayArrowIcon fontSize="large" />}
              </IconButton>
              <IconButton onClick={() => { if (audioRef.current) audioRef.current.currentTime = audioRef.current.duration || 0; }} sx={{ color: 'text.tertiary' }}>
                <SkipNextIcon fontSize="large" />
              </IconButton>
              <Box sx={{ width: 16 }} />
              <VolumeUpIcon sx={{ color: 'text.secondary' }} />
              <Slider
                size="small"
                value={volume}
                onChange={(_, v) => {
                  setVolume(v as number);
                  if (audioRef.current) audioRef.current.volume = (v as number) / 100;
                }}
                sx={{ color: 'primary.main', width: 100, ml: 1 }}
              />
              <Box sx={{ flex: 1 }} />
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

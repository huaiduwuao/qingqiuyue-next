'use client';

import React, { useState, useRef, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Divider from '@mui/material/Divider';
import LibraryMusicRoundedIcon from '@mui/icons-material/LibraryMusicRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import AudioFileRoundedIcon from '@mui/icons-material/AudioFileRounded';
import GraphicEqRoundedIcon from '@mui/icons-material/GraphicEqRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useContentForm, normalizeTags, uploadOneFile } from '../useContentForm';
import { gradient2 } from '@/constants/gradients';
import type { PublishFormProps } from './types';

// 音乐发布 (MUSIC) — 真实表单。
//
// 字段:歌名 / 艺人 / 专辑 / 流派 / 心情(标签) / 1:1 封面(选填) /
// 音频文件(必填 mp3/flac/wav) / LRC 歌词(选填,带时间轴)。
const MAX_TITLE = 40;
const MAX_ARTIST = 40;
const MAX_ALBUM = 40;
const MAX_LYRIC = 5000;
const MAX_TAGS = 8;

type CoverStatus = 'idle' | 'uploading' | 'uploaded' | 'failed';
type AudioStatus = 'idle' | 'uploading' | 'uploaded' | 'failed';

export default function MusicForm({ onSuccess }: PublishFormProps) {
  const coverInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [lyric, setLyric] = useState('');
  const [cover, setCover] = useState<{
    file: File;
    previewUrl: string;
    status: CoverStatus;
    uploadedUrl?: string;
  } | null>(null);
  const [audio, setAudio] = useState<{
    file: File;
    status: AudioStatus;
    uploadedUrl?: string;
    sizeMB: number;
    durationSec?: number;
  } | null>(null);

  // 音乐:title(歌名)必填,desc/艺人/专辑选填,音频必填
  const f = useContentForm<any>({
    contentType: 'MUSIC',
    maxTitle: MAX_TITLE,
    maxDesc: 0, // 不用 hook 的 desc(改用自己加的 artist/album)
    maxTags: MAX_TAGS,
    requireTitle: true,
    requireDesc: false,
    onSuccess: () => {
      if (cover?.previewUrl) URL.revokeObjectURL(cover.previewUrl);
      onSuccess?.();
    },
    validate: () => {
      if (!audio) return '请先上传音频文件';
      if (audio.status !== 'uploaded') return '音频上传未完成';
      if (lyric.length > MAX_LYRIC) return `歌词超出 ${MAX_LYRIC} 字`;
      return null;
    },
    buildPayload: () => ({
      title: f.title.trim(),
      subtitle: artist.trim().slice(0, MAX_ARTIST) || undefined,
      content: JSON.stringify({
        audioUrl: audio?.uploadedUrl,
        audioSizeMB: audio?.sizeMB,
        audioDurationSec: audio?.durationSec,
        artist: artist.trim() || undefined,
        album: album.trim() || undefined,
        lyrics: lyric,
      }),
      contentType: 'MUSIC',
      coverUrl: cover?.uploadedUrl,
      audioUrl: audio?.uploadedUrl,
      audioSizeMB: audio?.sizeMB,
      audioDurationSec: audio?.durationSec,
      artist: artist.trim() || undefined,
      album: album.trim() || undefined,
      status: 'reviewing',
      tags: normalizeTags(f.tags, MAX_TAGS),
    }),
  });

  // 封面
  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      f.setSnack({ msg: '封面必须是图片', severity: 'warning' });
      return;
    }
    if (cover?.previewUrl) URL.revokeObjectURL(cover.previewUrl);
    const previewUrl = URL.createObjectURL(file);
    setCover({ file, previewUrl, status: 'uploading' });
    const url = await uploadOneFile(file);
    if (url) {
      setCover((c) => (c ? { ...c, status: 'uploaded', uploadedUrl: url } : c));
      f.setSnack({ msg: '封面上传成功', severity: 'success' });
    } else {
      setCover((c) => (c ? { ...c, status: 'failed' } : c));
      f.setSnack({ msg: '封面上传失败,请重试', severity: 'error' });
    }
  };
  const removeCover = () => {
    if (cover?.previewUrl) URL.revokeObjectURL(cover.previewUrl);
    setCover(null);
  };

  // 音频 — 用 HTMLAudioElement 读 duration
  const handleAudioChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      f.setSnack({ msg: '必须是音频文件 (mp3 / flac / wav / m4a)', severity: 'warning' });
      return;
    }
    const sizeMB = Number((file.size / 1024 / 1024).toFixed(1));
    // 用 Audio element 读 duration
    const url = URL.createObjectURL(file);
    const audioEl = new Audio();
    audioEl.preload = 'metadata';
    audioEl.src = url;
    const durationSec = await new Promise<number | undefined>((resolve) => {
      const onLoaded = () => {
        resolve(audioEl.duration);
        audioEl.removeEventListener('loadedmetadata', onLoaded);
        URL.revokeObjectURL(url);
      };
      const onError = () => {
        resolve(undefined);
        audioEl.removeEventListener('error', onError);
        URL.revokeObjectURL(url);
      };
      audioEl.addEventListener('loadedmetadata', onLoaded);
      audioEl.addEventListener('error', onError);
    });
    setAudio({ file, status: 'uploading', sizeMB, durationSec });
    const uploadedUrl = await uploadOneFile(file);
    if (uploadedUrl) {
      setAudio((a) => (a ? { ...a, status: 'uploaded', uploadedUrl } : a));
      f.setSnack({ msg: '音频上传成功', severity: 'success' });
    } else {
      setAudio((a) => (a ? { ...a, status: 'failed' } : a));
      f.setSnack({ msg: '音频上传失败,请重试', severity: 'error' });
    }
  };
  const removeAudio = () => setAudio(null);

  const canSubmitFinal = useMemo(
    () =>
      f.canSubmit &&
      audio !== null &&
      audio.status === 'uploaded' &&
      !!audio.uploadedUrl,
    [f.canSubmit, audio],
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2.5,
        }}
      >
        {/* 左:歌名 / 艺人 / 专辑 / 标签 / 封面 / 提交 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            value={f.title}
            onChange={(e) => f.setTitle(e.target.value)}
            placeholder="歌名"
            slotProps={{
              htmlInput: {
                maxLength: MAX_TITLE,
                style: { fontSize: 18, fontWeight: 600 },
              },
              formHelperText: { sx: { textAlign: 'right', fontSize: 10, m: 0, mt: 0.25 } },
            }}
            helperText={`${f.title.length} / ${MAX_TITLE}`}
          />

          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              艺人(选填)
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={artist}
              onChange={(e) => setArtist(e.target.value.slice(0, MAX_ARTIST))}
              placeholder="表演者 / 歌手 / 乐队"
              slotProps={{
                htmlInput: { maxLength: MAX_ARTIST },
                formHelperText: { sx: { textAlign: 'right', fontSize: 10, m: 0, mt: 0.25 } },
              }}
              helperText={`${artist.length} / ${MAX_ARTIST}`}
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              专辑(选填)
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={album}
              onChange={(e) => setAlbum(e.target.value.slice(0, MAX_ALBUM))}
              placeholder="所属专辑"
              slotProps={{
                htmlInput: { maxLength: MAX_ALBUM },
                formHelperText: { sx: { textAlign: 'right', fontSize: 10, m: 0, mt: 0.25 } },
              }}
              helperText={`${album.length} / ${MAX_ALBUM}`}
            />
          </Box>

          {/* 封面 — 1:1 方形 */}
          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              封面(选填,推荐 1:1 方形 300×300)
            </Typography>
            {cover ? (
              <Box
                sx={{
                  position: 'relative',
                  width: 140,
                  aspectRatio: '1 / 1',
                  borderRadius: 1.5,
                  overflow: 'hidden',
                  bgcolor: 'action.hover',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <img
                  src={cover.previewUrl}
                  alt={cover.file.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {cover.status === 'uploading' && (
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      bgcolor: 'rgba(0,0,0,0.45)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <LinearProgress sx={{ width: '70%' }} />
                  </Box>
                )}
                {cover.status === 'failed' && (
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      bgcolor: 'rgba(254, 44, 85, 0.85)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    失败
                  </Box>
                )}
                <IconButton
                  size="small"
                  onClick={removeCover}
                  aria-label="删除封面"
                  sx={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    bgcolor: 'rgba(15, 23, 42, 0.6)',
                    color: '#fff',
                    p: 0.25,
                    '&:hover': { bgcolor: 'rgba(15, 23, 42, 0.85)' },
                  }}
                >
                  <CloseRoundedIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
            ) : (
              <Box
                onClick={() => coverInputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="上传封面"
                sx={{
                  width: 140,
                  aspectRatio: '1 / 1',
                  borderRadius: 1.5,
                  border: '1.5px dashed',
                  borderColor: 'divider',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5,
                  cursor: 'pointer',
                  bgcolor: 'background.default',
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                }}
              >
                <CloudUploadRoundedIcon sx={{ fontSize: 24, color: 'text.secondary' }} />
                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                  1:1 封面
                </Typography>
              </Box>
            )}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverChange}
              style={{ display: 'none' }}
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              标签(流派 / 心情,逗号分隔)
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={f.tags}
              onChange={(e) => f.setTags(e.target.value)}
              placeholder="流行, 治愈, 民谣..."
              helperText="例如:流行, 治愈, 民谣"
              slotProps={{
                formHelperText: { sx: { fontSize: 10, m: 0, mt: 0.25 } },
              }}
            />
          </Box>

          <Divider />

          <Box
            sx={{
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: gradient2('#34D399', '#6EE7B7'),
              color: '#0F172A',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <LibraryMusicRoundedIcon sx={{ fontSize: 16 }} />
              <Typography sx={{ fontSize: 12, fontWeight: 700 }}>发布须知</Typography>
            </Box>
            <Typography sx={{ fontSize: 11, lineHeight: 1.7, opacity: 0.85 }}>
              音频必填,封面/艺人/专辑/LRC 歌词选填。
              LRC 歌词格式: [00:00.00]歌词。第一版不做 karaoke 预览,
              后续会加逐行时间轴编辑器和音频波形高亮。
            </Typography>
          </Box>

          <Button
            variant="contained"
            size="large"
            onClick={() => f.submit()}
            disabled={!canSubmitFinal}
            sx={{
              textTransform: 'none',
              fontSize: 14,
              fontWeight: 700,
              py: 1.25,
              background: 'linear-gradient(90deg, #34D399 0%, #FE2C55 100%)',
              '&:hover': { filter: 'brightness(1.08)' },
              '&.Mui-disabled': {
                background: 'action.disabledBackground',
                color: 'text.disabled',
              },
            }}
          >
            {f.isPending
              ? '发布中…'
              : audio?.status === 'uploading'
                ? '音频上传中…'
                : '发布'}
          </Button>
        </Box>

        {/* 右:音频文件 + LRC 歌词 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* 音频文件 — 必填,大面积 upload zone */}
          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              音频文件 <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
            {audio ? (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 1.5,
                  bgcolor: audio.status === 'failed' ? 'rgba(254, 44, 85, 0.08)' : 'action.hover',
                  border: '1px solid',
                  borderColor: audio.status === 'failed' ? 'error.main' : 'divider',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                  <GraphicEqRoundedIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontSize: 13,
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {audio.file.name}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                      {audio.sizeMB} MB
                      {audio.durationSec ? ` · ${formatDuration(audio.durationSec)}` : ''}
                      {' · '}
                      <Box
                        component="span"
                        sx={{
                          color:
                            audio.status === 'uploaded'
                              ? 'success.main'
                              : audio.status === 'failed'
                                ? 'error.main'
                                : 'warning.main',
                          fontWeight: 600,
                        }}
                      >
                        {audio.status === 'uploading'
                          ? '上传中…'
                          : audio.status === 'uploaded'
                            ? '已上传'
                            : audio.status === 'failed'
                              ? '上传失败'
                              : '待上传'}
                      </Box>
                    </Typography>
                  </Box>
                </Box>
                {audio.status === 'uploading' && (
                  <LinearProgress sx={{ mb: 1, borderRadius: 1 }} />
                )}
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    onClick={() => audioInputRef.current?.click()}
                    sx={{ textTransform: 'none', fontSize: 11 }}
                  >
                    替换
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    onClick={removeAudio}
                    sx={{ textTransform: 'none', fontSize: 11 }}
                  >
                    删除
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box
                onClick={() => audioInputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="上传音频"
                sx={{
                  p: 4,
                  borderRadius: 1.5,
                  border: '1.5px dashed',
                  borderColor: 'divider',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  cursor: 'pointer',
                  bgcolor: 'background.default',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <AudioFileRoundedIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                  点击选择音频文件
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  mp3 / flac / wav / m4a · 最大 50MB
                </Typography>
              </Box>
            )}
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/mp3,audio/flac,audio/wav,audio/m4a,audio/x-m4a,audio/mpeg,audio/*"
              onChange={handleAudioChange}
              style={{ display: 'none' }}
            />
          </Box>

          {/* LRC 歌词 */}
          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              LRC 歌词(选填)
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={10}
              size="small"
              value={lyric}
              onChange={(e) => setLyric(e.target.value.slice(0, MAX_LYRIC + 200))}
              placeholder={'[00:00.00]歌名 - 艺人\n[00:05.23]第一句歌词\n[00:10.50]第二句歌词\n[00:18.12]副歌...'}
              slotProps={{
                htmlInput: {
                  maxLength: MAX_LYRIC + 200,
                  style: {
                    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                    fontSize: 12,
                    lineHeight: 1.6,
                  },
                },
              }}
            />
            <Typography
              sx={{
                fontSize: 10,
                color: lyric.length > MAX_LYRIC ? 'error.main' : 'text.secondary',
                textAlign: 'right',
                mt: 0.25,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {lyric.length} / {MAX_LYRIC}
            </Typography>
          </Box>
        </Box>
      </Box>

      {f.renderSnackbar()}
    </Box>
  );
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

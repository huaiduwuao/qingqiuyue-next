'use client';

/**
 * 分镜表里一个分镜的「台词与配音」:原声和每个出海语种各一行,改文本(原声改的是对白,其余是译文)、
 * 试听配音、单句重配。整集的译配 / 配音 / 合成还在「成片」里。
 */

import React, { useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import { dramaAPI, type Lang, type Shot } from '@/apis/shortdrama';
import { useCapabilities, useInvalidate, useOverview, useStartTask } from '../useProject';

export default function LinesDialog({
  projectId,
  episode,
  shot,
  label,
  onClose,
}: {
  projectId: number;
  episode: { id: number; no: number };
  shot: Shot | null;
  label: string;
  onClose: () => void;
}) {
  const ov = useOverview(projectId);
  const caps = useCapabilities();
  const start = useStartTask(projectId);
  const invalidate = useInvalidate(projectId);
  const [err, setErr] = useState('');

  const settings = useMemo(() => (ov.data?.project.settings ?? {}) as Record<string, unknown>, [ov.data]);
  const post = caps.data?.post;
  const src = typeof settings.source_lang === 'string' && settings.source_lang ? settings.source_lang : 'zh';
  const targets = (Array.isArray(settings.languages) ? (settings.languages as string[]) : []).filter((c) => c !== src);
  const langOf = (code: string): Lang => post?.languages?.find((l) => l.code === code) ?? { code, name: code === 'zh' ? '中文' : code, en: code, cjk: false, dubbing: false };
  const canDub = !!post?.tts && !!post?.storage;
  const running = !!ov.data?.running;

  const save = async (lang: string, text: string) => {
    if (!shot) return;
    setErr('');
    try {
      await dramaAPI.updateShot(shot.id, lang === src ? { dialogue: text } : { translations: { ...(shot.translations ?? {}), [lang]: text } });
      invalidate(episode.id);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : '保存失败');
    }
  };
  const redub = (lang: string) => {
    if (!shot) return;
    setErr('');
    start.mutate(
      { step: 'dubbing', input: { episode_id: episode.id, episode_no: episode.no, lang, shot_ids: [shot.id], force: true } },
      { onError: (e) => setErr((e as Error).message) },
    );
  };

  return (
    <Dialog open={!!shot} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{label} · 台词与配音</DialogTitle>
      <DialogContent>
        {shot && (
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {err && (
              <Alert severity="error" onClose={() => setErr('')}>
                {err}
              </Alert>
            )}
            {[src, ...targets].map((code) => {
              const lang = langOf(code);
              return (
                <LineRow
                  key={`${shot.id}-${code}`}
                  shot={shot}
                  lang={code}
                  langName={`${lang.name}${code === src ? '(原声)' : ''}`}
                  isSource={code === src}
                  disabled={running || start.isPending}
                  canDub={canDub && lang.dubbing}
                  onSave={(text) => save(code, text)}
                  onRedub={() => redub(code)}
                />
              );
            })}
            {targets.length === 0 && (
              <Typography variant="caption" color="text.secondary">
                还没选出海语种;在「成片」里勾上语种并译配后,译文会出现在这里。
              </Typography>
            )}
            {running && (
              <Typography variant="caption" color="text.secondary">
                有任务在进行中,结束后再改或重配。
              </Typography>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
}

/** 一个语种的一句:可改文本 + 配音试听 + 重配。改完失焦即保存;改了文本要重配才会换声音。 */
function LineRow({
  shot,
  lang,
  langName,
  isSource,
  disabled,
  canDub,
  onSave,
  onRedub,
}: {
  shot: Shot;
  lang: string;
  langName: string;
  isSource: boolean;
  disabled: boolean;
  canDub: boolean;
  onSave: (text: string) => void;
  onRedub: () => void;
}) {
  const saved = isSource ? shot.dialogue : (shot.translations?.[lang] ?? '');
  const [text, setText] = useState(saved);
  useEffect(() => setText(saved), [saved]);
  const audio = shot.audio?.[lang];
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        {langName}
      </Typography>
      {!isSource && shot.dialogue && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'pre-wrap', mb: 0.5 }}>
          {shot.dialogue}
        </Typography>
      )}
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
        <TextField
          size="small"
          fullWidth
          multiline
          placeholder={isSource ? '这一镜没有台词' : '还没有译文'}
          value={text}
          disabled={disabled}
          onChange={(ev) => setText(ev.target.value)}
          onBlur={() => text.trim() !== (saved ?? '').trim() && onSave(text.trim())}
          sx={{ flex: 1, minWidth: 200 }}
        />
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexShrink: 0 }}>
          {audio?.url ? (
            <>
              <audio src={audio.url} controls preload="none" style={{ height: 32, width: 200 }} />
              <Typography variant="caption" color="text.secondary">
                {audio.duration.toFixed(1)}s
              </Typography>
            </>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ width: 200 }}>
              未配音
            </Typography>
          )}
          <Tooltip title={canDub ? '重配这一句' : '这个语种不能配音'}>
            <span>
              <IconButton size="small" disabled={disabled || !canDub || !(saved ?? '').trim()} onClick={onRedub} aria-label="重配这一句">
                <ReplayRoundedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Box>
    </Box>
  );
}

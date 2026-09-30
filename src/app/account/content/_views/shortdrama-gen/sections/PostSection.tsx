'use client';

/**
 * 后期分区:出海语种 → 译配 → 配音 → 成片合成 → 分发文案。
 *
 * 所有产物按语种分桶(shot.translations / shot.audio / episode.finals / episode.distribution),
 * 页面上先选「看哪个语种」,下面的成片、台词表、文案都跟着切。源语种和目标语种走同一套界面。
 */

import React, { useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import { dramaAPI, type FinalCut, type Lang, type PlatformCopy, type Shot, type Step } from '@/apis/shortdrama';
import type { SectionProps } from '../Workbench';
import { Empty } from '../common';
import { useCapabilities, useEpisode, useInvalidate, useOverview, useStartTask } from '../useProject';

const FALLBACK_LANGS: Lang[] = [{ code: 'zh', name: '中文', en: 'Simplified Chinese', cjk: true, dubbing: false }];

function fmtDuration(sec: number): string {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function fmtSize(bytes?: number): string {
  if (!bytes) return '';
  return bytes > 1 << 20 ? `${(bytes / (1 << 20)).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

function saveText(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function PostSection({ projectId, episodeId, setEpisodeId, setSection, setFeedbackTarget }: SectionProps) {
  const ov = useOverview(projectId);
  const caps = useCapabilities();
  const start = useStartTask(projectId);
  const invalidate = useInvalidate(projectId);
  const episodes = ov.data?.episodes ?? [];
  const current = episodes.find((e) => e.id === episodeId) ?? episodes[0];
  const ep = useEpisode(current?.id ?? 0);

  const settings = useMemo(() => (ov.data?.project.settings ?? {}) as Record<string, unknown>, [ov.data]);
  const post = caps.data?.post;
  const langs = post?.languages?.length ? post.languages : FALLBACK_LANGS;
  const src = typeof settings.source_lang === 'string' && settings.source_lang ? settings.source_lang : 'zh';
  const targets = useMemo(() => (Array.isArray(settings.languages) ? (settings.languages as string[]) : []).filter((c) => c !== src), [settings, src]);

  const [view, setView] = useState(src);
  const [whole, setWhole] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState('');
  const [bgm, setBgm] = useState('');
  useEffect(() => {
    setBgm(typeof settings.bgm_url === 'string' ? settings.bgm_url : '');
  }, [settings]);
  useEffect(() => {
    if (view !== src && !targets.includes(view)) setView(src);
  }, [view, src, targets]);

  if (ov.isLoading || !ov.data) return <Skeleton variant="rounded" height={320} />;
  if (episodes.length === 0) {
    return <Empty title="还没有分集" hint="先在「剧本」里让编剧搭框架。" action={<Button variant="contained" onClick={() => setSection('script')}>去剧本</Button>} />;
  }

  const e = ep.data?.episode ?? current!;
  const shots: Shot[] = ep.data?.shots ?? [];
  const running = !!ov.data.running;
  const langOf = (code: string) => langs.find((l) => l.code === code) ?? { code, name: code, en: code, cjk: false, dubbing: false };
  const viewLang = langOf(view);
  const spoken = shots.filter((s) => (s.dialogue ?? '').trim());
  const translated = spoken.filter((s) => view === src || (s.translations?.[view] ?? '').trim());
  const dubbed = spoken.filter((s) => s.audio?.[view]?.url);
  const rendered = shots.filter((s) => s.frame_url || s.video_url);
  const final: FinalCut | undefined = e.finals?.[view] ?? undefined;
  const copies: Record<string, PlatformCopy> = e.distribution?.[view] ?? {};

  const guard = async (fn: () => Promise<unknown>) => {
    setErr('');
    try {
      await fn();
      invalidate(e.id);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : '操作失败');
    }
  };
  const saveSettings = (patch: Record<string, unknown>) => guard(() => dramaAPI.updateProject(projectId, { settings: { ...settings, ...patch } }));
  const toggleLang = (code: string) => saveSettings({ languages: targets.includes(code) ? targets.filter((c) => c !== code) : [...targets, code] });
  const run = (step: Step, extra: Record<string, unknown> = {}) =>
    start.mutate({ step, input: { ...(whole ? {} : { episode_id: e.id, episode_no: e.no }), ...extra } });
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      setErr('复制失败:浏览器没有给剪贴板权限');
    }
  };
  const downloadSubtitle = (format: 'srt' | 'vtt') =>
    guard(async () => {
      const text = await dramaAPI.subtitles(e.id, view, format);
      saveText(`ep${e.no}.${view}.${format}`, text, format === 'vtt' ? 'text/vtt' : 'application/x-subrip');
    });

  const canDub = !!post?.tts && !!post?.storage;
  const canCompose = !!post?.ffmpeg && !!post?.storage;
  const dubHint = !post ? '后端还没升级到带后期的版本' : !post.tts ? '没有配置语音合成服务' : !post.storage ? '没有配置对象存储' : !viewLang.dubbing ? `当前语音合成不支持${viewLang.name},这个语种只出字幕` : post.tts_online ? '' : '语音合成服务暂时连不上,可以先试';
  const composeHint = !post ? '后端还没升级到带后期的版本' : !post.ffmpeg ? '服务上没有 ffmpeg' : !post.storage ? '没有配置对象存储' : rendered.length === 0 ? '这一集还没有画面,先去「分镜」出图' : '';

  return (
    <Stack spacing={2}>
      <Tabs value={e.id} onChange={(_, v) => setEpisodeId(v)} variant="scrollable" scrollButtons="auto">
        {episodes.map((x) => (
          <Tab key={x.id} value={x.id} label={`第 ${x.no} 集`} />
        ))}
      </Tabs>

      {err && (
        <Alert severity="error" onClose={() => setErr('')}>
          {err}
        </Alert>
      )}
      {start.isError && (
        <Alert severity="error" onClose={() => start.reset()}>
          {(start.error as Error).message}
        </Alert>
      )}

      {/* 语种与能力 */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          出海语种
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          原声是{langOf(src).name}。勾上的语种会各出一版译文、字幕和成片;带「可配音」的语种还会出配音。
        </Typography>
        <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {langs
            .filter((l) => l.code !== src)
            .map((l) => (
              <Chip
                key={l.code}
                size="small"
                label={`${l.name}${l.dubbing ? ' · 可配音' : ''}`}
                color={targets.includes(l.code) ? 'primary' : 'default'}
                variant={targets.includes(l.code) ? 'filled' : 'outlined'}
                disabled={running}
                onClick={() => toggleLang(l.code)}
              />
            ))}
        </Stack>
        {post && (
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap', mt: 1.5 }}>
            <Chip size="small" variant="outlined" color={post.tts ? (post.tts_online ? 'success' : 'warning') : 'default'} label={`配音:${post.tts ? (post.tts_online ? '可用' : '已配置,连不上') : '未配置'}`} />
            <Chip size="small" variant="outlined" color={post.ffmpeg ? 'success' : 'default'} label={`成片合成:${post.ffmpeg ? '可用' : '没有 ffmpeg'}`} />
            <Chip size="small" variant="outlined" color={post.fonts ? 'success' : 'default'} label={`烧录字幕:${post.fonts ? '可用' : '没有字体,只能外挂'}`} />
            <Chip size="small" variant="outlined" color={post.storage ? 'success' : 'default'} label={`存储:${post.storage ? '可用' : '未配置'}`} />
          </Stack>
        )}
      </Paper>

      {/* 操作 */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Tabs value={view} onChange={(_, v) => setView(v)} sx={{ minHeight: 36, flex: 1, minWidth: 200 }} variant="scrollable" scrollButtons="auto">
            {[src, ...targets].map((c) => (
              <Tab key={c} value={c} sx={{ minHeight: 36, py: 0 }} label={`${langOf(c).name}${c === src ? '(原声)' : ''}`} />
            ))}
          </Tabs>
          <FormControlLabel sx={{ mr: 0 }} control={<Switch size="small" checked={whole} onChange={(ev) => setWhole(ev.target.checked)} />} label={<Typography variant="caption">整部剧一起跑</Typography>} />
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', my: 1 }}>
          第 {e.no} 集 · {shots.length} 镜 · 有台词 {spoken.length} 镜
          {view !== src ? ` · 已译 ${translated.length}` : ''} · 已配音 {dubbed.length} · 有画面 {rendered.length}
          {final ? ` · 成片 ${fmtDuration(final.duration)}` : ''}
        </Typography>
        <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {view !== src && (
            <Button size="small" variant="outlined" disabled={running || spoken.length === 0} onClick={() => run('localize', { lang: view, force: translated.length === spoken.length })}>
              {translated.length === 0 ? '译配' : translated.length < spoken.length ? '补译' : '重新译配'}
            </Button>
          )}
          <Tooltip title={dubHint}>
            <span>
              <Button size="small" variant="outlined" disabled={running || !canDub || !viewLang.dubbing || translated.length === 0} onClick={() => run('dubbing', { lang: view })}>
                {dubbed.length ? '补配音' : '配音'}
              </Button>
            </span>
          </Tooltip>
          <Tooltip title={composeHint}>
            <span>
              <Button size="small" variant="contained" disabled={running || !canCompose || rendered.length === 0} onClick={() => run('compose', { lang: view })}>
                {final ? '重新合成' : '合成成片'}
              </Button>
            </span>
          </Tooltip>
          <Button size="small" variant="outlined" disabled={running} onClick={() => run('distribute', { lang: view, force: Object.keys(copies).length > 0 })}>
            {Object.keys(copies).length ? '重写分发文案' : '分发文案'}
          </Button>
          <Button size="small" startIcon={<DownloadRoundedIcon />} disabled={translated.length === 0} onClick={() => downloadSubtitle('srt')}>
            字幕 SRT
          </Button>
          <Button size="small" startIcon={<DownloadRoundedIcon />} disabled={translated.length === 0} onClick={() => downloadSubtitle('vtt')}>
            VTT
          </Button>
          <Button size="small" onClick={() => setFeedbackTarget({ type: 'episode', id: e.id, label: `第 ${e.no} 集后期` })}>
            提意见
          </Button>
        </Stack>
      </Paper>

      {/* 成片 */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          成片 · {viewLang.name}
        </Typography>
        {final ? (
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ width: final.height >= final.width ? 220 : 360, maxWidth: '100%', borderRadius: 1.5, overflow: 'hidden', bgcolor: '#000', flexShrink: 0 }}>
              <video key={final.url} src={final.url} controls playsInline preload="metadata" style={{ width: '100%', display: 'block' }}>
                {final.vtt_url && !final.burned && <track kind="subtitles" src={final.vtt_url} srcLang={view} label={viewLang.name} default />}
              </video>
            </Box>
            <Box sx={{ flex: 1, minWidth: 220 }}>
              <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', mb: 1 }}>
                <Chip size="small" label={`${final.width}×${final.height}`} />
                <Chip size="small" label={fmtDuration(final.duration)} />
                {final.size ? <Chip size="small" label={fmtSize(final.size)} /> : null}
                <Chip size="small" variant="outlined" label={final.dubbed ? `配音 ${final.dubbed} 镜` : '无配音'} />
                <Chip size="small" variant="outlined" label={final.cues ? (final.burned ? '字幕已烧录' : '外挂字幕') : '无字幕'} />
                {final.bgm && <Chip size="small" variant="outlined" label="带背景音乐" />}
              </Stack>
              <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                <Button size="small" variant="outlined" startIcon={<DownloadRoundedIcon />} component="a" href={final.url} download={`ep${e.no}.${view}.mp4`} target="_blank" rel="noreferrer">
                  下载成片
                </Button>
                {final.srt_url && (
                  <Button size="small" component="a" href={final.srt_url} download target="_blank" rel="noreferrer">
                    成片字幕 SRT
                  </Button>
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                合成于 {new Date(final.at).toLocaleString('zh-CN', { hour12: false })}。改了台词、配音或镜头之后要重新合成,成片不会自动更新。
              </Typography>
              {(post?.platforms ?? [])
                .filter((p) => p.max_sec > 0 && final.duration > p.max_sec)
                .map((p) => (
                  <Alert key={p.code} severity="warning" sx={{ mt: 1 }}>
                    {p.name} 单条上限 {fmtDuration(p.max_sec)},这一集 {fmtDuration(final.duration)},发之前需要拆条。
                  </Alert>
                ))}
            </Box>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            还没有{viewLang.name}版成片。{composeHint || '点「合成成片」:镜头按分镜顺序拼接,有配音的镜头时长跟着台词走,字幕自动对齐。'}
          </Typography>
        )}
      </Paper>

      {/* 成片设置 */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
          成片设置
        </Typography>
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              size="small"
              fullWidth
              label="背景音乐地址(mp3 / wav 直链,可空)"
              helperText="请只用你有权使用的音乐;成片里会自动压低音量并在结尾淡出"
              value={bgm}
              disabled={running}
              onChange={(ev) => setBgm(ev.target.value)}
              onBlur={() => bgm.trim() !== (typeof settings.bgm_url === 'string' ? settings.bgm_url : '') && saveSettings({ bgm_url: bgm.trim() })}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>清晰度</InputLabel>
              <Select label="清晰度" disabled={running} value={String(settings.export_quality ?? '1080')} onChange={(ev) => saveSettings({ export_quality: ev.target.value })}>
                <MenuItem value="1080">1080p(各平台通用)</MenuItem>
                <MenuItem value="720">720p(合成更快)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>旁白音色</InputLabel>
              <Select label="旁白音色" disabled={running || !post?.voices?.length} value={String(settings.narrator_voice ?? '')} onChange={(ev) => saveSettings({ narrator_voice: ev.target.value })}>
                <MenuItem value="">自动</MenuItem>
                {(post?.voices ?? []).map((v) => (
                  <MenuItem key={v} value={v}>
                    {v}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
        <FormControlLabel
          sx={{ mt: 0.5 }}
          control={<Switch checked={typeof settings.burn_subtitles === 'boolean' ? settings.burn_subtitles : true} disabled={running || !post?.fonts} onChange={(ev) => saveSettings({ burn_subtitles: ev.target.checked })} />}
          label="把字幕烧进画面(短视频平台不认外挂字幕;关掉则成片带可开关的软字幕)"
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          角色的配音音色在「角色」里逐个指定,留空按性别自动分配。
        </Typography>
      </Paper>

      {/* 台词 */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          台词 · {viewLang.name}
        </Typography>
        {spoken.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            这一集的镜头里没有台词。
          </Typography>
        ) : (
          <Stack spacing={1}>
            {spoken.map((s) => (
              <LineRow
                key={`${s.id}-${view}`}
                shot={s}
                lang={view}
                isSource={view === src}
                disabled={running}
                canDub={canDub && viewLang.dubbing}
                onSave={(text) => guard(() => dramaAPI.updateShot(s.id, view === src ? { dialogue: text } : { translations: { ...(s.translations ?? {}), [view]: text } }))}
                onRedub={() => start.mutate({ step: 'dubbing', input: { episode_id: e.id, episode_no: e.no, lang: view, shot_ids: [s.id], force: true } })}
              />
            ))}
          </Stack>
        )}
      </Paper>

      {/* 分发文案 */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          分发文案 · {viewLang.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          站内用顶部的「发布为作品」;其它平台目前需要你下载成片、复制这里的文案后到对应平台手动发布。
        </Typography>
        {Object.keys(copies).length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            还没有文案,点上面的「分发文案」。
          </Typography>
        ) : (
          <Grid container spacing={1.5}>
            {Object.entries(copies).map(([code, c]) => {
              const plat = post?.platforms.find((p) => p.code === code);
              const tags = (c.hashtags ?? []).map((t) => `#${t}`).join(' ');
              const all = [c.title, c.caption, tags].filter(Boolean).join('\n');
              return (
                <Grid key={code} size={{ xs: 12, md: 6 }}>
                  <Box sx={{ p: 1.5, borderRadius: 1.5, border: 1, borderColor: 'divider', height: '100%' }}>
                    <Stack direction="row" sx={{ alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="subtitle2" sx={{ flex: 1, fontWeight: 700 }}>
                        {plat?.name ?? code}
                      </Typography>
                      <Tooltip title={copied === code ? '已复制' : '复制全部'}>
                        <IconButton size="small" onClick={() => copy(code, all)} aria-label={`复制${plat?.name ?? code}文案`}>
                          <ContentCopyRoundedIcon fontSize="small" color={copied === code ? 'success' : 'inherit'} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                    {c.title && (
                      <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
                        {c.title}
                      </Typography>
                    )}
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {c.caption}
                    </Typography>
                    <Typography variant="caption" color="primary" sx={{ display: 'block', mt: 0.5, wordBreak: 'break-word' }}>
                      {tags}
                    </Typography>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Paper>
    </Stack>
  );
}

/** 一个镜头的台词:原文对照 + 可改的当前语种文本 + 配音试听。 */
function LineRow({
  shot,
  lang,
  isSource,
  disabled,
  canDub,
  onSave,
  onRedub,
}: {
  shot: Shot;
  lang: string;
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
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
      <Typography variant="subtitle2" sx={{ width: 36, flexShrink: 0, pt: 1, fontWeight: 700 }}>
        #{shot.no}
      </Typography>
      <Box sx={{ flex: 1, minWidth: 200 }}>
        {!isSource && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'pre-wrap' }}>
            {shot.dialogue}
          </Typography>
        )}
        <TextField
          size="small"
          fullWidth
          multiline
          placeholder={isSource ? '' : '还没有译文'}
          value={text}
          disabled={disabled}
          onChange={(ev) => setText(ev.target.value)}
          onBlur={() => text.trim() !== saved.trim() && onSave(text.trim())}
        />
      </Box>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexShrink: 0, pt: 0.5 }}>
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
            <IconButton size="small" disabled={disabled || !canDub || !saved.trim()} onClick={onRedub} aria-label="重配这一句">
              <ReplayRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </Box>
  );
}

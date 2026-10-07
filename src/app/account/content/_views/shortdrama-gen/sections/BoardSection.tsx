'use client';

/**
 * 故事板:一集的镜头按时间线排开。上面是大预览(有视频放视频、有配音放配音),下面是镜头胶片条,
 * 点镜头在右栏「绘图 / 视频」里单独重画或出片;▶ 按镜头时长连播,先看整集节奏再决定花钻出视频。
 */

import React, { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import type { Shot } from '@/apis/shortdrama';
import type { SectionProps } from '../Workbench';
import { Empty, ShotStatusChip } from '../common';
import { useEpisode, useOverview, useStartTask, useUnitCost } from '../useProject';

export default function BoardSection({ projectId, episodeId, setEpisodeId, setSection, episodeRail, selected, select }: SectionProps) {
  const ov = useOverview(projectId);
  const start = useStartTask(projectId);
  const cost = useUnitCost();
  const episodes = ov.data?.episodes ?? [];
  const current = episodes.find((e) => e.id === episodeId) ?? episodes[0];
  const ep = useEpisode(current?.id ?? 0);
  const shots: Shot[] = ep.data?.shots ?? [];
  const [playing, setPlaying] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);

  const sel = selected?.type === 'shot' ? shots.find((s) => s.id === selected.id) : undefined;
  const shot = sel ?? shots[0];
  const pick = (s: Shot) => select?.({ type: 'shot', id: s.id, label: `第 ${current?.no} 集 镜头 ${s.no}` });

  // 进来先选中第一个镜头,右栏直接能编辑
  useEffect(() => {
    if (!sel && shots.length) select?.({ type: 'shot', id: shots[0].id, label: `第 ${current?.no} 集 镜头 ${shots[0].no}` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shots.length, current?.id]);

  // 连播:当前镜头放满它的时长就跳下一镜,放到最后停
  useEffect(() => {
    if (!playing || !shot) return;
    const i = shots.findIndex((s) => s.id === shot.id);
    const t = setTimeout(() => {
      if (i + 1 < shots.length) pick(shots[i + 1]);
      else setPlaying(false);
    }, Math.max(1, shot.duration_sec || 3) * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, shot?.id]);

  // 选中的镜头滚进胶片条可视区
  useEffect(() => {
    stripRef.current?.querySelector(`[data-shot="${shot?.id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [shot?.id]);

  if (ov.isLoading) return <Skeleton variant="rounded" height={420} />;
  if (!current) {
    return <Empty title="还没有分集" hint="先在「剧本」里让编剧搭框架。" action={<Button variant="contained" onClick={() => setSection('script')}>去剧本</Button>} />;
  }
  const running = !!ov.data?.running;
  const aspect = ov.data?.project.aspect ?? '9:16';
  const ratio = aspect === '16:9' ? '16 / 9' : aspect === '1:1' ? '1 / 1' : '9 / 16';
  const framed = shots.filter((s) => s.frame_url).length;
  const videos = shots.filter((s) => s.video_url).length;
  const lang = typeof ov.data?.project.settings?.source_lang === 'string' && ov.data.project.settings.source_lang ? (ov.data.project.settings.source_lang as string) : 'zh';
  const epInput = { episode_id: current.id, episode_no: current.no };

  return (
    <Stack spacing={1.5} sx={{ height: { md: '100%' }, minHeight: 0 }}>
      {!episodeRail && (
        <Tabs value={current.id} onChange={(_, v) => setEpisodeId(v)} variant="scrollable" scrollButtons="auto">
          {episodes.map((x) => (
            <Tab key={x.id} value={x.id} label={`第 ${x.no} 集`} />
          ))}
        </Tabs>
      )}

      {shots.length === 0 ? (
        <Empty
          title="这一集还没有镜头"
          hint="先在「分镜」里让分镜师把剧本拆成镜头。"
          action={
            <Button variant="contained" disabled={running || !current.script_text} onClick={() => start.mutate({ step: 'storyboard', input: epInput })}>
              智能分镜
            </Button>
          }
        />
      ) : (
        <>
          {/* 大预览 */}
          <Box sx={{ flex: 1, minHeight: { xs: 300, md: 260 }, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#111', borderRadius: 2, p: 1.5, position: 'relative' }}>
            {shot && (
              <Box sx={{ height: { xs: aspect === '16:9' ? 'auto' : 420, md: '100%' }, width: aspect === '16:9' ? '100%' : 'auto', maxHeight: 560, aspectRatio: ratio, borderRadius: 1, overflow: 'hidden', bgcolor: '#1c1c1c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {shot.video_url ? (
                  <video key={shot.id} src={shot.video_url} autoPlay={playing} muted={playing && !!shot.audio?.[lang]?.url} controls={!playing} loop={!playing} playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : shot.frame_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shot.frame_url} alt={`镜头 ${shot.no}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <Stack sx={{ alignItems: 'center', color: 'grey.600' }} spacing={0.5}>
                    <ImageRoundedIcon sx={{ fontSize: 40 }} />
                    <Typography variant="caption">待生成</Typography>
                  </Stack>
                )}
              </Box>
            )}
            {playing && shot?.audio?.[lang]?.url && <audio key={`a${shot.id}`} src={shot.audio[lang].url} autoPlay />}
          </Box>

          {shot && (shot.dialogue || shot.action) && (
            <Typography variant="body2" sx={{ px: 0.5 }} color={shot.dialogue ? 'text.primary' : 'text.secondary'}>
              {shot.dialogue ? `台词:${shot.dialogue}` : `画面:${shot.action}`}
            </Typography>
          )}

          {/* 工具条 */}
          <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="subtitle2">全部分镜</Typography>
            <Typography variant="caption" color="text.secondary">
              共 {shots.length} 镜 · 画面 {framed}/{shots.length} · 视频 {videos}/{shots.length}
            </Typography>
            <Tooltip title={playing ? '暂停' : '按镜头时长连播'}>
              <IconButton color="primary" onClick={() => setPlaying((v) => !v)} sx={{ border: 1, borderColor: 'primary.main', width: 34, height: 34 }}>
                {playing ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
              </IconButton>
            </Tooltip>
            <Box sx={{ flex: 1 }} />
            <Tooltip title={cost.shot ? `给没有画面的镜头出图,每镜 ${cost.shot} 钻` : '出图服务暂未开放'}>
              <span>
                <Button size="small" disabled={running || !cost.canImage || framed === shots.length} onClick={() => start.mutate({ step: 'visual_gen', input: epInput })}>
                  批量生图{cost.shot && framed < shots.length ? ` · ${(shots.length - framed) * cost.shot} 钻` : ''}
                </Button>
              </span>
            </Tooltip>
            <Tooltip title={cost.i2v ? `给没有视频的镜头出视频,每镜 ${cost.i2v} 钻(没画面的先出图)` : '图生视频服务暂未开放'}>
              <span>
                <Button size="small" disabled={running || !cost.canVideo || videos === shots.length} onClick={() => start.mutate({ step: 'visual_gen', input: { ...epInput, video: true } })}>
                  批量生成视频{cost.i2v && videos < shots.length ? ` · ${(shots.length - videos) * cost.i2v + (shots.length - framed) * cost.shot} 钻` : ''}
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="给有台词的镜头配音(不扣钻)">
              <span>
                <Button size="small" disabled={running} onClick={() => start.mutate({ step: 'dubbing', input: { ...epInput, lang } })}>
                  批量配音
                </Button>
              </span>
            </Tooltip>
          </Stack>

          {/* 胶片条 */}
          <Box ref={stripRef} sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 1, flexShrink: 0 }}>
            {shots.map((s) => {
              const on = shot?.id === s.id;
              return (
                <Box
                  key={s.id}
                  data-shot={s.id}
                  onClick={() => {
                    setPlaying(false);
                    pick(s);
                  }}
                  sx={{ flexShrink: 0, width: aspect === '16:9' ? 150 : 96, cursor: 'pointer', borderRadius: 1.5, overflow: 'hidden', border: on ? 2 : 1, borderColor: on ? 'primary.main' : 'divider', bgcolor: 'background.paper' }}
                >
                  <Stack direction="row" sx={{ px: 0.75, py: 0.25, alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, flex: 1 }}>
                      镜头 {s.no}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {s.duration_sec}s
                    </Typography>
                  </Stack>
                  <Box sx={{ aspectRatio: ratio, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    {s.frame_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.frame_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Typography variant="caption" color="warning.main">
                        待生成
                      </Typography>
                    )}
                    {s.video_url && <PlayArrowRoundedIcon sx={{ position: 'absolute', right: 2, bottom: 2, fontSize: 16, color: '#fff', bgcolor: 'rgba(0,0,0,.5)', borderRadius: '50%' }} />}
                  </Box>
                  {(s.status === 'generating' || s.status === 'failed' || s.status === 'qc_flagged') && (
                    <Box sx={{ p: 0.25, display: 'flex', justifyContent: 'center' }}>
                      <ShotStatusChip status={s.status} />
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        </>
      )}
    </Stack>
  );
}

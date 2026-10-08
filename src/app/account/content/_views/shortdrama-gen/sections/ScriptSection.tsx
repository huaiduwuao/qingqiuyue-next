'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { dramaAPI, type Episode } from '@/apis/shortdrama';
import type { SectionProps } from '../Workbench';
import { Empty, EntityStatusChip, TextEditDialog } from '../common';
import { useEpisode, useInvalidate, useOverview, useStartTask } from '../useProject';

export default function ScriptSection({ projectId, episodeId, setEpisodeId, setSection, setFeedbackTarget, episodeRail }: SectionProps) {
  const ov = useOverview(projectId);
  const start = useStartTask(projectId);
  const invalidate = useInvalidate(projectId);
  const episodes = ov.data?.episodes ?? [];
  const current = episodes.find((e) => e.id === episodeId) ?? episodes[0];
  const ep = useEpisode(current?.id ?? 0);
  const running = !!ov.data?.running;
  const [edit, setEdit] = useState<null | keyof Episode>(null);

  if (ov.isLoading) return <Skeleton variant="rounded" height={320} />;
  if (episodes.length === 0) {
    return (
      <Empty
        title="还没有剧本"
        hint="编剧会从故事意图出发,产出角色、场景、道具和分集剧本。"
        action={
          <Button variant="contained" disabled={running || start.isPending} onClick={() => start.mutate({ step: 'screenwriter' })}>
            运行剧本框架
          </Button>
        }
      />
    );
  }
  const e = ep.data?.episode ?? current!;
  const shots = ep.data?.shots ?? [];
  // 分镜 / 出图等后续环节在顶栏「下一步」和各自的页签里,这里只管剧本本身
  const runEp = (step: 'script', extra: Record<string, unknown> = {}) =>
    start.mutate({ step, input: { episode_id: e.id, episode_no: e.no, ...extra } });
  const save = (field: keyof Episode) => async (v: string) => {
    await dramaAPI.updateEpisode(e.id, { [field]: v });
    invalidate(e.id);
  };
  const addEpisode = async () => {
    const res = await dramaAPI.createEpisode(projectId, { title: `第 ${episodes.length + 1} 集` });
    invalidate();
    setEpisodeId(res.episode.id);
  };
  const removeEpisode = async () => {
    if (!window.confirm(`删除第 ${e.no} 集及其全部镜头?`)) return;
    await dramaAPI.deleteEpisode(e.id);
    invalidate();
    setEpisodeId(0);
  };

  return (
    <Stack spacing={2}>
      <Stack sx={{ alignItems: 'center' }} direction="row" spacing={1}>
        {episodeRail ? (
          <Typography variant="subtitle2" color="text.secondary" sx={{ flex: 1 }}>
            共 {episodes.length} 集
          </Typography>
        ) : (
          <Tabs value={e.id} onChange={(_, v) => setEpisodeId(v)} variant="scrollable" scrollButtons="auto" sx={{ flex: 1, minWidth: 0 }}>
            {episodes.map((x) => (
            <Tab key={x.id} value={x.id} label={`第 ${x.no} 集`} />
          ))}
          </Tabs>
        )}
        <IconButton size="small" onClick={addEpisode} aria-label="新增一集">
          <AddRoundedIcon />
        </IconButton>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack sx={{ alignItems: 'flex-start', flexWrap: 'wrap' }} direction="row" spacing={1} useFlexGap>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Stack sx={{ alignItems: 'center' }} direction="row" spacing={1}>
              <Typography variant="h6">
                第 {e.no} 集 · {e.title || '未命名'}
              </Typography>
              <IconButton size="small" onClick={() => setEdit('title')}>
                <EditRoundedIcon fontSize="inherit" />
              </IconButton>
              <EntityStatusChip status={e.status} />
              {e.duration_sec > 0 && <Chip size="small" variant="outlined" label={`${e.duration_sec}s`} />}
            </Stack>
          </Box>
          <Stack sx={{ flexWrap: 'wrap' }} direction="row" spacing={0.5} useFlexGap>
            <Button size="small" variant="outlined" disabled={running} onClick={() => runEp('script', { force: true })}>
              {e.script_text ? '重写剧本' : '写剧本'}
            </Button>
            {shots.length > 0 && (
              <Button size="small" onClick={() => setSection('storyboard', { episodeId: e.id })}>
                看分镜({shots.length})
              </Button>
            )}
            <Button size="small" onClick={() => setFeedbackTarget({ type: 'episode', id: e.id, label: `第 ${e.no} 集` })}>
              提意见
            </Button>
            <IconButton size="small" color="error" onClick={removeEpisode} aria-label="删除本集">
              <DeleteOutlineRoundedIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>

        <Divider sx={{ my: 1.5 }} />
        <EditableRow label="梗概" value={e.synopsis} onEdit={() => setEdit('synopsis')} />
        <EditableRow label="开场钩子" value={e.hook} onEdit={() => setEdit('hook')} />
        <EditableRow label="结尾悬念" value={e.cliffhanger} onEdit={() => setEdit('cliffhanger')} />
        {Array.isArray(e.beats) && e.beats.length > 0 && (
          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              情节节拍
            </Typography>
            <Stack component="ol" sx={{ m: 0, pl: 2.5 }} spacing={0.25}>
              {e.beats.map((b, i) => (
                <Typography key={i} component="li" variant="body2">
                  {String(b)}
                </Typography>
              ))}
            </Stack>
          </Box>
        )}
      </Paper>

      <TextEditDialog open={edit === 'title'} title="本集标题" value={e.title} multiline={false} onClose={() => setEdit(null)} onSave={save('title')} />
      <TextEditDialog open={edit === 'synopsis'} title="本集梗概" value={e.synopsis} onClose={() => setEdit(null)} onSave={save('synopsis')} />
      <TextEditDialog open={edit === 'hook'} title="开场钩子" value={e.hook} onClose={() => setEdit(null)} onSave={save('hook')} />
      <TextEditDialog open={edit === 'cliffhanger'} title="结尾悬念" value={e.cliffhanger} onClose={() => setEdit(null)} onSave={save('cliffhanger')} />
    </Stack>
  );
}

function EditableRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <Box sx={{ mb: 1 }}>
      <Stack sx={{ alignItems: 'center' }} direction="row" spacing={0.5}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <IconButton size="small" onClick={onEdit} aria-label={`编辑${label}`}>
          <EditRoundedIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Stack>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
        {value || '—'}
      </Typography>
    </Box>
  );
}

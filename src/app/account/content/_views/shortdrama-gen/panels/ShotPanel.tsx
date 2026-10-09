'use client';

/**
 * 右栏「绘图 / 视频」:选中的镜头。
 * 绘图:改画面提示词,单独重画这一镜(按图生图 / 文生图单价);参考主体是这一镜里的角色、场景和道具。
 * 视频:改动作提示词,用当前画面生成 / 重做视频(按图生视频单价)。
 */

import React, { useState } from 'react';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import DiamondRoundedIcon from '@mui/icons-material/DiamondRounded';
import { CAMERA_MOVES, COMPOSITIONS, SHOT_TYPES, blockingText, dramaAPI, shotLabel, shotVideo, type Shot } from '@/apis/shortdrama';
import type { Selection } from '../Workbench';
import { MediaThumb, UploadImageButton } from '../common';
import { useEpisode, useInvalidate, useOverview, useStartTask, useUnitCost } from '../useProject';

export default function ShotPanel({ projectId, episodeId, selected }: { projectId: number; episodeId: number; selected: Selection }) {
  const ep = useEpisode(episodeId);
  const shot = selected?.type === 'shot' ? ep.data?.shots.find((s) => s.id === selected.id) : undefined;
  if (!shot) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
        点一个镜头,在这里改它的画面和视频提示词、单独重画或生成视频。
      </Typography>
    );
  }
  return <Editor key={shot.id} projectId={projectId} episodeId={episodeId} shot={shot} label={shotLabel(shot, ep.data?.shots ?? [])} />;
}

function Editor({ projectId, episodeId, shot, label }: { projectId: number; episodeId: number; shot: Shot; label: string }) {
  const ov = useOverview(projectId);
  const start = useStartTask(projectId);
  const invalidate = useInvalidate(projectId);
  const cost = useUnitCost();
  const [mode, setMode] = useState<'image' | 'video'>(shot.frame_url && !shot.video_url ? 'video' : 'image');
  const [imgPrompt, setImgPrompt] = useState(shot.image_prompt ?? '');
  const [vidPrompt, setVidPrompt] = useState(shot.video_prompt ?? '');
  const [endPrompt, setEndPrompt] = useState(shot.end_prompt ?? '');
  const [err, setErr] = useState('');
  const running = !!ov.data?.running;
  const aspect = ov.data?.project.aspect === '16:9' ? '16 / 9' : ov.data?.project.aspect === '1:1' ? '1 / 1' : '9 / 16';

  const refs = [
    ...shot.character_ids.map((id) => ov.data?.characters.find((c) => c.id === id)).filter(Boolean).map((c) => ({ key: `c${c!.id}`, name: c!.name, img: c!.ref_image_url })),
    ...[ov.data?.scenes.find((s) => s.id === shot.scene_id)].filter(Boolean).map((s) => ({ key: `s${s!.id}`, name: s!.name, img: s!.ref_image_url })),
    ...shot.prop_ids.map((id) => ov.data?.props.find((p) => p.id === id)).filter(Boolean).map((p) => ({ key: `p${p!.id}`, name: p!.name, img: p!.ref_image_url })),
  ];

  const save = async (fields: Partial<Shot>) => {
    setErr('');
    try {
      await dramaAPI.updateShot(shot.id, fields);
      invalidate(episodeId);
      return true;
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : '保存失败');
      return false;
    }
  };
  const go = async (input: Record<string, unknown>, before?: Partial<Shot>) => {
    if (before && !(await save(before))) return;
    start.mutate({ step: 'visual_gen', input: { episode_id: episodeId, shot_ids: [shot.id], ...input } }, { onError: (e) => setErr((e as Error).message) });
  };
  const imgDirty = imgPrompt.trim() !== (shot.image_prompt ?? '').trim();
  const vidDirty = vidPrompt.trim() !== (shot.video_prompt ?? '').trim();
  const endDirty = endPrompt.trim() !== (shot.end_prompt ?? '').trim();
  const blocking = (shot.blocking ?? []).filter((b) => b.character);
  const busy = running || start.isPending;

  const price = (n: number) =>
    n > 0 ? (
      <Box component="span" sx={{ ml: 1, display: 'inline-flex', alignItems: 'center', gap: 0.25, opacity: 0.85, fontSize: 13 }}>
        <DiamondRoundedIcon sx={{ fontSize: 14 }} />
        {n}
      </Box>
    ) : null;

  return (
    <Stack spacing={1.5} sx={{ p: 1.75 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>
          {label}
        </Typography>
        <Chip size="small" variant="outlined" label={SHOT_TYPES[shot.shot_type] ?? shot.shot_type} />
        <Chip size="small" variant="outlined" label={CAMERA_MOVES[shot.camera_move] ?? shot.camera_move} />
        {shot.composition && COMPOSITIONS[shot.composition] && <Chip size="small" variant="outlined" label={COMPOSITIONS[shot.composition]} />}
        <Chip size="small" variant="outlined" label={`${shot.duration_sec}s`} />
        {shot.av_key && shot.video_url && (
          <Tooltip title="这一镜的视频由 MiniMax H3 音画同出:口型和环境声是一起生成的">
            <Chip size="small" color="secondary" variant="outlined" label="MiniMax H3" />
          </Tooltip>
        )}
      </Stack>

      <ToggleButtonGroup exclusive fullWidth size="small" value={mode} onChange={(_, v) => v && setMode(v)}>
        <ToggleButton value="image">绘图</ToggleButton>
        <ToggleButton value="video">视频</ToggleButton>
      </ToggleButtonGroup>

      <Box sx={{ display: 'flex', justifyContent: 'center', bgcolor: 'action.hover', borderRadius: 1.5, p: 1 }}>
        <MediaThumb src={shot.frame_url} video={mode === 'video' ? shotVideo(shot) : undefined} height={220} ratio={aspect} />
      </Box>
      {shot.gen_error && (
        <Typography variant="caption" color="error">
          {shot.gen_error}
        </Typography>
      )}

      {mode === 'image' ? (
        <>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              画面提示词
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={5}
              maxRows={12}
              size="small"
              placeholder="这一镜画面里有什么:人物动作、表情、构图、光线……"
              value={imgPrompt}
              onChange={(e) => setImgPrompt(e.target.value)}
              onBlur={() => imgDirty && save({ image_prompt: imgPrompt.trim() })}
              slotProps={{ input: { sx: { fontSize: 13 } } }}
            />
          </Box>
          {refs.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
                参考主体
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                {refs.map((r) => (
                  <Chip key={r.key} size="small" variant="outlined" avatar={<Avatar src={r.img || undefined}>{r.name.slice(0, 1)}</Avatar>} label={r.name} />
                ))}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                角色的主体图会作为参考,保持人物长相一致。
              </Typography>
            </Box>
          )}
          {blocking.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                站位
              </Typography>
              <Stack spacing={0.5}>
                {blocking.map((b) => (
                  <Typography key={b.character} variant="body2" sx={{ fontSize: 13 }}>
                    <Box component="span" sx={{ fontWeight: 600, mr: 1 }}>
                      {b.character}
                    </Box>
                    {blockingText(b) || '—'}
                    {b.outfit && (
                      <Box component="span" sx={{ color: 'text.secondary', ml: 1 }}>
                        {b.outfit}
                      </Box>
                    )}
                  </Typography>
                ))}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                出图和质检都按站位来;同一场戏里衣着自动保持一致。
              </Typography>
            </Box>
          )}
          <Button variant="contained" sx={{ borderRadius: 5 }} disabled={busy || !cost.canImage} onClick={() => go({ force: true }, imgDirty ? { image_prompt: imgPrompt.trim() } : undefined)}>
            {shot.frame_url ? '重新绘图' : '图片生成'}
            {price(cost.shot)}
          </Button>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <UploadImageButton label="上传画面" onUploaded={(url) => save({ frame_url: url, status: 'done' })} />
          </Stack>
        </>
      ) : (
        <>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              视频提示词
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={4}
              maxRows={10}
              size="small"
              placeholder="画面怎么动:人物动作、镜头运动、节奏……"
              value={vidPrompt}
              onChange={(e) => setVidPrompt(e.target.value)}
              onBlur={() => vidDirty && save({ video_prompt: vidPrompt.trim() })}
              slotProps={{ input: { sx: { fontSize: 13 } } }}
            />
            <Typography variant="caption" color="text.secondary">
              用这一镜的画面做首帧,时长 {shot.duration_sec} 秒。
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              结尾画面
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={2}
              maxRows={8}
              size="small"
              placeholder="有走进来、转身、擦肩而过这类动作时,写这一镜结束那一刻的画面;动作只在原地发生就留空"
              value={endPrompt}
              onChange={(e) => setEndPrompt(e.target.value)}
              onBlur={() => endDirty && save({ end_prompt: endPrompt.trim() })}
              slotProps={{ input: { sx: { fontSize: 13 } } }}
            />
            {shot.end_frame_url && endPrompt.trim() && (
              <Box sx={{ display: 'flex', justifyContent: 'center', bgcolor: 'action.hover', borderRadius: 1.5, p: 1, mt: 1 }}>
                <MediaThumb src={shot.end_frame_url} height={140} ratio={aspect} />
              </Box>
            )}
            <Typography variant="caption" color="text.secondary">
              写了结尾画面:先出结尾那一帧,再用开头、结尾两张画面补出中间的动作。
            </Typography>
          </Box>
          <Button
            variant="contained"
            sx={{ borderRadius: 5 }}
            disabled={busy || !cost.canVideo}
            onClick={() =>
              go(
                shot.video_url ? { redo_video: true } : { video: true },
                vidDirty || endDirty ? { ...(vidDirty && { video_prompt: vidPrompt.trim() }), ...(endDirty && { end_prompt: endPrompt.trim() }) } : undefined,
              )
            }
          >
            {shot.video_url ? '重新生成视频' : shot.frame_url ? '生成视频' : '出图并生成视频'}
            {price(cost.i2v + (shot.frame_url ? 0 : cost.shot))}
          </Button>
          {!cost.canVideo && cost.loaded && (
            <Typography variant="caption" color="text.secondary">
              图生视频服务暂未开放。
            </Typography>
          )}
        </>
      )}

      {running && (
        <Typography variant="caption" color="text.secondary">
          有任务在进行中,结束后再生成。
        </Typography>
      )}
      {err && (
        <Alert severity="error" onClose={() => setErr('')}>
          {err}
        </Alert>
      )}
    </Stack>
  );
}

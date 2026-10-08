'use client';

/**
 * 右栏「主体图」:选中的角色 / 场景 / 道具。改图片提示词、单独出一张图(显示钻石单价)、上传参考图、
 * 打开完整设定。出图走 visual_design 的 character_ids / scene_ids / prop_ids,只动这一个主体。
 */

import React, { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DiamondRoundedIcon from '@mui/icons-material/DiamondRounded';
import type { Selection } from '../Workbench';
import { MediaThumb, UploadImageButton } from '../common';
import { useInvalidate, useOverview, useStartTask, useUnitCost } from '../useProject';
import { EntityDialog, ROLE_LABEL, TITLES, entityAPI, type Entity, type Kind } from '../sections/entities';

const IDS_KEY: Record<Kind, string> = { character: 'character_ids', scene: 'scene_ids', prop: 'prop_ids' };

export default function SubjectPanel({ projectId, selected }: { projectId: number; selected: Selection }) {
  const ov = useOverview(projectId);
  const kind = selected && selected.type !== 'shot' ? selected.type : null;
  const list: Entity[] = !ov.data || !kind ? [] : kind === 'character' ? ov.data.characters : kind === 'scene' ? ov.data.scenes : ov.data.props;
  const it = list.find((x) => x.id === selected?.id);
  if (!kind || !it) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
        在左边点一个角色、场景或道具,在这里改它的图片提示词、生成或上传主体图。
      </Typography>
    );
  }
  // key:换了主体就重置输入框
  return <Editor key={`${kind}-${it.id}`} projectId={projectId} kind={kind} it={it} running={!!ov.data?.running} />;
}

function Editor({ projectId, kind, it, running }: { projectId: number; kind: Kind; it: Entity; running: boolean }) {
  const start = useStartTask(projectId);
  const invalidate = useInvalidate(projectId);
  const cost = useUnitCost();
  const [prompt, setPrompt] = useState(it.visual_prompt ?? '');
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState('');
  const api = entityAPI(kind, projectId);
  const meta = TITLES[kind];
  const face = 'face_ref_url' in it ? it.face_ref_url : undefined;
  const dirty = prompt.trim() !== (it.visual_prompt ?? '').trim();
  const sub = 'role' in it ? [it.age, it.gender, ROLE_LABEL[it.role] ?? it.role].filter(Boolean).join(' · ') : 'time_of_day' in it ? [it.time_of_day, it.mood].filter(Boolean).join(' · ') : it.description;

  const guard = async (fn: () => Promise<unknown>) => {
    setErr('');
    try {
      await fn();
      invalidate();
      return true;
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : '操作失败');
      return false;
    }
  };
  const generate = async () => {
    if (dirty && !(await guard(() => api.update(it.id, { visual_prompt: prompt.trim() })))) return;
    start.mutate({ step: 'visual_design', input: { [IDS_KEY[kind]]: [it.id] } }, { onError: (e) => setErr((e as Error).message) });
  };

  return (
    <Stack spacing={1.5} sx={{ p: 1.75 }}>
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {meta.title}:{it.name}
        </Typography>
        {sub && (
          <Typography variant="caption" color="text.secondary">
            {sub}
          </Typography>
        )}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, bgcolor: 'action.hover', borderRadius: 1.5, p: 1 }}>
        <MediaThumb src={it.ref_image_url} height={kind === 'character' ? 260 : 170} ratio={kind === 'character' ? '3 / 4' : '16 / 10'} />
        {face && (
          <Box sx={{ textAlign: 'center' }}>
            <MediaThumb src={face} height={120} ratio="1 / 1" />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, maxWidth: 120 }}>
              头肩近照
            </Typography>
          </Box>
        )}
      </Box>
      {face && (
        <Typography variant="caption" color="text.secondary">
          头肩近照由定妆照自动改出,特写和近景镜头拿它认人;定妆照换了会自动重出。
        </Typography>
      )}

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          图片提示词
        </Typography>
        <TextField
          fullWidth
          multiline
          minRows={6}
          maxRows={14}
          size="small"
          placeholder="描述外貌、服装、发型、配色……(英文效果更稳定)"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onBlur={() => dirty && guard(() => api.update(it.id, { visual_prompt: prompt.trim() }))}
          slotProps={{ input: { sx: { fontSize: 13 } } }}
        />
        <Typography variant="caption" color="text.secondary">
          画风前缀由项目风格统一加上;这段固定后,每个镜头里的{meta.title}都按它来画。
        </Typography>
      </Box>

      <Button
        variant="contained"
        disabled={running || start.isPending || !cost.t2i || !prompt.trim()}
        onClick={generate}
        sx={{ borderRadius: 5 }}
      >
        {it.ref_image_url ? '重新生成' : '图片生成'}
        {cost.t2i > 0 && (
          <Box component="span" sx={{ ml: 1, display: 'inline-flex', alignItems: 'center', gap: 0.25, opacity: 0.85, fontSize: 13 }}>
            <DiamondRoundedIcon sx={{ fontSize: 14 }} />
            {cost.t2i}
          </Box>
        )}
      </Button>
      {!cost.t2i && cost.loaded && (
        <Typography variant="caption" color="text.secondary">
          出图服务暂未开放,可以先上传图片。
        </Typography>
      )}
      {running && (
        <Typography variant="caption" color="text.secondary">
          有任务在进行中,结束后再生成。
        </Typography>
      )}

      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <UploadImageButton label="上传参考图" onUploaded={(url) => guard(() => api.update(it.id, { ref_image_url: url, status: 'locked' }))} />
        {it.ref_image_url && (
          <Button size="small" color="inherit" onClick={() => guard(() => api.update(it.id, { ref_image_url: '', status: 'draft' }))}>
            清除图片
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button size="small" onClick={() => setEditing(true)}>
          完整设定
        </Button>
      </Stack>
      {err && (
        <Alert severity="error" onClose={() => setErr('')}>
          {err}
        </Alert>
      )}

      <EntityDialog kind={kind} projectId={projectId} open={editing} entity={it} onClose={() => setEditing(false)} onSave={async (fields) => void (await guard(() => api.update(it.id, fields)))} />
    </Stack>
  );
}

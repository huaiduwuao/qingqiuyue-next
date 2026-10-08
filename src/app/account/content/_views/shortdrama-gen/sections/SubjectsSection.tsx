'use client';

/**
 * 主体:角色 / 场景 / 道具的卡片墙。点卡片在右栏「主体图」里改提示词、单独出图或上传;
 * 顶部可以让美术员工补全提示词、批量生成主体图。主体图是之后每个镜头保持人物和场景一致的参考。
 */

import React, { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import type { SectionProps } from '../Workbench';
import { Empty, UploadImageButton } from '../common';
import { useInvalidate, useOverview, useStartTask, useUnitCost } from '../useProject';
import { EntityDialog, ROLE_LABEL, TITLES, entityAPI, type Entity, type Kind } from './entities';

const KINDS: Kind[] = ['character', 'scene', 'prop'];

export default function SubjectsSection({ projectId, selected, select }: SectionProps) {
  const ov = useOverview(projectId);
  const start = useStartTask(projectId);
  const invalidate = useInvalidate(projectId);
  const cost = useUnitCost();
  const [kind, setKind] = useState<Kind>('character');
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState('');

  if (ov.isLoading || !ov.data) return <Skeleton variant="rounded" height={320} />;
  const lists: Record<Kind, Entity[]> = { character: ov.data.characters, scene: ov.data.scenes, prop: ov.data.props };
  const list = lists[kind];
  const running = !!ov.data.running;
  const total = lists.character.length + lists.scene.length + lists.prop.length;
  const api = entityAPI(kind, projectId);
  const meta = TITLES[kind];
  const ratio = kind === 'character' ? '3 / 4' : '16 / 10';
  const guard = async (fn: () => Promise<unknown>) => {
    setErr('');
    try {
      await fn();
      invalidate();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : '操作失败');
    }
  };
  const pick = (it: Entity) => select?.({ type: kind, id: it.id, label: `${meta.title}「${it.name}」` });
  // 批量出图只管角色和场景(道具在右栏单独出)
  const missingImages = [...lists.character, ...lists.scene].filter((x) => !x.ref_image_url).length;

  if (total === 0) {
    return (
      <Empty
        title="还没有主体"
        hint="编剧写剧本框架时会列出角色、场景和道具;也可以先手动添加。"
        action={
          <Button variant="contained" disabled={running} onClick={() => start.mutate({ step: 'screenwriter' })}>
            运行剧本框架
          </Button>
        }
      />
    );
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Tabs value={kind} onChange={(_, v) => setKind(v)} sx={{ flex: 1, minHeight: 36, '& .MuiTab-root': { minHeight: 36, minWidth: 0, px: 1.5 } }}>
          {KINDS.map((k) => (
            <Tab key={k} value={k} label={`${TITLES[k].title} ${lists[k].length}`} />
          ))}
        </Tabs>
        <Tooltip title="让美术员工按剧本给还没有提示词的主体写图片提示词(不出图,不扣钻)">
          <span>
            <Button size="small" startIcon={<AutoAwesomeRoundedIcon />} disabled={running} onClick={() => start.mutate({ step: 'visual_design', input: { generate_images: false } })}>
              补全提示词
            </Button>
          </span>
        </Tooltip>
        <Tooltip title={cost.t2i ? `给还没有图的角色和场景出图,每张 ${cost.t2i} 钻` : '出图服务暂未开放,可以先上传图片'}>
          <span>
            <Button size="small" variant="outlined" startIcon={<CollectionsRoundedIcon />} disabled={running || !cost.t2i || missingImages <= 0} onClick={() => start.mutate({ step: 'visual_design', input: { generate_images: true } })}>
              批量生成主体图{cost.t2i && missingImages > 0 ? ` · 约 ${missingImages * cost.t2i} 钻` : ''}
            </Button>
          </span>
        </Tooltip>
      </Stack>
      {err && (
        <Alert severity="error" onClose={() => setErr('')}>
          {err}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(auto-fill, minmax(170px, 1fr))' }, gap: 1.5 }}>
        {list.map((it) => {
          const on = selected?.type === kind && selected.id === it.id;
          const sub = 'role' in it ? [ROLE_LABEL[it.role] ?? it.role, it.gender, it.age].filter(Boolean).join(' · ') : 'time_of_day' in it ? [it.time_of_day, it.mood].filter(Boolean).join(' · ') : it.significance;
          return (
            <Box
              key={it.id}
              onClick={() => pick(it)}
              sx={{ cursor: 'pointer', borderRadius: 2, overflow: 'hidden', border: on ? 2 : 1, borderColor: on ? 'primary.main' : 'divider', bgcolor: 'background.paper', display: 'flex', flexDirection: 'column' }}
            >
              <Stack direction="row" sx={{ alignItems: 'center', px: 1, py: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, flex: 1 }} noWrap>
                  {it.name}
                </Typography>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`删除${meta.title}「${it.name}」?`)) guard(() => api.remove(it.id));
                  }}
                  aria-label="删除"
                >
                  <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Stack>
              <Box sx={{ position: 'relative', aspectRatio: ratio, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {it.ref_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.ref_image_url} alt={it.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Stack sx={{ alignItems: 'center' }} spacing={0.5} onClick={(e) => e.stopPropagation()}>
                    <ImageRoundedIcon sx={{ color: 'text.disabled', fontSize: 32 }} />
                    <UploadImageButton label="上传图片" onUploaded={(url) => guard(() => api.update(it.id, { ref_image_url: url, status: 'locked' }))} />
                  </Stack>
                )}
              </Box>
              <Typography variant="caption" color={it.visual_prompt ? 'text.secondary' : 'warning.main'} noWrap sx={{ px: 1, py: 0.5 }}>
                {it.visual_prompt ? sub || '已有提示词' : '还没有图片提示词'}
              </Typography>
            </Box>
          );
        })}
        <ButtonBase
          onClick={() => setCreating(true)}
          sx={{ borderRadius: 2, border: 1, borderStyle: 'dashed', borderColor: 'divider', minHeight: 160, flexDirection: 'column', gap: 0.5, color: 'text.secondary' }}
        >
          <AddRoundedIcon />
          <Typography variant="caption">新建{meta.title}</Typography>
        </ButtonBase>
      </Box>

      <EntityDialog
        kind={kind}
        projectId={projectId}
        open={creating}
        entity={null}
        onClose={() => setCreating(false)}
        onSave={async (fields) => {
          await guard(() => api.create(fields));
        }}
      />
    </Stack>
  );
}

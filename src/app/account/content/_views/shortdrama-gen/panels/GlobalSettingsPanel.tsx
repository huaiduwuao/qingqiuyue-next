'use client';

/**
 * 右栏「全局设定」(剧本页):视频比例 + 风格参考。
 * 换风格只影响之后生成的图和视频;已有画面要在故事板里重画才会跟着变。
 */

import React, { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { dramaAPI, type DramaStyle } from '@/apis/shortdrama';
import StylePicker, { styleKey } from '../StylePicker';
import { useInvalidate, useOverview, useStyles } from '../useProject';

const ASPECTS: { v: string; label: string; w: number; h: number; size: [number, number] }[] = [
  { v: '9:16', label: '9:16', w: 12, h: 20, size: [768, 1344] },
  { v: '16:9', label: '16:9', w: 22, h: 12, size: [1344, 768] },
  { v: '1:1', label: '1:1', w: 16, h: 16, size: [1024, 1024] },
];

export default function GlobalSettingsPanel({ projectId }: { projectId: number }) {
  const ov = useOverview(projectId);
  const styles = useStyles();
  const invalidate = useInvalidate(projectId);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const p = ov.data?.project;
  if (!p) return null;
  const running = !!ov.data?.running;
  const hasFrames = Object.values(ov.data?.episode_stats ?? {}).some((s) => s.framed > 0);
  const curStyleId = Number(p.settings?.style_id ?? 0);
  const list = styles.data ?? [];
  const current = list.find((s) => s.id === curStyleId);

  const save = async (fields: Parameters<typeof dramaAPI.updateProject>[1], ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await dramaAPI.updateProject(projectId, fields);
      invalidate();
      setMsg({ ok: true, text: ok });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : '保存失败' });
    } finally {
      setBusy(false);
    }
  };
  const pickStyle = (s: DramaStyle) => {
    if (s.id === curStyleId) return;
    if (hasFrames && !window.confirm(`换成「${s.name}」?只影响之后生成的画面,已生成的镜头要重画才会变。`)) return;
    save({ style_id: s.id }, `已换成「${s.name}」`);
  };

  return (
    <Stack spacing={2.5} sx={{ p: 1.75 }}>
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          视频比例
        </Typography>
        <Stack direction="row" spacing={1}>
          {ASPECTS.map((a) => {
            const on = p.aspect === a.v;
            return (
              <ButtonBase
                key={a.v}
                disabled={busy || running}
                onClick={() => !on && save({ aspect: a.v, width: a.size[0], height: a.size[1] }, `已改为 ${a.label}`)}
                sx={{ flex: 1, flexDirection: 'column', gap: 0.5, py: 1, borderRadius: 1.5, border: 1, borderColor: on ? 'primary.main' : 'divider', bgcolor: on ? 'action.selected' : 'transparent' }}
              >
                <Box sx={{ width: a.w, height: a.h, border: 1.5, borderColor: on ? 'primary.main' : 'text.secondary', borderRadius: 0.5 }} />
                <Typography variant="caption">{a.label}</Typography>
              </ButtonBase>
            );
          })}
        </Stack>
      </Box>

      <Box>
        <Stack direction="row" sx={{ alignItems: 'baseline', mb: 1 }}>
          <Typography variant="subtitle2" sx={{ flex: 1 }}>
            风格参考
          </Typography>
          <Typography variant="caption" color="text.secondary">
            当前:{current?.name ?? p.style}
          </Typography>
        </Stack>
        {styles.isError || (!styles.isLoading && list.length === 0) ? (
          <Typography variant="caption" color="text.secondary">
            风格库暂不可用。
          </Typography>
        ) : (
          <StylePicker
            styles={list}
            loading={styles.isLoading}
            selected={current ? styleKey(current) : undefined}
            onPick={pickStyle}
            columns={{ xs: 3, sm: 3 }}
            compact
            disabled={busy || running}
          />
        )}
      </Box>

      {msg && (
        <Alert severity={msg.ok ? 'success' : 'error'} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}
      {running && (
        <Typography variant="caption" color="text.secondary">
          有任务在进行中,结束后再改设定。
        </Typography>
      )}
    </Stack>
  );
}

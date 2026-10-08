'use client';

/**
 * 右栏「全局设定」(剧本页):分辨率(建项目时定好,只读)+ 风格参考。
 * 换风格只影响之后生成的图和视频;已有画面要在故事板里重画才会跟着变。
 */

import React, { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { dramaAPI, exportSize, type DramaStyle } from '@/apis/shortdrama';
import StylePicker, { styleKey } from '../StylePicker';
import { useInvalidate, useOverview, useStyles } from '../useProject';

const ASPECT_NAMES: Record<string, string> = { '9:16': '竖屏 9:16', '16:9': '横屏 16:9', '1:1': '方形 1:1' };

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
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          分辨率
        </Typography>
        <Typography variant="body2">
          {ASPECT_NAMES[p.aspect] ?? p.aspect} · 成片 {exportSize(p.aspect, p.settings?.export_quality)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          建项目时已定好,画面和成片都按这个规格出。
        </Typography>
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

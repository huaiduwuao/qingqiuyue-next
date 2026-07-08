'use client';

/**
 * ToolCatalog — 列出所有可用的数字人工具 + 实时调一个 demo 工具
 */

import React from 'react';
import {
  Box, Stack, Typography, Chip, IconButton, Tooltip, Accordion,
  AccordionSummary, AccordionDetails, Paper, Grid, Button,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useQuery } from '@tanstack/react-query';
import { digitalHumanApi, type ToolSummary } from '@/apis/digitalHuman';

const CATEGORY_COLORS: Record<string, string> = {
  face: '#ff4fd8',
  mouth: '#4fd8ff',
  body: '#5ddb96',
  camera: '#ffd54a',
  system: '#9fa8da',
};

const DEMO_PARAMS: Record<string, any> = {
  'face.setExpression': { template: 'happy', intensity: 0.8 },
  'face.mouthOpen': { value: 0.5 },
  'mouth.setViseme': { shape: 'aa', weight: 1 },
  'mouth.speak': { text: '这是一段示例语音' },
  'body.playAction': { name: 'wave', speed: 1, repeat: 1 },
  'body.move': { target: { x: 1 }, durationMs: 1500, style: 'walk' },
  'camera.control': { action: 'face' },
};

const DEMO_CATEGORIES_ORDER = ['face', 'mouth', 'body', 'camera', 'system'];

export default function ToolCatalog({
  onDemoToolCall,
}: { onDemoToolCall?: (tool: { name: string; params: any }) => void }) {
  const toolsQuery = useQuery({ queryKey: ['digital-human', 'tools'], queryFn: () => digitalHumanApi.listTools() });
  const [expanded, setExpanded] = React.useState<string | null>('face.setExpression');

  if (toolsQuery.isLoading) return <Typography variant="caption">加载工具清单…</Typography>;
  if (toolsQuery.error) return <Typography variant="caption" color="error">加载失败</Typography>;

  const tools = toolsQuery.data?.tools || [];
  const grouped: Record<string, ToolSummary[]> = {};
  for (const t of tools) (grouped[t.category] ||= []).push(t);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="subtitle2" color="text.secondary">
          工具清单 ({tools.length})
        </Typography>
        <IconButton size="small" onClick={() => toolsQuery.refetch()}>
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Stack>
      {DEMO_CATEGORIES_ORDER.map((cat) => {
        const list = grouped[cat];
        if (!list || list.length === 0) return null;
        const color = CATEGORY_COLORS[cat];
        return (
          <Accordion
            key={cat}
            expanded={expanded === cat || list.some(t => expanded === t.name)}
            onChange={(_, e) => setExpanded(e ? cat : false)}
            sx={{
              border: `1px solid ${color}30`,
              bgcolor: `${color}08`,
              mb: 0.5, '&:before': { display: 'none' },
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography sx={{ color, fontWeight: 600, fontSize: 13 }}>
                {cat} ({list.length})
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1}>
                {list.map(t => (
                  <Paper key={t.name} variant="outlined" sx={{ p: 1.5, borderColor: `${color}40` }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography variant="caption" sx={{ fontFamily: 'ui-monospace, monospace', color, fontWeight: 600 }}>
                          {t.name}
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
                          {t.description}
                        </Typography>
                      </Box>
                      <Stack direction="row" gap={0.5} flexWrap="wrap" justifyContent="flex-end" sx={{ maxWidth: 220 }}>
                        {t.params.map(p => (
                          <Chip key={p} label={p} size="small" variant="outlined" sx={{ fontFamily: 'ui-monospace, monospace', fontSize: 10 }} />
                        ))}
                      </Stack>
                    </Stack>
                    {onDemoToolCall && DEMO_PARAMS[t.name] && (
                      <Button
                        size="small"
                        variant="outlined"
                        sx={{ mt: 1, fontSize: 11, color, borderColor: `${color}80` }}
                        onClick={() => onDemoToolCall({ name: t.name, params: DEMO_PARAMS[t.name] })}
                      >
                        ▶ 试一下
                      </Button>
                    )}
                  </Paper>
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
}

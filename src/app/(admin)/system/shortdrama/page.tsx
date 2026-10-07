'use client';

/**
 * AI 短剧生成 —— 管理端。用户端(/account/content?tab=shortdrama-gen)只挑风格、按钻付费;
 * 画风背后的提示词与模型参数(风格库)、出图出片用的 ComfyUI 工作流模板和单价都在这里维护。
 * 后端:风格库 agentmanager /shortdrama/admin/styles,模板 gen-api /generate/admin/workflows,都只认管理员。
 */

import React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useAuthority } from '@/contexts/AuthContext';
import { useCapabilities } from '@/app/account/content/_views/shortdrama-gen/useProject';
import StyleAdmin from './StyleAdmin';
import WorkflowAdmin, { KIND_LABEL } from './WorkflowAdmin';

export default function ShortdramaAdminPage() {
  const { isAdmin } = useAuthority();
  const caps = useCapabilities();
  const c = caps.data?.capabilities;
  if (!isAdmin) return <Alert severity="warning">只有管理员可以维护短剧风格和出图模板。</Alert>;

  return (
    <Container maxWidth="xl">
      <Stack spacing={2} sx={{ py: { xs: 2, md: 3 } }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            AI 短剧生成
          </Typography>
          <Typography variant="body2" color="text.secondary">
            用户只挑风格、看预估、按钻付费。每出一张图 / 一段视频扣对应种类里最便宜的已启用模板的费用,失败自动退回。
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {caps.data?.error && <Alert severity="warning">{caps.data.error}</Alert>}
          {(['t2i', 'i2i', 't2v', 'i2v'] as const).map((k) => (
            <Tooltip key={k} title={c?.[k]?.available ? '' : c?.[k]?.reason || ''}>
              <Chip
                label={`${KIND_LABEL[k]}:${c?.[k]?.available ? `${c[k].workflows.join(' / ')}(${c[k].minCost} 钻/次)` : '不可用'}`}
                color={c?.[k]?.available ? 'success' : 'default'}
                variant="outlined"
              />
            </Tooltip>
          ))}
          <Chip label={`LLM:${caps.data?.llm_ready ? '已配置' : '未配置'}`} color={caps.data?.llm_ready ? 'success' : 'error'} variant="outlined" />
        </Stack>
        <StyleAdmin />
        <WorkflowAdmin />
      </Stack>
    </Container>
  );
}

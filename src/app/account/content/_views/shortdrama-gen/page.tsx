'use client';

/**
 * AI 短剧生成 —— 入口:项目列表 + 新建;选中项目进入工作台(Workbench)。
 *
 * 七个数字员工(编剧 / 角色美术 / 分镜 / 视觉生成 / 节奏 / 质检 / 反馈优化)住在 Agent 平台
 * (internal/agentmanager/shortdrama),这里只是它们的工作台前端。
 */

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Fab from '@mui/material/Fab';
import { useResponsive } from '@/hooks/useResponsive';
import { MobileSection, MobileListRow, MoreLink } from '@/components/mobile/MobileSection';
import { dramaAPI, type Project } from '@/apis/shortdrama';
import { ListLayout, ListLayoutSwitch } from '@/components/common/ListLayout';
import { coverBackgroundImage } from '@/lib/media';
import { MediaThumb } from './common';
import { qk, useAgents, useCapabilities, useCurrentProjectId } from './useProject';
import Workbench from './Workbench';
import CreateProjectDialog from './CreateProjectDialog';
import { useApp } from '@/contexts/AppContext';
import { loginHref } from '@/lib/auth/redirect';
import { useRouter } from 'next/navigation';

const STAGE_LABEL: Record<string, string> = {
  intent: '待开工', script: '剧本', visual: '视觉设定', storyboard: '分镜', pacing: '节奏', render: '出图', qc: '质检',
};

export default function ShortdramaGenPage() {
  const [pid, setPid] = useCurrentProjectId();
  if (pid > 0) {
    return <Workbench projectId={pid} onExit={() => setPid(0)} />;
  }
  return <ProjectList onOpen={setPid} />;
}

function ProjectList({ onOpen }: { onOpen: (id: number) => void }) {
  const qc = useQueryClient();
  const projects = useQuery({ queryKey: qk.projects, queryFn: dramaAPI.listProjects });
  const caps = useCapabilities();
  const agents = useAgents();
  const [creating, setCreating] = useState(false);

  const capsData = caps.data?.capabilities;
  const llmReady = caps.data?.llm_ready ?? agents.data?.llm_ready;
  const { isMobile } = useResponsive();
  const [helpOpen, setHelpOpen] = useState(false);
  const { currentUser } = useApp();
  const router = useRouter();
  // 没登录时接口回 401「unauthorized: no session」,原样显示用户看不懂;换成登录引导
  const needLogin = !currentUser || /unauthori[sz]ed|no session|401/i.test(String((projects.error as Error | null)?.message ?? ''));
  const loginPrompt = (
    <Card variant="outlined" sx={{ p: 3, textAlign: 'center', borderRadius: 3 }}>
      <AutoAwesomeRoundedIcon color="primary" sx={{ fontSize: 36, mb: 1 }} />
      <Typography sx={{ fontSize: 15, fontWeight: 700 }}>登录后使用 AI 短剧生成</Typography>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5, mb: 2 }}>
        一句话故事意图,AI 帮你出剧本、角色和分镜
      </Typography>
      <Button variant="contained" onClick={() => router.push(loginHref())} sx={{ borderRadius: 999, px: 4 }}>
        登录 / 注册
      </Button>
    </Card>
  );

  const createDialog = (
    <CreateProjectDialog
      open={creating}
      onClose={() => setCreating(false)}
      onCreated={(p) => {
        qc.invalidateQueries({ queryKey: qk.projects });
        setCreating(false);
        onOpen(p.id);
      }}
    />
  );

  if (isMobile) {
    const noLlm = !!caps.data && llmReady === false;
    const noGen = !!capsData && !capsData.t2i.available && !capsData.i2i.available;
    const list = projects.data ?? [];
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {/* 介绍 + 两条环境提示合成一行;全文在「说明」里 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 0.5 }}>
          {noLlm ? (
            <WarningAmberRoundedIcon sx={{ fontSize: 16, color: 'warning.main' }} />
          ) : noGen ? (
            <InfoOutlinedIcon sx={{ fontSize: 16, color: 'info.main' }} />
          ) : null}
          <Typography
            noWrap
            sx={{ flex: 1, minWidth: 0, fontSize: 12, color: noLlm ? 'warning.main' : 'text.secondary' }}
          >
            {noLlm ? '未配置 LLM 供应商,AI 创作暂不可用' : noGen ? '未启用出图工作流,出图/出片环节会跳过' : '一句话意图,AI 帮你出剧本与分镜'}
          </Typography>
          <MoreLink label="说明" onClick={() => setHelpOpen(true)} />
        </Box>

        {projects.isError && needLogin ? (
          loginPrompt
        ) : projects.isLoading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={72} sx={{ borderRadius: 3 }} />)
        ) : projects.isError ? (
          <Alert severity="error">{(projects.error as Error).message}</Alert>
        ) : list.length === 0 ? (
          <MobileSection>
            <Box sx={{ textAlign: 'center', pt: 2.5, pb: 0.5 }}>
              <AutoAwesomeRoundedIcon color="primary" sx={{ fontSize: 32, mb: 0.5 }} />
              <Typography sx={{ fontSize: 14, fontWeight: 600 }}>还没有短剧项目</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>写下一句故事意图,点右下「新建短剧」开始</Typography>
            </Box>
          </MobileSection>
        ) : (
          <MobileSection title="我的短剧" extra={`${list.length} 部`} flush>
            {list.map((p, i) => (
              <MobileListRow
                key={p.id}
                divider={i > 0}
                onClick={() => onOpen(p.id)}
                leading={
                  <Box
                    sx={{
                      width: 40,
                      height: 52,
                      flexShrink: 0,
                      borderRadius: 1.5,
                      bgcolor: 'action.hover',
                      backgroundImage: coverBackgroundImage(p.cover_url),
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {!p.cover_url && <AutoAwesomeRoundedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />}
                  </Box>
                }
                title={p.title || p.intent}
                subtitle={
                  <>
                    <Box component="span" sx={{ color: p.status === 'done' ? 'success.main' : 'text.secondary', fontWeight: 600 }}>
                      {STAGE_LABEL[p.stage] ?? p.stage}
                    </Box>
                    {[p.genre, `${p.episodes} 集 · ${p.ep_seconds}s`].filter(Boolean).map((t) => ` · ${t}`).join('')}
                  </>
                }
              />
            ))}
          </MobileSection>
        )}

        <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>AI 短剧生成</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
              一句话故事意图 → AI 产出可编辑的剧本、角色设定、分镜与画面。
            </Typography>
            {noLlm && (
              <Alert severity="warning">
                Agent 平台还没有配置默认 LLM 供应商,AI 创作无法工作。请管理员在「系统 → Agent 平台 → 模型供应商」里配置。
              </Alert>
            )}
            {noGen && (
              <Alert severity="info">
                当前没有启用的 ComfyUI 出图工作流:剧本、角色设定、分镜、节奏、质检都能正常进行,出图/出片环节会跳过。需要管理员导入并启用模板。
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button variant="text" onClick={() => setHelpOpen(false)}>
              知道了
            </Button>
          </DialogActions>
        </Dialog>

        {!needLogin && <Fab
          variant="extended"
          color="primary"
          onClick={() => setCreating(true)}
          sx={{
            position: 'fixed',
            right: 16,
            bottom: 'calc(16px + var(--bottom-nav-inset, 0px) + var(--player-inset, 0px))',
            zIndex: 10,
          }}
        >
          <AddRoundedIcon sx={{ mr: 0.5 }} />
          新建短剧
        </Fab>}

        {createDialog}
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3, alignItems: { sm: 'center' } }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" gutterBottom>
            AI 短剧生成
          </Typography>
          <Typography variant="body2" color="text.secondary">
            一句话故事意图 → AI 产出可编辑的剧本、角色设定、分镜与画面。
          </Typography>
        </Box>
        <ListLayoutSwitch sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }} />
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setCreating(true)}>
          新建短剧
        </Button>
      </Stack>

      {caps.data && llmReady === false && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Agent 平台还没有配置默认 LLM 供应商,AI 创作无法工作。请管理员在「系统 → Agent 平台 → 模型供应商」里配置。
        </Alert>
      )}
      {capsData && !capsData.t2i.available && !capsData.i2i.available && (
        <Alert severity="info" sx={{ mb: 2 }}>
          当前没有启用的 ComfyUI 出图工作流:剧本、角色设定、分镜、节奏、质检都能正常进行,出图/出片环节会跳过。需要管理员导入并启用模板。
        </Alert>
      )}

      {projects.isError && needLogin ? (
        loginPrompt
      ) : projects.isLoading ? (
        <ListLayout rows minColumnWidth={340} gap={16}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={220} />
          ))}
        </ListLayout>
      ) : projects.isError ? (
        <Alert severity="error">{(projects.error as Error).message}</Alert>
      ) : (projects.data?.length ?? 0) === 0 ? (
        <Card variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <AutoAwesomeRoundedIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
          <Typography variant="h6" gutterBottom>
            还没有短剧项目
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            写下一句故事意图,比如「外卖员意外捡到一部能预知未来 10 分钟的手机」,AI 会把它变成剧本、角色和分镜。
          </Typography>
          <Button variant="contained" onClick={() => setCreating(true)}>
            开始第一部
          </Button>
        </Card>
      ) : (
        <ListLayout rows minColumnWidth={340} gap={16}>
          {projects.data!.map((p) => (
            <ProjectCard key={p.id} project={p} onOpen={() => onOpen(p.id)} />
          ))}
        </ListLayout>
      )}

      {createDialog}
    </Container>
  );
}

function ProjectCard({ project: p, onOpen }: { project: Project; onOpen: () => void }) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardActionArea onClick={onOpen} sx={{ height: '100%', alignItems: 'stretch' }}>
        <Box sx={{ display: 'flex', gap: 1.5, p: 1.5 }}>
          <MediaThumb src={p.cover_url} height={120} ratio={p.aspect === '16:9' ? '16 / 9' : '9 / 16'} />
          <CardContent sx={{ p: 0, flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 600 }} variant="subtitle1" noWrap>
              {p.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', mb: 1 }}>
              {p.logline || p.intent}
            </Typography>
            <Stack sx={{ flexWrap: 'wrap' }} direction="row" spacing={0.5} useFlexGap>
              <Chip size="small" label={STAGE_LABEL[p.stage] ?? p.stage} color={p.status === 'done' ? 'success' : 'default'} />
              {p.genre && <Chip size="small" variant="outlined" label={p.genre} />}
              <Chip size="small" variant="outlined" label={`${p.episodes} 集 · ${p.ep_seconds}s`} />
            </Stack>
          </CardContent>
        </Box>
      </CardActionArea>
    </Card>
  );
}

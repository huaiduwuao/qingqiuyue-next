'use client';

/**
 * /system/digital-human-instructions
 *
 * 数字人指令 (系统提示词) 可视化维护
 *   - 列表: 已有指令
 *   - 编辑: 全文 markdown + 单模板预览 (右栏)
 *   - 工具/表情/动作参考: 与提示词同步对齐
 */

import React from 'react';
import {
  Box, Typography, Stack, Card, CardContent, Button, Chip, IconButton,
  TextField, Tooltip, Snackbar, Alert, Tabs, Tab,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { digitalHumanApi, type Instruction } from '@/apis/digitalHuman';
import ExpressionPreview from '@/components/digital-human/ExpressionPreview';
import ToolCatalog from '@/components/digital-human/ToolCatalog';
import type { ExpressionTemplateName } from '@/digital-human/tools/expressions';

const LIST_FRACTION = '320px';

export default function DigitalHumanInstructionsPage() {
  const qc = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['digital-human', 'instructions'],
    queryFn: () => digitalHumanApi.listInstructions(),
    refetchInterval: 60_000,
  });

  const [editing, setEditing] = React.useState<Instruction | null>(null);
  const [creating, setCreating] = React.useState<boolean>(false);
  const [draft, setDraft] = React.useState<Instruction>({
    id: '', agentId: '', name: '', prompt: '', version: 1, updatedAt: '',
    description: '', tags: [],
  });
  const [snack, setSnack] = React.useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({ open: false, msg: '', severity: 'success' });
  const [previewTemplate, setPreviewTemplate] = React.useState<ExpressionTemplateName>('happy');
  const [tab, setTab] = React.useState(0);

  const saveMutation = useMutation({
    mutationFn: (data: Instruction) =>
      editing
        ? digitalHumanApi.updateInstruction(editing.agentId, data)
        : digitalHumanApi.createInstruction(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['digital-human', 'instructions'] });
      setSnack({ open: true, msg: editing ? '更新成功' : '创建成功', severity: 'success' });
      handleClose();
    },
    onError: (e: any) => setSnack({ open: true, msg: e.message, severity: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (agentId: string) => digitalHumanApi.deleteInstruction(agentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['digital-human', 'instructions'] });
      setSnack({ open: true, msg: '已删除', severity: 'success' });
    },
    onError: (e: any) => setSnack({ open: true, msg: e.message, severity: 'error' }),
  });

  function handleNew() {
    setEditing(null);
    setCreating(true);
    setDraft({
      id: '', agentId: '', name: '', prompt: '你是 "清秋月" 数字人助理...',
      version: 1, updatedAt: '', description: '', tags: [],
    });
  }

  function handleEdit(row: Instruction) {
    setEditing(row);
    setCreating(false);
    setDraft({ ...row });
  }

  function handleDuplicate(row: Instruction) {
    setEditing(null);
    setCreating(true);
    setDraft({
      ...row,
      id: '',
      agentId: `${row.agentId}_copy`,
      name: `${row.name} (副本)`,
      version: 1,
      updatedAt: '',
      isDefault: false,
    });
  }

  function handleClose() {
    setEditing(null);
    setCreating(false);
  }

  function handleSave() {
    if (!draft.agentId.trim() || !draft.prompt.trim()) {
      setSnack({ open: true, msg: 'agentId 与 prompt 不能为空', severity: 'error' });
      return;
    }
    saveMutation.mutate(draft);
  }

  if (listQuery.isLoading) {
    return <Box sx={{ p: 4 }}><Typography>加载中…</Typography></Box>;
  }

  const isOpen = editing !== null || creating;

  return (
    <Box sx={{ p: 3, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" sx={{ mb: 3, justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>数字人指令维护</Typography>
          <Typography variant="body2" color="text.secondary">
            管理 agent 的 system prompt 与工具调用规范 — LLM/Hermes 决策数字人如何说话/动作/表情
          </Typography>
        </Box>
        <Button
          variant="contained" startIcon={<AddRoundedIcon />}
          onClick={handleNew} disabled={isOpen}
        >
          新建指令
        </Button>
      </Stack>

      {/* 列表 + 编辑器 — 用 CSS grid 代替 Grid container/item,因为项目没装 @mui/material/Grid (only @mui/x-data-grid) */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: `${LIST_FRACTION} 1fr` },
          gap: 2,
          flex: 1,
          minHeight: 0,  // 允许 flex 子元素收缩
          overflow: 'hidden',
        }}
      >
        {/* 左栏: 列表 */}
        <Stack spacing={1.5} sx={{ overflow: 'auto', pr: 1, pb: 1 }}>
          {(listQuery.data || []).map((row) => (
            <Card key={row.agentId} variant="outlined"
              sx={{
                cursor: 'pointer',
                borderColor: editing?.agentId === row.agentId ? 'primary.main' : 'divider',
                borderWidth: editing?.agentId === row.agentId ? 2 : 1,
              }}
              onClick={() => !isOpen && handleEdit(row)}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Stack direction="row" sx={{ mb: 1, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Stack direction="row" spacing={0.5} sx={{ mb: 0.5 }}>
                      {row.isDefault && <Chip label="默认" size="small" color="primary" variant="outlined" />}
                      <Chip label={`v${row.version}`} size="small" variant="outlined" />
                    </Stack>
                    <Typography variant="subtitle2">{row.name}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'ui-monospace, monospace' }}>
                      {row.agentId}
                    </Typography>
                  </Box>
                  <Stack direction="row">
                    <Tooltip title="编辑"><IconButton size="small" onClick={(e) => { e.stopPropagation(); handleEdit(row); }}><EditRoundedIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="复制"><IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDuplicate(row); }}><ContentCopyRoundedIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title={row.isDefault ? '默认模板不可删' : '删除'}>
                      <span>
                        <IconButton size="small" disabled={row.isDefault} onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`确定删除 ${row.name}?`)) deleteMutation.mutate(row.agentId);
                        }}>
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </Stack>
                {row.description && (
                  <Typography variant="caption" color="text.secondary">{row.description}</Typography>
                )}
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
                  {row.updatedAt && new Date(row.updatedAt).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Stack>

        {/* 右栏: 编辑面板 */}
        <Card sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          {isOpen ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
              <Tabs value={tab} onChange={(_, v) => setTab(v)}>
                <Tab label="提示词" />
                <Tab label="表情预览" />
                <Tab label="工具清单" />
              </Tabs>
              <CardContent sx={{ p: 3, flex: 1, minHeight: 0, overflow: 'auto' }}>
                {tab === 0 && (
                  <Stack spacing={2}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                      <TextField
                        label="agentId" fullWidth size="small"
                        value={draft.agentId}
                        onChange={(e) => setDraft({ ...draft, agentId: e.target.value })}
                        disabled={!!editing}
                        helperText="Hermes agent id, 唯一不可重复"
                      />
                      <TextField
                        label="名称" fullWidth size="small"
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      />
                    </Stack>
                    <TextField
                      label="描述" fullWidth size="small"
                      value={draft.description || ''}
                      onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    />
                    <TextField
                      label="System Prompt (JSON / 纯文本)" multiline fullWidth minRows={12} maxRows={20}
                      value={draft.prompt}
                      onChange={(e) => setDraft({ ...draft, prompt: e.target.value })}
                      sx={{ '& textarea': { fontFamily: 'ui-monospace, monospace', fontSize: 12.5 } }}
                      helperText="支持多行, 写完后点 [保存] — 保存即生效, LLM 会按这里的内容输出 tool_calls"
                    />
                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', flexShrink: 0 }}>
                      <Button onClick={handleClose}>取消</Button>
                      <Button
                        variant="contained"
                        disabled={saveMutation.isPending}
                        onClick={handleSave}
                      >
                        {editing ? '更新' : '创建'}
                      </Button>
                    </Stack>
                  </Stack>
                )}
                {tab === 1 && (
                  <Box sx={{ overflow: 'auto' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      把下面这些情绪写进 prompt 时, 数字人就会用对应表情。这里可以预览长什么样。
                    </Typography>
                    <ExpressionPreview
                      active={previewTemplate}
                      onChange={setPreviewTemplate}
                    />
                  </Box>
                )}
                {tab === 2 && (
                  <ToolCatalog />
                )}
              </CardContent>
            </Box>
          ) : (
            <CardContent sx={{ p: 4, textAlign: 'center' }}>
              <VisibilityRoundedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 2 }} />
              <Typography variant="subtitle1" color="text.disabled" sx={{ mb: 1 }}>
                左侧选一个指令查看 / 编辑, 或点 [新建指令]
              </Typography>
              <Typography variant="caption" color="text.disabled">
                提示: 每次保存会自增 version, LLM 立即生效 (server-side cache 60s TTL)
              </Typography>
            </CardContent>
          )}
        </Card>
      </Box>

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack({ ...snack, open: false })}>
        <Alert severity={snack.severity}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}

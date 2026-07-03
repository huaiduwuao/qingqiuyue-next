'use client';

import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import type { BotItem } from '@/beans/system';

interface BotFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: any) => void;
  record: BotItem | null;
  isSubmitting?: boolean;
}

export default function BotFormDialog({ open, onClose, onSubmit, record, isSubmitting }: BotFormDialogProps) {
  const isEdit = !!record?.id;
  const [values, setValues] = useState<Record<string, any>>({});
  const [templatesRaw, setTemplatesRaw] = useState('');
  const [templatesError, setTemplatesError] = useState('');

  useEffect(() => {
    if (record) {
      setValues({
        name: record.name || '',
        nickname: record.nickname || '',
        avatar: record.avatar || '',
        personaPrompt: record.personaPrompt || '',
        useLlmForComments: !!record.useLlmForComments,
        commentIntervalMinutes: record.commentIntervalMinutes ?? 30,
        chatEnabled: record.chatEnabled ?? true,
        llmModel: record.llmModel || '',
        status: record.status || 'active',
      });
      const arr = record.commentTemplates || [];
      setTemplatesRaw(arr.join('\n'));
    } else {
      setValues({
        name: '',
        nickname: '',
        avatar: '',
        personaPrompt: '',
        useLlmForComments: false,
        commentIntervalMinutes: 30,
        chatEnabled: true,
        llmModel: '',
        status: 'active',
      });
      setTemplatesRaw('');
    }
    setTemplatesError('');
  }, [record, open]);

  const set = (k: string, v: any) => setValues((s) => ({ ...s, [k]: v }));

  const handleSubmit = () => {
    const templates = templatesRaw
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (!values.useLlmForComments && templates.length === 0) {
      setTemplatesError('模板评论至少填一条,或开启 LLM 开关');
      return;
    }
    if (isEdit) {
      setTemplatesError('');
      onSubmit({
        nickname: values.nickname,
        avatar: values.avatar,
        personaPrompt: values.personaPrompt,
        commentTemplates: templates,
        useLlmForComments: values.useLlmForComments,
        commentIntervalMinutes: Number(values.commentIntervalMinutes) || 30,
        chatEnabled: values.chatEnabled,
        llmModel: values.llmModel,
        status: values.status,
      });
    } else {
      if (!values.name || !values.name.trim()) {
        setTemplatesError('账户名不能为空');
        return;
      }
      setTemplatesError('');
      onSubmit({
        name: values.name.trim(),
        nickname: values.nickname,
        avatar: values.avatar,
        personaPrompt: values.personaPrompt,
        commentTemplates: templates,
        useLlmForComments: values.useLlmForComments,
        commentIntervalMinutes: Number(values.commentIntervalMinutes) || 30,
        chatEnabled: values.chatEnabled,
        llmModel: values.llmModel,
      });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{isEdit ? `编辑假人 #${record?.id}` : '新建假人'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label="账户名(name)"
            value={values.name || ''}
            onChange={(e) => set('name', e.target.value)}
            disabled={isEdit}
            helperText={isEdit ? '账户名不可修改' : '登录用,服务端生成 32 字符密码,不会登录'}
            fullWidth
          />
          <TextField
            label="昵称"
            value={values.nickname || ''}
            onChange={(e) => set('nickname', e.target.value)}
            fullWidth
          />
          <TextField
            label="头像 URL"
            value={values.avatar || ''}
            onChange={(e) => set('avatar', e.target.value)}
            fullWidth
          />
          <TextField
            label="Persona Prompt(LLM 用)"
            value={values.personaPrompt || ''}
            onChange={(e) => set('personaPrompt', e.target.value)}
            fullWidth
            multiline
            rows={4}
            placeholder="例:你是一个温柔善良的女孩,喜欢读书,回复简短口语化"
          />
          <TextField
            label="评论模板(每行一条,可用 {title} 占位)"
            value={templatesRaw}
            onChange={(e) => {
              setTemplatesRaw(e.target.value);
              if (templatesError) setTemplatesError('');
            }}
            fullWidth
            multiline
            rows={8}
            placeholder={'好看!\n想看更多~\n已收藏'}
            error={!!templatesError}
            helperText={templatesError || '每行一条模板。{title} 会被替换为内容标题'}
          />
          <FormControlLabel
            control={
              <Switch
                checked={!!values.useLlmForComments}
                onChange={(e) => set('useLlmForComments', e.target.checked)}
              />
            }
            label="使用 LLM 生成评论"
          />
          <TextField
            label="评论间隔(分钟)"
            type="number"
            value={values.commentIntervalMinutes ?? 30}
            onChange={(e) => set('commentIntervalMinutes', Number(e.target.value))}
            fullWidth
            slotProps={{ htmlInput: { min: 1 } }}
            helperText="自动评论之间的最小间隔分钟数,默认 30"
          />
          <FormControlLabel
            control={
              <Switch
                checked={!!values.chatEnabled}
                onChange={(e) => set('chatEnabled', e.target.checked)}
              />
            }
            label="允许聊天回复(DM 自动 LLM 答复)"
          />
          <TextField
            label="LLM Model(可选)"
            value={values.llmModel || ''}
            onChange={(e) => set('llmModel', e.target.value)}
            fullWidth
            placeholder="留空用默认值 gpt-4o-mini"
          />
          {isEdit && (
            <TextField
              select
              label="状态"
              value={values.status || 'active'}
              onChange={(e) => set('status', e.target.value)}
              fullWidth
            >
              <MenuItem value="active">active</MenuItem>
              <MenuItem value="paused">paused</MenuItem>
              <MenuItem value="banned">banned</MenuItem>
            </TextField>
          )}
          {!isEdit && (
            <Typography variant="caption" color="text.secondary">
              新建后状态默认为 active。
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={isSubmitting}>
          {isEdit ? '保存' : '创建'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
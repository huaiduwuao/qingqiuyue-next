'use client';

import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { alpha } from '@mui/material/styles';
import { createTask, updateTask } from '@/apis/reward-task';
import { myPage as listMyDemands } from '@/apis/reward-demand';
import type { RewardTask, TaskPriority, DemandItem } from '@/beans/reward';
import { normalizeRewardTaskStatus } from './status';

interface Props {
  open: boolean;
  record: RewardTask | null;
  /** 从需求进入看板时预选该需求 */
  defaultDemandId?: number | null;
  onClose: () => void;
  onSaved: (task: RewardTask) => void;
  onError: (msg: string) => void;
}

/**
 * 新建 / 编辑任务。挂到需求下的任务由需求发布者拆分,可以标价,赏金从需求托管中支付;
 * 不挂需求的是团队内部的独立任务,没有赏金。任务被认领后不能再改所属需求和标价。
 */
export function TaskEditDialog({ open, record, defaultDemandId, onClose, onSaved, onError }: Props) {
  // 后端成功 code 为 0（client.ts 拦截器兼容 0/200），业务层判定需同时认 0 与 200
  const isOk = (res: any) => res?.code === 200 || res?.code === 0 || res?.code === '200' || res?.code === '0';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('P1');
  const [deadline, setDeadline] = useState('');
  const [demandId, setDemandId] = useState<number | ''>('');
  const [reward, setReward] = useState('');
  const [demands, setDemands] = useState<DemandItem[]>([]);
  const [saving, setSaving] = useState(false);
  const locked = !!record?.id && normalizeRewardTaskStatus(record.status) !== 'OPEN';

  useEffect(() => {
    if (!open) return;
    setTitle(record?.title || '');
    setDescription(record?.description || '');
    setPriority((record?.priority as TaskPriority) || 'P1');
    setDeadline(record?.deadline ? record.deadline.slice(0, 10) : '');
    setDemandId(record?.demandId || defaultDemandId || '');
    setReward(record?.reward ? String(record.reward) : '');
    // 只能把任务挂到自己发布、仍在进行中的需求下(myPage 只返回当前用户发布的需求)
    let alive = true;
    listMyDemands({ pageSize: 100 })
      .then((res: any) => {
        if (!alive) return;
        const records: DemandItem[] = res?.data?.records || res?.data?.list || [];
        setDemands(records.filter((d) => d.status === 'PENDING' || d.status === 'PUBLISHED' || d.id === record?.demandId));
      })
      .catch(() => alive && setDemands([]));
    return () => {
      alive = false;
    };
  }, [open, record, defaultDemandId]);

  const selectedDemand = demands.find((d) => d.id === demandId);

  const handleSave = async () => {
    if (!title.trim()) {
      onError('请填写任务标题');
      return;
    }
    const rewardNum = reward.trim() === '' ? 0 : Number(reward);
    if (!Number.isInteger(rewardNum) || rewardNum < 0) {
      onError('标价请填写不小于 0 的整数(元)');
      return;
    }
    setSaving(true);
    try {
      const data = {
        title: title.trim(),
        description: description.trim(),
        priority,
        deadline: deadline ? new Date(`${deadline}T23:59:59`).toISOString() : null,
        demandId: demandId ? Number(demandId) : 0,
        reward: demandId ? rewardNum : 0,
      } as Partial<RewardTask>;
      const res: any = record?.id ? await updateTask(record.id, data) : await createTask(data);
      if (isOk(res)) onSaved(res.data);
      else onError(res?.msg || '保存失败');
    } catch (e: any) {
      onError(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary' }}>
        {record?.id ? '编辑任务' : '新建任务'}
      </DialogTitle>
      <DialogContent dividers sx={{ borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField label="任务标题" value={title} onChange={(e) => setTitle(e.target.value)} required fullWidth size="small" />
          <TextField
            label="任务描述"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            minRows={3}
            size="small"
            placeholder="要交付什么、验收标准是什么"
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>优先级</Typography>
              <ToggleButtonGroup
                value={priority}
                exclusive
                size="small"
                onChange={(_, v) => v && setPriority(v)}
                sx={{
                  '& .MuiToggleButton-root': {
                    flex: 1,
                    fontSize: 12,
                    border: '1px solid',
                    borderColor: 'divider',
                    color: 'text.secondary',
                    '&.Mui-selected': {
                      bgcolor: (theme) =>
                        priority === 'P0'
                          ? alpha(theme.palette.primary.main, 0.18)
                          : priority === 'P1'
                            ? alpha(theme.palette.warning.main, 0.18)
                            : alpha(theme.palette.text.secondary, 0.18),
                      color: priority === 'P0' ? 'primary.main' : priority === 'P1' ? 'warning.main' : 'text.tertiary',
                    },
                  },
                }}
              >
                <ToggleButton value="P0">P0</ToggleButton>
                <ToggleButton value="P1">P1</ToggleButton>
                <ToggleButton value="P2">P2</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <TextField
              label="截止日期"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              size="small"
              sx={{ flex: 1 }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>
          <FormControl size="small" fullWidth disabled={locked}>
            <InputLabel>所属需求</InputLabel>
            <Select value={demandId} label="所属需求" onChange={(e) => setDemandId(e.target.value as number | '')}>
              <MenuItem value="">不挂需求(团队内部任务,无赏金)</MenuItem>
              {demands.map((d) => (
                <MenuItem key={d.id} value={d.id}>
                  #{d.id} {d.title} · 赏金 ¥{d.pay || 0}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="任务标价(元,可选)"
            type="number"
            value={reward}
            onChange={(e) => setReward(e.target.value)}
            size="small"
            fullWidth
            disabled={!demandId || locked}
            helperText={
              !demandId
                ? '挂到需求下才能标价,赏金从需求托管中支付'
                : `不填则与其他未标价任务均分剩余赏金;所有任务标价合计不能超过 ¥${selectedDemand?.pay ?? 0}`
            }
            slotProps={{ htmlInput: { min: 0, step: 1 } }}
          />
          {locked && (
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>任务已被认领,所属需求与标价不能再修改。</Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ borderTop: '1px solid', borderColor: 'divider', px: 2, py: 1.5 }}>
        <Button onClick={onClose} size="small">取消</Button>
        <Button onClick={handleSave} variant="contained" size="small" disabled={saving}>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}

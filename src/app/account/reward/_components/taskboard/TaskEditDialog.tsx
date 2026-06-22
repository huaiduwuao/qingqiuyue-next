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
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { alpha } from '@mui/material/styles';
import { createTask, updateTask } from '@/apis/reward-task';
import { myPage as listDemandsApi } from '@/apis/reward-demand';
import type { RewardTask, TaskPriority, DemandItem } from '@/beans/reward';

interface Props {
  open: boolean;
  record: RewardTask | null;
  projectId: number;
  groupId?: number | null;
  groups?: Array<{ id: number; name: string }>;
  onClose: () => void;
  onSaved: (task: RewardTask) => void;
  onError: (msg: string) => void;
}

export function TaskEditDialog({ open, record, projectId, groupId, groups = [], onClose, onSaved, onError }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('P1');
  const [deadline, setDeadline] = useState('');
  const [demandId, setDemandId] = useState<number | ''>('');
  const [groupIds, setGroupIds] = useState<number[]>([]);
  const [demands, setDemands] = useState<DemandItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(record?.title || '');
      setDescription(record?.description || '');
      setPriority((record?.priority as TaskPriority) || 'P1');
      setDeadline(record?.deadline ? record.deadline.slice(0, 10) : '');
      setDemandId(record?.demandId ?? '');
      // 团队:record.groupIds 优先,否则从 record.groupId / 入参 groupId 兜底
      const initialGroups = Array.isArray(record?.groupIds) && record!.groupIds!.length > 0
        ? record!.groupIds!
        : (record?.groupId != null ? [record.groupId] : (groupId != null ? [groupId] : []));
      setGroupIds(initialGroups);
      // 自拉需求列表
      (async () => {
        try {
          const res: any = await listDemandsApi({ groupId: groupId ?? undefined, pageSize: 100 });
          const records = res?.data?.records || res?.data?.list || [];
          // 过滤掉已结账的(SETTLED 后不可添加新任务)
          setDemands(records.filter((d: DemandItem) => d.status !== 'SETTLED' && d.status !== 'CLOSED'));
        } catch (e) {
          console.error('Failed to load demands', e);
          setDemands([]);
        }
      })();
    }
  }, [open, record, groupId]);

  const handleSave = async () => {
    if (!title.trim()) {
      onError('请填写任务标题');
      return;
    }
    if (groupIds.length === 0) {
      onError('请至少选择一个所属团队');
      return;
    }
    setSaving(true);
    try {
      const data: any = {
        projectId,
        groupId: groupIds[0],
        groupIds,
        title: title.trim(),
        description: description.trim(),
        priority,
        deadline: deadline ? new Date(deadline).toISOString() : null,
      };
      if (demandId) data.demandId = Number(demandId);
      const res: any = record?.id
        ? await updateTask(record.id, data)
        : await createTask(data);
      if (res?.code === 200) onSaved(res.data);
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
          <TextField
            label="任务标题"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            fullWidth
            size="small"
          />
          <TextField
            label="任务描述"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            minRows={3}
            size="small"
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
                      bgcolor: (theme) => priority === 'P0'
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
          <FormControl size="small" fullWidth>
            <InputLabel>所属团队(可多选)</InputLabel>
            <Select
              multiple
              value={groupIds}
              label="所属团队(可多选)"
              onChange={(e) => setGroupIds(typeof e.target.value === 'string' ? [Number(e.target.value)] : (e.target.value as number[]))}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(selected as number[]).map((id) => {
                    const g = groups.find((x) => x.id === id);
                    return (
                      <Chip
                        key={id}
                        label={g?.name || `团队 ${id}`}
                        size="small"
                        sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(6,182,212,0.18)', color: '#06B6D4' }}
                      />
                    );
                  })}
                </Box>
              )}
            >
              {groups.map((g) => (
                <MenuItem key={g.id} value={g.id}>{g.name || `团队 ${g.id}`}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>所属需求(可选)</InputLabel>
            <Select
              value={demandId}
              label="所属需求(可选)"
              onChange={(e) => setDemandId(e.target.value as number | '')}
            >
              <MenuItem value="">不关联</MenuItem>
              {demands.map((d) => (
                <MenuItem key={d.id} value={d.id}>
                  #{d.id} {d.title} · ¥{d.pay || 0}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions sx={{ borderTop: '1px solid #252836', px: 2, py: 1.5 }}>
        <Button onClick={onClose} size="small">取消</Button>
        <Button onClick={handleSave} variant="contained" size="small" disabled={saving}>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}

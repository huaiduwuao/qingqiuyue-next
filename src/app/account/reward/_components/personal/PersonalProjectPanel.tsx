'use client';

/**
 * 个人工作台 - 我的项目面板(右栏)
 *
 * 显示我作为 owner 的项目(不传 groupId -> 后端按当前用户过滤);
 * 紧凑列表形态,最多 5 条 + 状态 chip。
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import FolderIcon from '@mui/icons-material/Folder';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { alpha } from '@mui/material/styles';
import { listProjects } from '@/apis/reward-project';
import type { ProjectItem } from '@/beans/reward';
import type { GroupInfo } from '@/apis/reward-group';

interface Props {
  groups: GroupInfo[];
  currentUserId: number;
  onOpenTab?: (groupId: number) => void;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:   { label: '草稿',   color: 'text.secondary', bg: 'rgba(139, 143, 163, 0.12)' },
  WAITING: { label: '待审核', color: 'warning.main',   bg: 'rgba(255, 180, 0, 0.12)' },
  SUCCESS: { label: '进行中', color: '#8B5CF6',        bg: 'rgba(139, 92, 246, 0.12)' },
  CLOSED:  { label: '已结束', color: 'text.disabled',  bg: 'rgba(90, 94, 114, 0.12)' },
};

function statusMeta(s?: string) {
  return STATUS_META[s || ''] || STATUS_META.DRAFT;
}
export default function PersonalProjectPanel({ groups, currentUserId, onOpenTab }: Props) {
  const query = useQuery({
    queryKey: ['personal', 'projects', 'mine', currentUserId],
    queryFn: () =>
      listProjects({ pageSize: 100 } as any).then((r: any) => {
        const records = r?.data?.records || r?.data?.list || [];
        return records as ProjectItem[];
      }),
    enabled: !!currentUserId,
    placeholderData: [],
  });

  const records = query.data || [];
  const top = records.slice(0, 5);
  return (
    <Box
      sx={{
        borderRadius: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        p: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <FolderIcon sx={{ fontSize: 16, color: '#8B5CF6', mr: 1 }} />
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', flex: 1 }}>
          我的项目
        </Typography>
        {onOpenTab && records.length > 0 && groups[0] && (
          <Button
            size="small"
            endIcon={<ArrowForwardIosIcon sx={{ fontSize: 10 }} />}
            onClick={() => onOpenTab(groups[0].id)}
            sx={{ minWidth: 0, color: 'text.secondary', fontSize: 11, textTransform: 'none' }}
          >
            管理
          </Button>
        )}
      </Box>
      {query.isLoading ? (
        <Typography sx={{ fontSize: 11, color: 'text.disabled', py: 4, textAlign: 'center' }}>
          加载中…
        </Typography>
      ) : top.length === 0 ? (
        <Typography sx={{ fontSize: 11, color: 'text.disabled', py: 4, textAlign: 'center' }}>
          还没有创建过项目
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {top.map((p) => {
            const meta = statusMeta(p.status);
            return (
              <Box
                key={p.id}
                sx={{
                  p: 1.25,
                  borderRadius: 1.25,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: alpha('#8B5CF6', 0.06),
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  minWidth: 0,
                }}
              >
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary', flex: 1, minWidth: 0 }} noWrap>
                  {p.name || '(无名称)'}
                </Typography>
                <Chip
                  label={meta.label}
                  size="small"
                  sx={{ height: 18, fontSize: 10, bgcolor: meta.bg, color: meta.color, fontWeight: 600 }}
                />
              </Box>
            );
          })}
          {records.length > 5 && (
            <Typography sx={{ fontSize: 10, color: 'text.disabled', textAlign: 'center', mt: 0.5 }}>
              还有 {records.length - 5} 个项目,点击右上角「管理」查看全部
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
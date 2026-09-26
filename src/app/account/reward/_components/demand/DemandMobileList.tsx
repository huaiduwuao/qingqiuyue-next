'use client';

/**
 * 手机版「我的需求」:没有「需求管理」标题卡和布局切换;状态 tab 收成一行横滑胶囊,
 * 需求是单列行(缩略图 + 标题 + 状态/赏金/任务进度/截止),行尾「⋯」放编辑 / 看任务 / 结账;
 * 点行打开和电脑版同一个详情弹窗;「新建需求」在右下角 Fab。弹窗仍由 page.tsx 挂。
 */

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import EditIcon from '@mui/icons-material/Edit';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { MobileSection } from '@/components/mobile/MobileSection';
import { coverBackgroundImage } from '@/lib/media';
import type { DemandItem, DemandStatus } from '@/beans/reward';
import { ListFooter, MobileChipRow, MobileEmpty, MobileFab, MobileSkeletonRows, StatusTag } from '../personal/mobileKit';

interface Props {
  statusOptions: Array<{ value: DemandStatus | ''; label: string }>;
  statusMeta: Record<DemandStatus, { label: string; color: string; bg: string }>;
  tab: DemandStatus | '';
  onTab: (v: DemandStatus | '') => void;
  records: DemandItem[];
  loading: boolean;
  fetchingNext: boolean;
  hasNext: boolean;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  onCreate: () => void;
  onDetail: (d: DemandItem) => void;
  onEdit: (d: DemandItem) => void;
  onSettle: (d: DemandItem) => void;
  onOpenTaskboard?: (demandId: number) => void;
}

export default function DemandMobileList({
  statusOptions,
  statusMeta,
  tab,
  onTab,
  records,
  loading,
  fetchingNext,
  hasNext,
  sentinelRef,
  onCreate,
  onDetail,
  onEdit,
  onSettle,
  onOpenTaskboard,
}: Props) {
  const [menu, setMenu] = useState<{ el: HTMLElement; item: DemandItem } | null>(null);
  const close = () => setMenu(null);
  const item = menu?.item;
  const hasTasks = (item?.taskIds?.length || 0) > 0;
  const canBoard = !!item && !!onOpenTaskboard && (hasTasks || item.status === 'PENDING' || item.status === 'PUBLISHED');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, pb: 8 }}>
      <MobileChipRow items={statusOptions} value={tab} onChange={onTab} sticky />

      <MobileSection flush>
        {loading ? (
          <MobileSkeletonRows count={5} height={60} />
        ) : records.length === 0 ? (
          <MobileEmpty>{tab ? '该状态下暂无需求' : '暂无需求,点右下角发布第一个'}</MobileEmpty>
        ) : (
          records.map((d, i) => {
            const meta = statusMeta[(d.status as DemandStatus) || 'PENDING'] || statusMeta.PENDING;
            const total = d.totalTaskCount ?? 0;
            return (
              <Box
                key={d.id}
                onClick={() => onDetail(d)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  pl: 1.75,
                  pr: 0.75,
                  py: 1.25,
                  cursor: 'pointer',
                  borderTop: i > 0 ? '1px solid' : 0,
                  borderColor: 'divider',
                  WebkitTapHighlightColor: 'transparent',
                  '&:active': { bgcolor: 'action.hover' },
                }}
              >
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 2,
                    flexShrink: 0,
                    bgcolor: 'action.hover',
                    backgroundImage: coverBackgroundImage(d.cover),
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    fontWeight: 700,
                    color: 'text.disabled',
                  }}
                >
                  {!d.cover && (d.title?.charAt(0) || '?')}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: 14, fontWeight: 600, minWidth: 0 }}>
                      {d.title || '(无标题)'}
                    </Typography>
                    <StatusTag label={meta.label} color={meta.color} bg={meta.bg} />
                  </Box>
                  <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 1.25, fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                    <Box component="span" sx={{ fontSize: 14, fontWeight: 700, color: 'primary.main' }}>
                      ¥{d.pay || 0}
                    </Box>
                    {total > 0 && (
                      <span>
                        任务 {d.completedCount || 0}/{total}
                      </span>
                    )}
                    {d.endTime && <span>截止 {new Date(d.endTime).toLocaleDateString()}</span>}
                  </Box>
                </Box>
                <IconButton
                  size="small"
                  aria-label="更多操作"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenu({ el: e.currentTarget, item: d });
                  }}
                  sx={{ color: 'text.secondary', flexShrink: 0 }}
                >
                  <MoreHorizRoundedIcon />
                </IconButton>
              </Box>
            );
          })
        )}
        <Box ref={sentinelRef} sx={{ height: '1px' }} />
        <ListFooter loading={fetchingNext} done={!hasNext && records.length > 0} />
      </MobileSection>

      {/* 行尾「⋯」:电脑版卡片底部的那排按钮 */}
      <Menu anchorEl={menu?.el} open={!!menu} onClose={close}>
        {item && item.status !== 'SETTLED' && item.status !== 'COMPLETED' && (
          <MenuItem
            onClick={() => {
              close();
              onEdit(item);
            }}
          >
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            编辑
          </MenuItem>
        )}
        {item && canBoard && (
          <MenuItem
            onClick={() => {
              close();
              onOpenTaskboard!(item.id as number);
            }}
          >
            <ListItemIcon>
              <ViewKanbanIcon fontSize="small" />
            </ListItemIcon>
            {hasTasks ? '查看任务' : '拆分任务'}
          </MenuItem>
        )}
        {item && item.status === 'COMPLETED' && (
          <MenuItem
            onClick={() => {
              close();
              onSettle(item);
            }}
          >
            <ListItemIcon>
              <CheckCircleIcon fontSize="small" sx={{ color: 'success.main' }} />
            </ListItemIcon>
            结账
          </MenuItem>
        )}
        {item && item.status === 'SETTLED' && (
          <MenuItem
            onClick={() => {
              close();
              onSettle(item);
            }}
          >
            <ListItemIcon>
              <ReceiptLongIcon fontSize="small" sx={{ color: 'success.main' }} />
            </ListItemIcon>
            结算单
          </MenuItem>
        )}
      </Menu>

      <MobileFab label="新建需求" onClick={onCreate} />
    </Box>
  );
}

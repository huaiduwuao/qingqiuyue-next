'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Fab from '@mui/material/Fab';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded';
import { coverBackground } from '@/lib/media';
import { MobileSection, MobileListRow } from '@/components/mobile/MobileSection';
import MobileFilterBar, { MOBILE_FAB_SX } from '../works/MobileFilterBar';
import type { Collection } from './page';

/**
 * 手机上的合集。电脑版是 标题卡(含「创建合集」)+ 三格概览 + 页签/搜索/布局切换 + 卡片网格。
 * 这里:一行吸顶筛选(全部/公开/私密 + 搜索),概览数字并进下面的计数行 → 单列合集行
 * (点行编辑,行尾 ⋮ 是和电脑版同一个 编辑/分享/删除 菜单)→ 右下角「创建合集」。
 */
export default function CollectionMobile({
  tab,
  onTab,
  counts,
  totalWorks,
  keyword,
  onKeyword,
  list,
  hasAny,
  loading,
  error,
  onRetry,
  onCreate,
  onEdit,
  onMore,
  children,
}: {
  tab: number;
  onTab: (t: 0 | 1 | 2) => void;
  counts: { all: number; pub: number; priv: number };
  totalWorks: number;
  keyword: string;
  onKeyword: (v: string) => void;
  list: Collection[];
  hasAny: boolean;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onCreate: () => void;
  onEdit: (c: Collection) => void;
  onMore: (c: Collection, el: HTMLElement) => void;
  /** 更多菜单 / 创建对话框 / 编辑抽屉 / 分享对话框 / 提示,与电脑版共用 */
  children?: React.ReactNode;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, pb: 8 }}>
      <MobileFilterBar
        first
        chips={[
          { id: '0', label: '全部', count: counts.all },
          { id: '1', label: '公开', count: counts.pub },
          { id: '2', label: '私密', count: counts.priv },
        ]}
        value={String(tab)}
        onChange={(id) => onTab(Number(id) as 0 | 1 | 2)}
        search={{ value: keyword, onChange: onKeyword, placeholder: '搜索合集标题' }}
        footer={
          <Box component="span">
            共 {counts.all} 个合集 · 收录 {totalWorks >= 10000 ? `${(totalWorks / 10000).toFixed(1)}w` : totalWorks} 个作品
          </Box>
        }
      />

      <MobileSection flush>
        {loading ? (
          <Box sx={{ p: 1.75, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={54} />
            ))}
          </Box>
        ) : error ? (
          <Box sx={{ py: 5, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>合集加载失败</Typography>
            <Button variant="text" size="small" onClick={onRetry} sx={{ mt: 0.5 }}>
              重试
            </Button>
          </Box>
        ) : list.length === 0 ? (
          <Box sx={{ py: 5, textAlign: 'center' }}>
            <CollectionsRoundedIcon sx={{ fontSize: 36, color: 'text.disabled' }} />
            <Typography sx={{ fontSize: 13, color: 'text.disabled', mt: 0.5 }}>
              {hasAny ? '没有符合条件的合集' : '把同主题的作品编排成系列,方便粉丝连看'}
            </Typography>
          </Box>
        ) : (
          list.map((c, i) => (
            <MobileListRow
              key={String(c.id)}
              divider={i > 0}
              onClick={() => onEdit(c)}
              leading={
                <Box
                  sx={{
                    width: 96,
                    height: 54,
                    flexShrink: 0,
                    borderRadius: 1.5,
                    background: coverBackground(c.cover || c.covers[0] || '', 'linear-gradient(135deg, #2A2D3A 0%, #1A1C26 100%)'),
                  }}
                />
              }
              title={c.title}
              subtitle={
                <>
                  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, verticalAlign: 'middle' }}>
                    {c.isPublic ? <PublicRoundedIcon sx={{ fontSize: 12 }} /> : <LockOutlinedIcon sx={{ fontSize: 12 }} />}
                    {c.isPublic ? '公开' : '私密'}
                  </Box>
                  {` · ${c.itemCount} 个作品`}
                  {c.price > 0 ? ` · 💎${c.price}` : ''}
                  {c.updateTime ? ` · ${c.updateTime.slice(5, 10)}` : ''}
                </>
              }
              trailing={
                <IconButton
                  size="small"
                  aria-label="更多"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMore(c, e.currentTarget);
                  }}
                  sx={{ mr: -0.75, color: 'text.secondary', flexShrink: 0 }}
                >
                  <MoreVertRoundedIcon sx={{ fontSize: 20 }} />
                </IconButton>
              }
            />
          ))
        )}
      </MobileSection>

      <Fab variant="extended" color="primary" onClick={onCreate} sx={MOBILE_FAB_SX}>
        <AddRoundedIcon sx={{ mr: 0.5 }} />
        创建合集
      </Fab>

      {children}
    </Box>
  );
}

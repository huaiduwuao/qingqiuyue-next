'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListSubheader from '@mui/material/ListSubheader';
import Divider from '@mui/material/Divider';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { coverBackground } from '@/lib/media';
import { MobileSection, MobileStatRow, MobileListRow } from '@/components/mobile/MobileSection';
import MobileFilterBar from '../works/MobileFilterBar';
import { CATEGORY_META, STATUS_META, formatBigNumber, type Activity, type ActivityCategory } from './data';
import { getPrimaryAction } from './actionBuilders';
import { getCountdownLabel } from './helpers';

/**
 * 手机上的活动与话题。电脑版是 标题卡(含 4 格 KPI)+ 7 个页签 + 搜索框 + 两个下拉 + 布局切换,
 * 手机上内容出现前就占了一屏多。这里:四个数一行 → 一行吸顶筛选(状态胶囊横滑 + 搜索 + 类型/排序菜单
 * + 活动订阅铃铛)→ 单列活动行,行尾直接「报名 / 投稿」,点行打开同一个详情抽屉(复制链接在抽屉里)。
 */
export default function ActivityMobile({
  stats,
  tabs,
  tab,
  onTab,
  categoryValue,
  onCategory,
  sorts,
  sort,
  onSort,
  search,
  onSearch,
  list,
  onOpen,
  onSignup,
  onSubmit,
  onSubscribe,
  children,
}: {
  stats: { active: number; mySigned: number; monthlyReward: number; totalWon: number };
  tabs: { id: string; label: string; count: number }[];
  tab: string;
  onTab: (id: string) => void;
  categoryValue: string;
  onCategory: (id: string) => void;
  sorts: { id: string; label: string }[];
  sort: string;
  onSort: (id: string) => void;
  search: string;
  onSearch: (v: string) => void;
  list: Activity[];
  onOpen: (id: string) => void;
  onSignup: (id: string) => void;
  onSubmit: (id: string) => void;
  onSubscribe: () => void;
  /** 详情抽屉 / 报名 / 投稿对话框 / Snackbar,与电脑版共用 */
  children?: React.ReactNode;
}) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const sortLabel = sorts.find((s) => s.id === sort)?.label;
  const catLabel = categoryValue !== 'all' ? CATEGORY_META[categoryValue as ActivityCategory]?.label : '';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <MobileSection>
        <Box sx={{ pt: 1.75 }}>
          <MobileStatRow
            items={[
              { label: '进行中', value: stats.active, onClick: () => onTab('active') },
              { label: '我已参与', value: stats.mySigned, onClick: () => onTab('mine') },
              { label: '本月奖励', value: `¥${formatBigNumber(stats.monthlyReward)}` },
              { label: '累计获奖', value: `¥${formatBigNumber(stats.totalWon)}`, onClick: () => onTab('won') },
            ]}
          />
        </Box>
      </MobileSection>

      <MobileFilterBar
        chips={tabs.map((t) => ({ id: t.id, label: t.id === 'all' ? '全部' : t.label, count: t.count }))}
        value={tab}
        onChange={onTab}
        search={{ value: search, onChange: onSearch, placeholder: '搜索活动名称 / 主办方' }}
        actions={
          <>
            <IconButton
              size="small"
              aria-label="类型与排序"
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              sx={{ color: categoryValue !== 'all' ? 'primary.main' : 'text.secondary' }}
            >
              <TuneRoundedIcon sx={{ fontSize: 20 }} />
            </IconButton>
            <IconButton size="small" aria-label="活动订阅" onClick={onSubscribe} sx={{ color: 'text.secondary' }}>
              <NotificationsActiveRoundedIcon sx={{ fontSize: 20 }} />
            </IconButton>
            <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
              <ListSubheader sx={{ fontSize: 12, lineHeight: '32px' }}>类型</ListSubheader>
              {[{ id: 'all', label: '全部类型', color: '' }, ...(Object.keys(CATEGORY_META) as ActivityCategory[]).map((c) => ({ id: c, label: CATEGORY_META[c].label, color: CATEGORY_META[c].color }))].map((c) => (
                <MenuItem
                  key={c.id}
                  selected={c.id === categoryValue}
                  onClick={() => {
                    onCategory(c.id);
                    setMenuAnchor(null);
                  }}
                  sx={{ fontSize: 14, gap: 1 }}
                >
                  {c.color && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c.color }} />}
                  {c.label}
                </MenuItem>
              ))}
              <Divider />
              <ListSubheader sx={{ fontSize: 12, lineHeight: '32px' }}>排序</ListSubheader>
              {sorts.map((s) => (
                <MenuItem
                  key={s.id}
                  selected={s.id === sort}
                  onClick={() => {
                    onSort(s.id);
                    setMenuAnchor(null);
                  }}
                  sx={{ fontSize: 14 }}
                >
                  {s.label}
                </MenuItem>
              ))}
            </Menu>
          </>
        }
        footer={
          <>
            <Box component="span" sx={{ flex: 1 }}>
              共 {list.length} 个活动{catLabel ? ` · ${catLabel}` : ''}
            </Box>
            <Box component="span">{sortLabel}</Box>
          </>
        }
      />

      <MobileSection flush>
        {list.length === 0 ? (
          <Box sx={{ py: 5, textAlign: 'center' }}>
            <EmojiEventsRoundedIcon sx={{ fontSize: 36, color: 'text.disabled' }} />
            <Typography sx={{ fontSize: 13, color: 'text.disabled', mt: 0.5 }}>没有符合条件的活动</Typography>
          </Box>
        ) : (
          list.map((a, i) => {
            const st = STATUS_META[a.status];
            const cd = getCountdownLabel(a);
            const pa = getPrimaryAction(a);
            const act = pa.kind === 'signup' ? '报名' : pa.kind === 'submit' ? (a.submissions.length ? '续投' : '投稿') : null;
            return (
              <MobileListRow
                key={a.id}
                divider={i > 0}
                onClick={() => onOpen(a.id)}
                leading={
                  <Box
                    sx={{
                      position: 'relative',
                      width: 64,
                      height: 48,
                      flexShrink: 0,
                      borderRadius: 1.5,
                      overflow: 'hidden',
                      background: coverBackground(a.cover, a.gradient || 'linear-gradient(135deg, #FE2C55 0%, #FFB400 100%)'),
                    }}
                  >
                    {a.participation === 'won' && (
                      <EmojiEventsRoundedIcon sx={{ position: 'absolute', top: 2, right: 2, fontSize: 14, color: '#FFD700' }} />
                    )}
                  </Box>
                }
                title={a.title}
                subtitle={
                  <>
                    <Box component="span" sx={{ color: st?.color }}>{st?.label}</Box>
                    {' · '}
                    <Box component="span" sx={{ color: cd.color }}>{cd.text}</Box>
                    {a.totalReward ? ` · ${a.totalReward}` : ''}
                  </>
                }
                trailing={
                  act ? (
                    <Button
                      size="small"
                      variant="contained"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (pa.kind === 'signup') onSignup(a.id);
                        else onSubmit(a.id);
                      }}
                      sx={{ minWidth: 0, px: 1.5, py: 0.25, borderRadius: 999, fontSize: 12, flexShrink: 0, boxShadow: 'none' }}
                    >
                      {act}
                    </Button>
                  ) : (
                    <ChevronRightRoundedIcon sx={{ fontSize: 20, color: 'text.disabled' }} />
                  )
                }
              />
            );
          })
        )}
      </MobileSection>

      {children}
    </Box>
  );
}

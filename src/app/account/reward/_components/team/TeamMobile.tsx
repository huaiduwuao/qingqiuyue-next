'use client';

/**
 * 手机版团队页:邀请(行尾 接受 / 拒绝)→ 我的团队(单列行)→ 团队广场(标题右侧放大镜展开搜索,行尾「申请」)
 * → 右下角「创建团队」。团队主页、创建弹窗和提示条仍由 page.tsx 挂(两端共用)。
 */

import React, { useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { MobileListRow, MobileSection } from '@/components/mobile/MobileSection';
import { yuan, type MyTeam, type Team } from '@/apis/team';
import { MobileEmpty, MobileFab, MobileSkeletonRows, StatusTag } from '../personal/mobileKit';

const ROLE_LABEL: Record<string, string> = { owner: '队长', admin: '管理员', member: '成员' };

interface Props {
  me: number;
  invites: MyTeam[];
  joined: MyTeam[];
  square: Team[];
  squareLoading: boolean;
  myIds: Set<number>;
  search: string;
  keyword: string;
  onKeyword: (v: string) => void;
  onOpen: (id: number) => void;
  onCreate: () => void;
  onAccept: (t: MyTeam) => void;
  onReject: (t: MyTeam) => void;
  onApply: (t: Team) => void;
}

function TeamAvatar({ src }: { src?: string | null }) {
  return (
    <Avatar src={src || undefined} variant="rounded" sx={{ width: 40, height: 40 }}>
      <GroupsRoundedIcon fontSize="small" />
    </Avatar>
  );
}

const stats = (t: Team) => `${t.memberCount} 人 · 交付 ${t.realizedCount} · ¥${yuan(t.earnedCents)}`;

export default function TeamMobile({
  me,
  invites,
  joined,
  square,
  squareLoading,
  myIds,
  search,
  keyword,
  onKeyword,
  onOpen,
  onCreate,
  onAccept,
  onReject,
  onApply,
}: Props) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, pb: 8 }}>
      {invites.length > 0 && (
        <MobileSection title="收到的邀请" extra={`${invites.length} 个`} flush>
          {invites.map((t, i) => (
            <MobileListRow
              key={t.id}
              divider={i > 0}
              onClick={() => onOpen(t.id)}
              leading={<TeamAvatar src={t.avatar} />}
              title={t.name}
              subtitle="邀请你加入"
              trailing={
                <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                  <Button size="small" variant="text" onClick={() => onAccept(t)} sx={{ minWidth: 0, fontWeight: 700 }}>
                    接受
                  </Button>
                  <Button size="small" variant="text" color="inherit" onClick={() => onReject(t)} sx={{ minWidth: 0, color: 'text.secondary' }}>
                    拒绝
                  </Button>
                </Box>
              }
            />
          ))}
        </MobileSection>
      )}

      <MobileSection title="我的团队" extra={joined.length > 0 ? `${joined.length} 支` : undefined} flush>
        {joined.length === 0 ? (
          <MobileEmpty>{me ? '还没有加入团队,创建一个或在团队广场申请加入' : '登录后查看我的团队'}</MobileEmpty>
        ) : (
          joined.map((t, i) => (
            <MobileListRow
              key={t.id}
              divider={i > 0}
              onClick={() => onOpen(t.id)}
              leading={<TeamAvatar src={t.avatar} />}
              title={t.name}
              subtitle={t.myStatus === 'active' ? `份额 ${t.myShare} · ${stats(t)}` : stats(t)}
              trailing={
                <StatusTag
                  label={t.myStatus === 'applied' ? '申请中' : ROLE_LABEL[t.myRole] || '成员'}
                  color={t.myStatus === 'applied' ? 'warning.main' : t.myRole === 'owner' ? 'primary.main' : 'text.secondary'}
                />
              }
            />
          ))
        )}
      </MobileSection>

      <MobileSection
        title="团队广场"
        extra={
          <IconButton
            size="small"
            aria-label="搜索团队"
            onClick={() => setSearchOpen((o) => !o)}
            sx={{ p: 0.25, color: searchOpen || keyword ? 'primary.main' : 'text.secondary' }}
          >
            <SearchRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        }
        flush
      >
        {(searchOpen || keyword) && (
          <Box sx={{ mx: 1.75, mb: 1, display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.5, borderRadius: 999, bgcolor: 'action.hover' }}>
            <SearchRoundedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
            <InputBase autoFocus={!keyword} placeholder="搜索团队名称" value={keyword} onChange={(e) => onKeyword(e.target.value)} sx={{ flex: 1, fontSize: 14 }} />
            {keyword && (
              <IconButton size="small" aria-label="清空" onClick={() => onKeyword('')} sx={{ p: 0.25 }}>
                <CloseRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            )}
          </Box>
        )}
        {squareLoading && square.length === 0 ? (
          <MobileSkeletonRows count={3} />
        ) : square.length === 0 ? (
          <MobileEmpty>{search ? '没有找到这个名字的团队' : '还没有团队,来创建第一个'}</MobileEmpty>
        ) : (
          square.map((t, i) => {
            const canApply = !!me && !myIds.has(t.id) && t.openJoin;
            return (
              <MobileListRow
                key={t.id}
                divider={i > 0}
                onClick={() => onOpen(t.id)}
                leading={<TeamAvatar src={t.avatar} />}
                title={t.name}
                subtitle={t.intro || stats(t)}
                trailing={
                  canApply ? (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={(e) => {
                        e.stopPropagation();
                        onApply(t);
                      }}
                      sx={{ minWidth: 0, flexShrink: 0, px: 1.25, py: 0.25, borderRadius: 999, textTransform: 'none', fontSize: 12 }}
                    >
                      申请
                    </Button>
                  ) : undefined
                }
              />
            );
          })
        )}
      </MobileSection>

      {!!me && <MobileFab label="创建团队" onClick={onCreate} />}
    </Box>
  );
}

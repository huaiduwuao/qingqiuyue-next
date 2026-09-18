'use client';

/** 团队主页:资料、成员与份额、待处理的邀请 / 申请、邀请新人、最近的实现。 */

import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import RealmSelect from '@/components/reward/RealmSelect';
import RealizationList from '@/components/reward/RealizationList';
import {
  acceptTeamRequest,
  applyTeam,
  disbandTeam,
  getTeam,
  getTeamManage,
  inviteToTeam,
  removeTeamMember,
  setTeamMember,
  teamCandidates,
  updateTeam,
  yuan,
  type TeamMember,
  type TeamRole,
} from '@/apis/team';

const ROLE_LABEL: Record<string, string> = { owner: '队长', admin: '管理员', member: '成员' };

interface Props {
  teamId: number;
  me: number;
  onClose: () => void;
  onChanged: () => void;
  onOpenTaskboard?: (teamId: number) => void;
  notify: (msg: string, ok?: boolean) => void;
}

export default function TeamDialog({ teamId, me, onClose, onChanged, onOpenTaskboard, notify }: Props) {
  const qc = useQueryClient();
  const detail = useQuery({ queryKey: ['team', 'detail', teamId], queryFn: () => getTeam(teamId) });
  const manage = useQuery({ queryKey: ['team', 'manage', teamId], queryFn: () => getTeamManage(teamId), enabled: me > 0 });

  const team = detail.data?.team;
  const members = detail.data?.members || [];
  const my = manage.data?.my ?? null;
  const pending = manage.data?.pending || [];
  const isOwner = my?.status === 'active' && my.role === 'owner';
  const canManage = my?.status === 'active' && (my.role === 'owner' || my.role === 'admin');
  const totalShare = members.reduce((s, m) => s + Math.max(1, m.share), 0);

  const [intro, setIntro] = useState('');
  const [topicId, setTopicId] = useState(0);
  const [openJoin, setOpenJoin] = useState(true);
  useEffect(() => {
    if (team) {
      setIntro(team.intro || '');
      setTopicId(team.topicId || 0);
      setOpenJoin(team.openJoin);
    }
  }, [team]);

  const run = async (fn: () => Promise<unknown>, okMsg: string, close = false) => {
    try {
      await fn();
      notify(okMsg);
      qc.invalidateQueries({ queryKey: ['team'] });
      onChanged();
      if (close) onClose();
    } catch (e: any) {
      notify(e?.message || '操作失败', false);
    }
  };

  const dirty = !!team && (intro !== (team.intro || '') || topicId !== (team.topicId || 0) || openJoin !== team.openJoin);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: 17, fontWeight: 700 }}>
            {team?.name || '团队'}
          </Typography>
          {team && (
            <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
              {team.memberCount} 人 · 交付 {team.realizedCount} · 累计收入 ¥{yuan(team.earnedCents)}
              {team.status !== 'active' && ' · 已解散'}
            </Typography>
          )}
        </Box>
        {my?.status === 'active' && <Chip size="small" label={ROLE_LABEL[my.role]} />}
      </DialogTitle>

      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {canManage ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <TextField label="简介" size="small" multiline minRows={2} value={intro} onChange={(e) => setIntro(e.target.value)} />
            <RealmSelect value={topicId} onChange={setTopicId} label="主场意境" />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FormControlLabel
                sx={{ flex: 1 }}
                control={<Switch checked={openJoin} onChange={(e) => setOpenJoin(e.target.checked)} />}
                label={<Typography sx={{ fontSize: 13 }}>接受申请加入</Typography>}
              />
              <Button
                size="small"
                variant="outlined"
                disabled={!dirty}
                onClick={() => run(() => updateTeam(teamId, { intro, avatar: team?.avatar || '', topicId, openJoin }), '已保存')}
              >
                保存资料
              </Button>
            </Box>
          </Box>
        ) : (
          team?.intro && <Typography sx={{ fontSize: 13.5, whiteSpace: 'pre-wrap' }}>{team.intro}</Typography>
        )}

        <Box>
          <SectionTitle>成员与份额</SectionTitle>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>
            份额是分账权重,不是百分比。认领任务的那一刻会把当时的份额记在这一单上,之后的调整只影响以后认领的任务。
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {members.map((m) => (
              <MemberRow
                key={m.userId}
                m={m}
                percent={totalShare ? Math.round((Math.max(1, m.share) * 100) / totalShare) : 0}
                editable={isOwner && m.role !== 'owner'}
                onSave={(role, share) => run(() => setTeamMember(teamId, { userId: m.userId, role, share }), '已更新')}
                onRemove={
                  m.role !== 'owner' && (canManage || m.userId === me)
                    ? () => run(() => removeTeamMember(teamId, m.userId), m.userId === me ? '已退出团队' : '已移出团队', m.userId === me)
                    : undefined
                }
                removeLabel={m.userId === me ? '退出' : '移出'}
                onTransfer={isOwner && m.role !== 'owner' ? () => run(() => setTeamMember(teamId, { userId: m.userId, role: 'owner', share: m.share }), `队长已转让给 ${m.nickname}`) : undefined}
              />
            ))}
          </Box>
        </Box>

        {canManage && pending.length > 0 && (
          <Box>
            <SectionTitle>待处理</SectionTitle>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {pending.map((m) => (
                <Box key={m.userId} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar src={m.avatar || undefined} sx={{ width: 28, height: 28 }} />
                  <Typography noWrap sx={{ fontSize: 13.5, flex: 1 }}>
                    {m.nickname}
                  </Typography>
                  <Chip size="small" variant="outlined" label={m.status === 'applied' ? '申请加入' : '已邀请,等对方接受'} />
                  {m.status === 'applied' && (
                    <Button size="small" variant="text" onClick={() => run(() => acceptTeamRequest(teamId, m.userId), `${m.nickname} 已加入`)}>
                      同意
                    </Button>
                  )}
                  <Button size="small" variant="text" color="inherit" onClick={() => run(() => removeTeamMember(teamId, m.userId), '已处理')}>
                    {m.status === 'applied' ? '拒绝' : '撤回'}
                  </Button>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {canManage && <InviteBox teamId={teamId} onInvite={(u) => run(() => inviteToTeam(teamId, u.userId), `已邀请 ${u.nickname}`)} />}

        <Divider />
        <Box>
          <SectionTitle>最近的实现</SectionTitle>
          <RealizationList items={detail.data?.realizations || []} empty="这支团队还没有验收通过的交付" compact />
        </Box>
      </DialogContent>

      <DialogActions sx={{ flexWrap: 'wrap', gap: 0.5 }}>
        {isOwner && (
          <Button
            variant="text"
            color="error"
            onClick={() => {
              if (window.confirm(`解散「${team?.name}」?还有没结账的团队任务时不能解散。`)) run(() => disbandTeam(teamId), '团队已解散', true);
            }}
          >
            解散团队
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        {my?.status === 'active' && onOpenTaskboard && (
          <Button
            variant="text"
            onClick={() => {
              onOpenTaskboard(teamId);
              onClose();
            }}
          >
            团队任务
          </Button>
        )}
        {me > 0 && !my && team?.status === 'active' && team.openJoin && (
          <Button variant="outlined" onClick={() => run(() => applyTeam(teamId), '申请已提交,等队长同意')}>
            申请加入
          </Button>
        )}
        {my?.status === 'invited' && (
          <Button variant="contained" onClick={() => run(() => acceptTeamRequest(teamId, me), '已加入团队')}>
            接受邀请
          </Button>
        )}
        {my?.status === 'applied' && (
          <Button variant="text" color="inherit" onClick={() => run(() => removeTeamMember(teamId, me), '已撤回申请')}>
            撤回申请
          </Button>
        )}
        <Button variant="text" onClick={onClose}>
          关闭
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 0.75 }}>{children}</Typography>;
}

function MemberRow({
  m,
  percent,
  editable,
  onSave,
  onRemove,
  removeLabel,
  onTransfer,
}: {
  m: TeamMember;
  percent: number;
  editable: boolean;
  onSave: (role: TeamRole, share: number) => void;
  onRemove?: () => void;
  removeLabel: string;
  onTransfer?: () => void;
}) {
  const [role, setRole] = useState<TeamRole>(m.role);
  const [share, setShare] = useState(String(m.share));
  useEffect(() => {
    setRole(m.role);
    setShare(String(m.share));
  }, [m.role, m.share]);
  const n = Math.min(100, Math.max(1, parseInt(share, 10) || 1));
  const dirty = role !== m.role || n !== m.share;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <Avatar src={m.avatar || undefined} sx={{ width: 28, height: 28 }} />
      <Typography noWrap sx={{ fontSize: 13.5, flex: 1, minWidth: 80 }}>
        {m.nickname}
        {m.isBot && <Chip size="small" label="AI" sx={{ ml: 0.75, height: 18, fontSize: 11 }} />}
      </Typography>
      {editable ? (
        <>
          <TextField select size="small" value={role} onChange={(e) => setRole(e.target.value as TeamRole)} sx={{ width: 104 }}>
            <MenuItem value="member">成员</MenuItem>
            <MenuItem value="admin">管理员</MenuItem>
          </TextField>
          <TextField
            size="small"
            label="份额"
            value={share}
            onChange={(e) => setShare(e.target.value.replace(/\D/g, '').slice(0, 3))}
            sx={{ width: 76 }}
            slotProps={{ htmlInput: { inputMode: 'numeric' } }}
          />
          <Button size="small" variant="text" disabled={!dirty} onClick={() => onSave(role, n)}>
            保存
          </Button>
        </>
      ) : (
        <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
          {ROLE_LABEL[m.role]} · 份额 {m.share}
        </Typography>
      )}
      <Typography sx={{ fontSize: 12.5, color: 'text.secondary', width: 40, textAlign: 'right' }}>{percent}%</Typography>
      {onTransfer && (
        <Button
          size="small"
          variant="text"
          color="inherit"
          onClick={() => window.confirm(`把队长转让给 ${m.nickname}?转让后你成为管理员。`) && onTransfer()}
        >
          转让队长
        </Button>
      )}
      {onRemove && (
        <Button size="small" variant="text" color="inherit" onClick={() => window.confirm(`确定${removeLabel}?`) && onRemove()}>
          {removeLabel}
        </Button>
      )}
    </Box>
  );
}

function InviteBox({ teamId, onInvite }: { teamId: number; onInvite: (u: TeamMember) => void }) {
  const [kw, setKw] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(kw.trim()), 300);
    return () => clearTimeout(t);
  }, [kw]);
  const found = useQuery({
    queryKey: ['team', 'candidates', teamId, q],
    queryFn: () => teamCandidates(teamId, q).then((r) => r.list || []),
    enabled: q.length >= 2,
  });

  return (
    <Box>
      <SectionTitle>邀请成员</SectionTitle>
      <TextField size="small" fullWidth placeholder="输入昵称搜索(至少两个字)" value={kw} onChange={(e) => setKw(e.target.value)} />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 1 }}>
        {q.length >= 2 && !found.isFetching && (found.data || []).length === 0 && (
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>没有找到这个昵称的用户</Typography>
        )}
        {(found.data || []).map((u) => (
          <Box key={u.userId} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar src={u.avatar || undefined} sx={{ width: 26, height: 26 }} />
            <Typography noWrap sx={{ fontSize: 13.5, flex: 1 }}>
              {u.nickname}
              {u.isBot && <Chip size="small" label="AI" sx={{ ml: 0.75, height: 18, fontSize: 11 }} />}
            </Typography>
            <Button
              size="small"
              variant="text"
              onClick={() => {
                onInvite(u);
                setKw('');
              }}
            >
              邀请
            </Button>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

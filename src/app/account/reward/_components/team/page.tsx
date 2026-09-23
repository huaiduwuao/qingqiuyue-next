'use client';

/**
 * 团队。
 *
 * 团队是稳定的用户集群:队长或管理员可以代表团队认领任务,结账时赏金按「认领那一刻」的成员份额快照分 ——
 * 之后进队、退队、改份额都不影响已经认领的单。这里管三件事:我的团队(含等我处理的邀请)、团队广场、团队主页。
 *
 * 取代的是模板生成的「团队」页:那一页读的 group / group_user 表没有归属、没有钱、没有状态机,
 * 而且需求页要求"先选一个团队"才肯列出我的需求 —— 没建过团队的人什么也看不到。
 */

import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Snackbar from '@mui/material/Snackbar';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import { useApp } from '@/contexts/AppContext';
import RealmSelect from '@/components/reward/RealmSelect';
import { acceptTeamRequest, applyTeam, createTeam, listTeams, myTeams, removeTeamMember, yuan, type MyTeam, type Team } from '@/apis/team';
import TeamDialog from './TeamDialog';

const ROLE_LABEL: Record<string, string> = { owner: '队长', admin: '管理员', member: '成员' };

interface Props {
  /** 从别处跳过来时直接打开这个团队 */
  initialTeamId?: number | null;
  onOpenTaskboard?: (teamId: number) => void;
}

export default function TeamPage({ initialTeamId, onOpenTaskboard }: Props) {
  const { currentUser } = useApp();
  const me = Number(currentUser?.id ?? 0);
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<number | null>(initialTeamId ?? null);
  const [creating, setCreating] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(keyword.trim()), 300);
    return () => clearTimeout(t);
  }, [keyword]);

  const mine = useQuery({ queryKey: ['team', 'mine'], queryFn: () => myTeams().then((r) => r.list || []), enabled: me > 0 });
  const square = useQuery({
    queryKey: ['team', 'square', search],
    queryFn: () => listTeams({ keyword: search || undefined, pageSize: 24 }).then((r) => r.list || []),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['team'] });
  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    try {
      await fn();
      setToast({ msg: okMsg, ok: true });
      refresh();
    } catch (e: any) {
      setToast({ msg: e?.message || '操作失败', ok: false });
    }
  };

  const myList = mine.data || [];
  const myIds = new Set(myList.map((t) => t.id));
  const invites = myList.filter((t) => t.myStatus === 'invited');
  const joined = myList.filter((t) => t.myStatus !== 'invited');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* 顶部 hero 卡片壳:标题 + 描述 + 创建按钮。
          与赏金广场的 RewardHero 视觉一致 —— 圆角白卡 + 边框,避免团队区裸 Title。 */}
      <Box
        sx={{
          p: { xs: 2, md: 2.5 },
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ flex: 1, minWidth: 220 }}>
          <Typography sx={{ fontSize: 18, fontWeight: 700 }}>团队</Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
            结队接需求:队长或管理员代表团队认领任务,结账时赏金按认领那一刻的成员份额分给全队。
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => setCreating(true)} disabled={!me} sx={{ textTransform: 'none' }}>
          创建团队
        </Button>
      </Box>

      {invites.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {invites.map((t) => (
            <Alert
              key={t.id}
              severity="info"
              action={
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Button size="small" variant="text" onClick={() => run(() => acceptTeamRequest(t.id, me), `已加入「${t.name}」`)}>
                    接受
                  </Button>
                  <Button size="small" variant="text" color="inherit" onClick={() => run(() => removeTeamMember(t.id, me), '已拒绝邀请')}>
                    拒绝
                  </Button>
                </Box>
              }
            >
              「{t.name}」邀请你加入
            </Alert>
          ))}
        </Box>
      )}

      <Section title="我的团队" empty={me ? '还没有加入任何团队。创建一个,或者在下面的团队广场里申请加入。' : '登录后查看我的团队'} count={joined.length}>
        {joined.map((t) => (
          <TeamCard
            key={t.id}
            team={t}
            onOpen={() => setOpenId(t.id)}
            badge={t.myStatus === 'applied' ? '申请中' : ROLE_LABEL[t.myRole]}
            footer={t.myStatus === 'active' ? `我的份额 ${t.myShare}` : undefined}
          />
        ))}
      </Section>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700, flex: 1 }}>团队广场</Typography>
          <TextField size="small" placeholder="搜索团队名称" value={keyword} onChange={(e) => setKeyword(e.target.value)} sx={{ width: 220 }} />
        </Box>
        <Grid>
          {(square.data || []).map((t) => (
            <TeamCard
              key={t.id}
              team={t}
              onOpen={() => setOpenId(t.id)}
              action={
                me && !myIds.has(t.id) && t.openJoin ? (
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ textTransform: 'none' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      run(() => applyTeam(t.id), '申请已提交,等队长同意');
                    }}
                  >
                    申请加入
                  </Button>
                ) : undefined
              }
            />
          ))}
        </Grid>
        {!square.isFetching && (square.data || []).length === 0 && (
          <Typography sx={{ fontSize: 13, color: 'text.secondary', py: 3, textAlign: 'center' }}>
            {search ? '没有找到这个名字的团队' : '还没有团队,来创建第一个'}
          </Typography>
        )}
      </Box>

      <CreateDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(t) => {
          setCreating(false);
          setToast({ msg: `团队「${t.name}」已创建`, ok: true });
          refresh();
          setOpenId(t.id);
        }}
      />
      {openId != null && (
        <TeamDialog
          teamId={openId}
          me={me}
          onClose={() => setOpenId(null)}
          onChanged={refresh}
          onOpenTaskboard={onOpenTaskboard}
          notify={(msg, ok = true) => setToast({ msg, ok })}
        />
      )}
      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={toast?.ok ? 'success' : 'error'} variant="filled" onClose={() => setToast(null)}>
          {toast?.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' } }}>
      {children}
    </Box>
  );
}

function Section({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    // 与桌面 + repos 顶部 hero 一致:小节也用白卡 + 边框包一下,避免裸 Title 漂浮。
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{title}</Typography>
      {count === 0 ? <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{empty}</Typography> : <Grid>{children}</Grid>}
    </Box>
  );
}

function TeamCard({
  team,
  onOpen,
  badge,
  footer,
  action,
}: {
  team: Team | MyTeam;
  onOpen: () => void;
  badge?: string;
  footer?: string;
  action?: React.ReactNode;
}) {
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen()}
      sx={{
        p: 2,
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        minWidth: 0,
        '&:hover': { borderColor: 'primary.main' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
        <Avatar src={team.avatar || undefined} variant="rounded" sx={{ width: 40, height: 40 }}>
          <GroupsRoundedIcon fontSize="small" />
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: 14, fontWeight: 700 }}>
            {team.name}
          </Typography>
          <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary' }}>
            {team.memberCount} 人 · 交付 {team.realizedCount} · 收入 ¥{yuan(team.earnedCents)}
          </Typography>
        </Box>
        {badge && <Chip size="small" label={badge} />}
      </Box>
      {team.intro && (
        <Typography sx={{ fontSize: 12.5, color: 'text.secondary', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {team.intro}
        </Typography>
      )}
      {(footer || action) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 'auto' }}>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', flex: 1 }}>{footer}</Typography>
          {action}
        </Box>
      )}
    </Box>
  );
}

function CreateDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (t: Team) => void }) {
  const [name, setName] = useState('');
  const [intro, setIntro] = useState('');
  const [topicId, setTopicId] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setIntro('');
      setTopicId(0);
      setError('');
    }
  }, [open]);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      onCreated(await createTeam({ name: name.trim(), intro: intro.trim(), topicId }));
    } catch (e: any) {
      setError(e?.message || '创建失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>创建团队</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField label="团队名称" size="small" value={name} onChange={(e) => setName(e.target.value)} helperText="2–20 个字,不能和别的团队重名" autoFocus />
        <TextField label="简介" size="small" multiline minRows={2} value={intro} onChange={(e) => setIntro(e.target.value)} helperText="最多 200 个字" />
        <RealmSelect value={topicId} onChange={setTopicId} label="主场意境(可选)" helperText="团队会出现在这个意境的「团队」页里" />
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose}>
          取消
        </Button>
        <Button variant="contained" onClick={submit} disabled={busy || name.trim().length < 2}>
          创建
        </Button>
      </DialogActions>
    </Dialog>
  );
}

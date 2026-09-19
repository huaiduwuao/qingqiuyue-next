'use client';

// 我的群组 / 团队 列表页。
//
// /account/group — 列出当前用户加入的群(type='group')与团队(type='team'),
// 点进任一个跳到 /group/{id} 看聊天/成员/分账。
//
// 顶部「创建群组」「创建团队」按钮(E1/群,F2/团队),
// 群是兴趣聚类,团队是商业协作 — 两个 tab 区分。

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Snackbar from '@mui/material/Snackbar';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import PublicTopBar from '@/components/layout/PublicTopBar';
import { useAuth } from '@/contexts/AuthContext';
import {
  createGroup,
  listMyGroups,
  type ChatGroup,
  type GroupType,
} from '@/apis/group';
import { coverBackground } from '@/lib/media';

export default function MyGroupsPage() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const user = currentUser;
  const [tab, setTab] = useState<GroupType>('group');
  const [createOpen, setCreateOpen] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  const listQ = useQuery({
    queryKey: ['my-groups', tab],
    queryFn: () => listMyGroups({ type: tab }),
    enabled: !!user,
  });

  return (
    <Box>
      <PublicTopBar />
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', mb: 2, gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'text.primary' }}>
              {tab === 'group' ? '我的群组' : '我的团队'}
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
              {tab === 'group'
                ? '兴趣聚类与粉丝群,聊天打赏,成员平等'
                : '商业协作与接单团队,自带队长分工,按比例自动分账'}
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => setCreateOpen(true)}
            sx={{
              textTransform: 'none',
              borderRadius: 1.5,
              background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
              '&:hover': { background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)', filter: 'brightness(1.1)' },
            }}
          >
            创建{tab === 'group' ? '群组' : '团队'}
          </Button>
        </Box>

        {/* tab */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Chip
            icon={<GroupsRoundedIcon sx={{ fontSize: 16 }} />}
            label="群组"
            color={tab === 'group' ? 'primary' : 'default'}
            variant={tab === 'group' ? 'filled' : 'outlined'}
            onClick={() => setTab('group')}
            sx={{ cursor: 'pointer' }}
          />
          <Chip
            icon={<HandshakeRoundedIcon sx={{ fontSize: 16 }} />}
            label="团队"
            color={tab === 'team' ? 'primary' : 'default'}
            variant={tab === 'team' ? 'filled' : 'outlined'}
            onClick={() => setTab('team')}
            sx={{ cursor: 'pointer' }}
          />
        </Box>

        {/* list */}
        {listQ.isLoading ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <CircularProgress size={24} />
          </Box>
        ) : listQ.isError ? (
          <Alert severity="error">加载失败</Alert>
        ) : (listQ.data?.list ?? []).length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8, color: 'text.disabled' }}>
            <Typography sx={{ fontSize: 14, mb: 2 }}>
              还没有{tab === 'group' ? '加入任何群组' : '加入任何团队'}
            </Typography>
            <Button variant="outlined" onClick={() => setCreateOpen(true)} sx={{ textTransform: 'none' }}>
              创建第一个
            </Button>
          </Box>
        ) : (
          <Stack spacing={1.5}>
            {(listQ.data!.list as ChatGroup[]).map((g) => (
              <Box
                key={g.id}
                onClick={() => router.push(`/group?id=${g.id}`)}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  '&:hover': { borderColor: 'primary.main' },
                }}
              >
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 1.5,
                    flexShrink: 0,
                    background: coverBackground(g.avatar, 'linear-gradient(135deg, #FE2C55 0%, #FFB400 100%)'),
                  }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary' }}>
                      {g.name}
                    </Typography>
                    {g.public ? (
                      <PublicRoundedIcon sx={{ fontSize: 12, color: 'primary.main' }} />
                    ) : (
                      <LockOutlinedIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                    )}
                    {g.type === 'team' && (
                      <Chip size="small" label="团队" color="secondary" sx={{ height: 18, fontSize: 10 }} />
                    )}
                  </Box>
                  <Typography
                    sx={{
                      fontSize: 12,
                      color: 'text.secondary',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {g.lastMessage || g.bio || '还没有消息'}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
                    {g.memberCount} 人
                  </Typography>
                  {g.lastTime && (
                    <Typography sx={{ fontSize: 10, color: 'text.disabled', mt: 0.5 }}>
                      {g.lastTime.slice(0, 10)}
                    </Typography>
                  )}
                </Box>
              </Box>
            ))}
          </Stack>
        )}
      </Container>

      <CreateGroupDialog
        open={createOpen}
        type={tab}
        onClose={() => setCreateOpen(false)}
        onCreated={(g) => {
          setCreateOpen(false);
          setSnack(`${tab === 'group' ? '群组' : '团队'}已创建,正在打开…`);
          setTimeout(() => router.push(`/group?id=${g.id}`), 600);
        }}
        onError={setSnack}
      />

      <Snackbar
        open={!!snack}
        autoHideDuration={2200}
        onClose={() => setSnack(null)}
        message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}

// ───── 创建群/团队对话框 ─────
function CreateGroupDialog({
  open, type, onClose, onCreated, onError,
}: {
  open: boolean;
  type: GroupType;
  onClose: () => void;
  onCreated: (g: ChatGroup) => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName('');
    setBio('');
    setAvatar('');
    setIsPublic(false);
  };

  const submit = async () => {
    if (name.trim().length < 2 || name.trim().length > 100) {
      onError('名称需为 2-100 字');
      return;
    }
    setBusy(true);
    try {
      const g = await createGroup({
        type,
        name: name.trim(),
        bio: bio.trim(),
        avatar: avatar.trim(),
        // 团队永远私密;群可指定公开
        public: type === 'team' ? false : isPublic,
      });
      reset();
      onCreated(g);
    } catch (e: any) {
      onError(e?.message || '创建失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: { bgcolor: 'background.paper', backgroundImage: 'none' } } }}
    >
      <DialogTitle>
        {type === 'group' ? '创建群组' : '创建团队'}
      </DialogTitle>
      <DialogContent dividers sx={{ borderColor: 'divider' }}>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label={type === 'group' ? '群组名' : '团队名'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            size="small"
            required
            slotProps={{ htmlInput: { maxLength: 100 } }}
          />
          <TextField
            label="简介"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            size="small"
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
          <TextField
            label="头像 URL(可选)"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            fullWidth
            size="small"
            placeholder="https://..."
          />
          {type === 'group' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Switch
                checked={isPublic}
                onChange={(_, v) => setIsPublic(v)}
                color="primary"
              />
              <Typography sx={{ fontSize: 13, color: 'text.primary' }}>
                公开群(任何人可加入,否则需邀请 token)
              </Typography>
            </Box>
          )}
          {type === 'team' && (
            <Alert severity="info" sx={{ fontSize: 12 }}>
              团队默认私密,通过邀请 token 加入。队长可在「团队管理」发起分账。
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: 'none' }}>
          取消
        </Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={busy}
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}
          sx={{
            textTransform: 'none',
            background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
            '&:hover': { background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)', filter: 'brightness(1.1)' },
          }}
        >
          创建
        </Button>
      </DialogActions>
    </Dialog>
  );
}

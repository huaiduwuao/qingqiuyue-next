'use client';

/**
 * 作品管理里单个作品的「⋮」操作菜单:作品是创作者中心各功能的汇合点——
 * 从这里查看详情、加入合集、设定价、分发到抖音/快手、登记原创、参加活动。
 *
 * 作品 id 是后端 idgen 发的 BIGINT(> 2^53),全程按字符串原样传,不要 Number()。
 * 老版本 core-api 可能把 id 当 JSON 数字发来(精度已丢),这种 id 不可信,依赖 id 的操作一律禁用。
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Radio from '@mui/material/Radio';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Portal from '@mui/material/Portal';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import PlaylistAddRoundedIcon from '@mui/icons-material/PlaylistAddRounded';
import DiamondOutlinedIcon from '@mui/icons-material/DiamondOutlined';
import ShareRoundedIcon from '@mui/icons-material/ShareRounded';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import { getDetailRoute } from '@/lib/contentRoute';
import { getMyLists, addToMyList, createMyList } from '@/apis/my-list';
import { setPaidContent } from '@/apis/social-monetize';
import { applyCerts } from '@/apis/original';
import ShareTaskDialog from '@/components/share/ShareTaskDialog';
import { useActiveTab } from '../ActiveTabContext';

/** 创作者中心的「合集」就是 type=topic 的收藏夹(与 _views/collection 同一份数据、同一个 queryKey) */
const CREATOR_LIST_TYPE = 'topic' as const;
const NEW_LIST = '__new__';

export interface WorkRef {
  contentId: string | number;
  contentType: string;
  title: string;
  cover?: string;
  status?: string;
}

type DialogKind = 'collection' | 'price' | 'douyin' | 'kuaishou' | 'original' | null;
type Toast = { msg: string; severity: 'success' | 'error'; action?: { label: string; onClick: () => void } };

/** module_content.status 是大写枚举,另有一批老数据是小写 active(等同已发布) */
export const isPublishedStatus = (s?: string) => s === 'PUBLISH' || s === 'active';

/** 字符串原样保留;数字只有在安全整数范围内才可信 */
function exactId(id: string | number): string | null {
  if (typeof id === 'string') return id.trim() || null;
  return Number.isSafeInteger(id) ? String(id) : null;
}

export function WorkActionsMenu({ work, size = 'small' }: { work: WorkRef; size?: 'small' | 'medium' }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { setActiveTab } = useActiveTab();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const id = exactId(work.contentId);
  const published = isPublishedStatus(work.status);
  const route = id ? getDetailRoute(work.contentType, id) : null;
  const needPublishHint = published ? undefined : '作品发布后可用';

  const open = (k: DialogKind) => {
    setAnchor(null);
    setDialog(k);
  };
  const done = (t: Toast) => {
    setDialog(null);
    setToast(t);
  };

  // 从菜单 / 对话框(portal)冒出来的事件会沿 React 树冒到外层:
  // 手机列表行的 onClick 会跳详情,DataGrid 单元格会吃掉键盘事件,这里统一拦下。
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <Box component="span" onClick={stop} onKeyDown={stop} sx={{ display: 'inline-flex' }}>
      <IconButton
        size={size}
        aria-label="作品操作"
        aria-haspopup="menu"
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ color: 'text.secondary' }}
      >
        <MoreVertRoundedIcon sx={{ fontSize: 20 }} />
      </IconButton>

      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 180 } } }}
      >
        <ActionItem
          icon={<OpenInNewRoundedIcon fontSize="small" />}
          label="查看详情"
          disabled={!route}
          onClick={() => {
            setAnchor(null);
            if (route) router.push(route);
          }}
        />
        <ActionItem
          icon={<PlaylistAddRoundedIcon fontSize="small" />}
          label="加入合集"
          disabled={!id}
          onClick={() => open('collection')}
        />
        <Divider />
        <ActionItem
          icon={<DiamondOutlinedIcon fontSize="small" />}
          label="设为付费 / 修改定价"
          hint={needPublishHint}
          disabled={!id || !published}
          onClick={() => open('price')}
        />
        <ActionItem
          icon={<ShareRoundedIcon fontSize="small" />}
          label="分发到抖音"
          hint={needPublishHint}
          disabled={!id || !published}
          onClick={() => open('douyin')}
        />
        <ActionItem
          icon={<ShareRoundedIcon fontSize="small" />}
          label="分发到快手"
          hint={needPublishHint}
          disabled={!id || !published}
          onClick={() => open('kuaishou')}
        />
        <ActionItem
          icon={<VerifiedUserOutlinedIcon fontSize="small" />}
          label="登记原创"
          hint={needPublishHint}
          disabled={!id || !published}
          onClick={() => open('original')}
        />
        <ActionItem
          icon={<EmojiEventsOutlinedIcon fontSize="small" />}
          label="参加活动"
          hint={needPublishHint}
          disabled={!published}
          onClick={() => {
            setAnchor(null);
            setActiveTab('activity');
          }}
        />
      </Menu>

      {id && dialog === 'collection' && (
        <CollectionDialog
          contentId={id}
          onClose={() => setDialog(null)}
          onDone={(name) => {
            qc.invalidateQueries({ queryKey: ['creator-collections'] });
            qc.invalidateQueries({ queryKey: ['creator-collection-content'] });
            qc.invalidateQueries({ queryKey: ['my-lists'] });
            done({
              msg: `已加入合集「${name}」`,
              severity: 'success',
              action: { label: '查看', onClick: () => setActiveTab('collection') },
            });
          }}
        />
      )}

      {id && dialog === 'price' && (
        <PriceDialog
          contentId={id}
          title={work.title}
          onClose={() => setDialog(null)}
          onDone={(price) => {
            qc.invalidateQueries({ queryKey: ['social', 'my-paid-contents'] });
            qc.invalidateQueries({ queryKey: ['social-paid-contents'] });
            done({ msg: price > 0 ? `已设为付费:${price} 钻` : '已改回免费', severity: 'success' });
          }}
        />
      )}

      {id && (dialog === 'douyin' || dialog === 'kuaishou') && (
        <ShareTaskDialog
          open
          onClose={() => setDialog(null)}
          platform={dialog}
          contentType={work.contentType}
          contentId={id}
          defaultTitle={work.title}
          defaultCoverUrl={work.cover}
        />
      )}

      {id && dialog === 'original' && (
        <OriginalDialog
          contentId={id}
          title={work.title}
          onClose={() => setDialog(null)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ['original'] });
            done({
              msg: '已登记原创存证',
              severity: 'success',
              action: { label: '查看', onClick: () => setActiveTab('original') },
            });
          }}
        />
      )}

      {/* DataGrid 的渲染区带 transform,fixed 定位会被困在单元格里,挂到 body */}
      <Portal>
      <Snackbar
        open={!!toast}
        autoHideDuration={toast?.action ? 6000 : 3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? (
          <Alert
            severity={toast.severity}
            variant="filled"
            onClose={() => setToast(null)}
            action={
              toast.action ? (
                <Button
                  variant="text"
                  size="small"
                  color="inherit"
                  onClick={() => {
                    toast.action?.onClick();
                    setToast(null);
                  }}
                >
                  {toast.action.label}
                </Button>
              ) : undefined
            }
            sx={{ alignItems: 'center' }}
          >
            {toast.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
      </Portal>
    </Box>
  );
}

function ActionItem({
  icon,
  label,
  hint,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <MenuItem disabled={disabled} onClick={onClick} sx={{ fontSize: 14 }}>
      <ListItemIcon>{icon}</ListItemIcon>
      <ListItemText
        primary={label}
        secondary={disabled ? hint : undefined}
        slotProps={{ primary: { sx: { fontSize: 14 } }, secondary: { sx: { fontSize: 11 } } }}
      />
    </MenuItem>
  );
}

const errMsg = (e: unknown, fallback: string) => (e as { message?: string })?.message || fallback;

function CollectionDialog({
  contentId,
  onClose,
  onDone,
}: {
  contentId: string;
  onClose: () => void;
  onDone: (name: string) => void;
}) {
  const listQ = useQuery({
    queryKey: ['creator-collections', CREATOR_LIST_TYPE],
    queryFn: () => getMyLists(CREATOR_LIST_TYPE),
    staleTime: 30 * 1000,
  });
  const lists = (listQ.data?.list ?? []).filter((l) => l.mine !== false);
  const [picked, setPicked] = useState<string>('');
  const [newName, setNewName] = useState('');
  // 没有合集时直接落在「新建合集」
  const choice = picked || (listQ.isSuccess && lists.length === 0 ? NEW_LIST : '');
  const nameOk = newName.trim().length >= 1 && newName.trim().length <= 40;

  const m = useMutation({
    mutationFn: async () => {
      if (choice === NEW_LIST) {
        const name = newName.trim();
        await createMyList({ name, type: CREATOR_LIST_TYPE, contentIds: [contentId] });
        return name;
      }
      const target = lists.find((l) => String(l.id) === choice);
      if (!target) throw new Error('请选择合集');
      await addToMyList(target.id, [contentId]);
      return target.name;
    },
    onSuccess: onDone,
  });

  const canSubmit = !m.isPending && (choice === NEW_LIST ? nameOk : !!choice);

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>加入合集</DialogTitle>
      <DialogContent>
        {listQ.isLoading ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 320, overflowY: 'auto' }}>
            {listQ.isError && <Alert severity="error">合集加载失败</Alert>}
            {lists.map((l) => {
              const key = String(l.id);
              return (
                <OptionRow key={key} checked={choice === key} onClick={() => setPicked(key)}>
                  <Typography sx={{ fontSize: 14, flex: 1 }} noWrap>
                    {l.name}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>{l.itemCount ?? 0} 个</Typography>
                </OptionRow>
              );
            })}
            <OptionRow checked={choice === NEW_LIST} onClick={() => setPicked(NEW_LIST)}>
              <Typography sx={{ fontSize: 14, flex: 1 }}>新建合集</Typography>
            </OptionRow>
            {choice === NEW_LIST && (
              <TextField
                autoFocus
                size="small"
                label="合集名称"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                slotProps={{ htmlInput: { maxLength: 40 } }}
                helperText="1–40 个字"
                sx={{ mt: 1 }}
              />
            )}
          </Box>
        )}
        {m.isError && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {errMsg(m.error, '加入合集失败')}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose}>
          取消
        </Button>
        <Button variant="contained" disabled={!canSubmit} onClick={() => m.mutate()}>
          {m.isPending ? '提交中…' : choice === NEW_LIST ? '新建并加入' : '加入'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function OptionRow({ checked, onClick, children }: { checked: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Box
      role="radio"
      aria-checked={checked}
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1,
        py: 0.75,
        borderRadius: 1,
        cursor: 'pointer',
        border: '1px solid',
        borderColor: checked ? 'primary.main' : 'divider',
      }}
    >
      <Radio checked={checked} size="small" sx={{ p: 0 }} tabIndex={-1} />
      {children}
    </Box>
  );
}

function PriceDialog({
  contentId,
  title,
  onClose,
  onDone,
}: {
  contentId: string;
  title: string;
  onClose: () => void;
  onDone: (price: number) => void;
}) {
  // 单位:钻,整数 0 ~ 10000;0 = 改回免费(与 /social/paid-content 契约一致)
  const [price, setPrice] = useState('');
  const n = Number(price);
  const valid = price.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= 10000;
  const m = useMutation({
    mutationFn: () => setPaidContent({ contentId, price: n }),
    onSuccess: () => onDone(n),
  });

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>设为付费 / 修改定价</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1.5 }} noWrap>
          {title || '未命名作品'}
        </Typography>
        <TextField
          autoFocus
          fullWidth
          size="small"
          type="number"
          label="价格(钻)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          error={price.trim() !== '' && !valid}
          helperText="整数 1 ~ 10000 钻;填 0 改回免费"
          slotProps={{ htmlInput: { min: 0, max: 10000, step: 1 } }}
        />
        {m.isError && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {errMsg(m.error, '设置失败')}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose}>
          取消
        </Button>
        <Button variant="contained" disabled={!valid || m.isPending} onClick={() => m.mutate()}>
          {m.isPending ? '提交中…' : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function OriginalDialog({
  contentId,
  title,
  onClose,
  onDone,
}: {
  contentId: string;
  title: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const m = useMutation({
    mutationFn: () => applyCerts([contentId]),
    onSuccess: onDone,
  });
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>登记原创存证</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 14 }}>
          为「{title || '未命名作品'}」登记原创存证?登记后平台会持续监测站内疑似侵权内容。
        </Typography>
        {m.isError && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {errMsg(m.error, '登记失败')}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose}>
          取消
        </Button>
        <Button variant="contained" disabled={m.isPending} onClick={() => m.mutate()}>
          {m.isPending ? '提交中…' : '确认登记'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

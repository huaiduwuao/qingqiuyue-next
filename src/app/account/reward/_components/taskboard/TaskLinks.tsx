'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { getCreatorWorks, type WorksItem } from '@/apis/creator';
import { openDmSession } from '@/apis/social';
import { formatApiError } from '@/lib/api/client';
import { getDetailRoute, TYPE_LABEL } from '@/lib/contentRoute';

/**
 * 悬赏任务与「我的作品」「私信」的衔接(后端见 service/reward_task_link.go):
 *   - 认领人从自己的作品里挑一件作为交付物;
 *   - 任务上保存作品快照,发布者验收时直接打开作品;
 *   - 双方随时从任务弹层跳到私信沟通,流转事件也会以卡片形式出现在私信里。
 */

/** 交付作品(任务上的快照,或刚从作品列表里选中的一件)。id 是 Doris BIGINT,按字符串处理。 */
export interface TaskWorkRef {
  id: string | number;
  contentType: string;
  title: string;
  cover?: string;
  status?: string;
}

const WORK_STATUS_LABEL: Record<string, string> = {
  PUBLISH: '已发布',
  REVIEWING: '审核中',
  UN_PUBLISH: '已下架',
  REJECTED: '未通过',
};

const TYPE_OPTIONS = ['', 'ARTICLE', 'VIDEO', 'PICTURE', 'NOVEL', 'MUSIC', 'COMICS', 'ANIMATION', 'FILM', 'TELEPLAY', 'LIVE'];

export function workTypeLabel(t?: string) {
  return (t && TYPE_LABEL[t]) || t || '作品';
}

/** 从我的作品里选一件作为交付物。未通过审核的作品后端会拒收,这里直接置灰。 */
export function WorkPickerDialog({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (w: TaskWorkRef) => void;
}) {
  const [type, setType] = useState('');
  const worksQuery = useQuery({
    queryKey: ['reward', 'task', 'my-works', type],
    queryFn: () => getCreatorWorks({ contentType: type || undefined, page: 1, pageSize: 50 }),
    enabled: open,
  });
  const works: WorksItem[] = worksQuery.data?.list ?? [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 16, pb: 1 }}>从我的作品选择交付物</DialogTitle>
      <DialogContent dividers sx={{ borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <TextField
            select
            size="small"
            label="类型"
            value={type}
            onChange={(e) => setType(e.target.value)}
            sx={{ minWidth: 140 }}
          >
            {TYPE_OPTIONS.map((t) => (
              <MenuItem key={t || 'all'} value={t}>
                {t ? workTypeLabel(t) : '全部类型'}
              </MenuItem>
            ))}
          </TextField>
          <Box sx={{ flex: 1 }} />
          <Button size="small" href="/account/content?tab=hd-publish" target="_blank" endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}>
            去发布新作品
          </Button>
        </Box>
        {worksQuery.isFetching && <LinearProgress sx={{ mb: 1 }} />}
        {worksQuery.isError && (
          <Typography sx={{ fontSize: 12, color: 'error.main' }}>{formatApiError(worksQuery.error) || '作品加载失败'}</Typography>
        )}
        {!worksQuery.isFetching && !worksQuery.isError && works.length === 0 && (
          <Typography sx={{ fontSize: 13, color: 'text.secondary', py: 3, textAlign: 'center' }}>
            还没有作品。先在内容中心发布,再回来选择;也可以关掉这个窗口,直接填写交付说明。
          </Typography>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {works.map((w) => {
            const rejected = w.status === 'REJECTED';
            return (
              <Box
                key={String(w.id)}
                role="button"
                aria-disabled={rejected}
                onClick={() => {
                  if (rejected) return;
                  onPick({ id: String(w.id), contentType: w.contentType, title: w.title, cover: w.coverUrl, status: w.status });
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  p: 1,
                  borderRadius: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  cursor: rejected ? 'not-allowed' : 'pointer',
                  opacity: rejected ? 0.5 : 1,
                  '&:hover': rejected ? undefined : { borderColor: 'secondary.main', bgcolor: 'action.hover' },
                }}
              >
                <WorkThumb cover={w.coverUrl} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: 13, fontWeight: 600 }}>
                    {w.title || '(无标题)'}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                    {workTypeLabel(w.contentType)}
                    {w.publishTime ? ` · ${String(w.publishTime).slice(0, 10)}` : ''}
                  </Typography>
                </Box>
                <Chip size="small" label={WORK_STATUS_LABEL[w.status] || w.status || '-'} sx={{ height: 20, fontSize: 11 }} />
              </Box>
            );
          })}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={onClose}>
          取消
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function WorkThumb({ cover }: { cover?: string }) {
  return (
    <Box
      sx={{
        width: 44,
        height: 44,
        flexShrink: 0,
        borderRadius: 1,
        bgcolor: 'action.hover',
        backgroundImage: cover ? `url("${cover}")` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    />
  );
}

/** 交付作品卡片:点开作品详情页(新标签,不打断验收)。 */
export function DeliveredWork({ work, onRemove }: { work: TaskWorkRef; onRemove?: () => void }) {
  const href = getDetailRoute(work.contentType, work.id);
  const pending = work.status && work.status !== 'PUBLISH' && work.status !== 'active';
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        p: 1,
        mb: 1,
        borderRadius: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <WorkThumb cover={work.cover} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontSize: 13, fontWeight: 600 }}>
          {work.title || '(无标题)'}
        </Typography>
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
          {workTypeLabel(work.contentType)}
          {pending ? ` · ${WORK_STATUS_LABEL[work.status!] || work.status},通过审核后对方才能打开` : ''}
        </Typography>
      </Box>
      {href && (
        <Button size="small" href={href} target="_blank" endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />} sx={{ textTransform: 'none' }}>
          查看作品
        </Button>
      )}
      {onRemove && (
        <Button size="small" color="inherit" onClick={onRemove} sx={{ textTransform: 'none', color: 'text.secondary' }}>
          移除
        </Button>
      )}
    </Box>
  );
}

/** 与某用户开私信:建好(或找到)双方会话后跳到消息中心的那个会话。 */
export function useOpenDm(onError: (msg: string) => void) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const open = async (userId?: number | null) => {
    if (!userId) return;
    setOpening(true);
    try {
      const s = await openDmSession(userId);
      router.push(`/account/msg?tab=dm&session=${s.id}`);
    } catch (e) {
      onError(formatApiError(e) || '暂时无法私信');
    } finally {
      setOpening(false);
    }
  };
  return { open, opening };
}

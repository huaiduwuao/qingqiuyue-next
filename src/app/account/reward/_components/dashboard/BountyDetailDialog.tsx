'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import LinearProgress from '@mui/material/LinearProgress';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GroupIcon from '@mui/icons-material/Group';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import { alpha } from '@mui/material/styles';
import { getHotBounties, type Bounty } from '@/apis/dashboard';

/**
 * 悬赏详情弹层 —— 在悬赏中心 tab 内打开,不跳转任何路由。
 * 历史:RewardHotGrid 卡片曾 router.push('/account/reward/detail?id=...'),
 * 既破坏「纯客户端 tab」约定又污染浏览器历史(返回键要逐级退回)。
 * 现在由父组件持有 bountyId,本弹层按 id 从 hot 列表里挑一条展示。
 * (后端暂无单条 GET /reward/bounty/:id,先复用 dashboard 既有 endpoint。)
 */
export default function BountyDetailDialog({
  open,
  bountyId,
  onClose,
}: {
  open: boolean;
  bountyId: string | null;
  onClose: () => void;
}) {
  const hotQuery = useQuery({
    queryKey: ['reward', 'bounty', 'hot', 'detail-pool'],
    queryFn: () => getHotBounties({ limit: 50 }),
    staleTime: 30 * 1000,
    enabled: open,
  });
  const pool: Bounty[] = (hotQuery.data?.records ?? hotQuery.data?.list ?? []) as Bounty[];
  const found = bountyId ? pool.find((b) => b.id === bountyId) : undefined;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 2, bgcolor: 'background.paper' } } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, pt: 1.5 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary', flex: 1 }}>悬赏详情</Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }} aria-label="关闭">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <DialogContent sx={{ pt: 1 }}>
        {hotQuery.isLoading ? (
          <Box sx={{ py: 2 }}>
            <LinearProgress sx={{ borderRadius: 1 }} />
            <Typography sx={{ mt: 2, color: 'text.secondary', fontSize: 13 }}>正在加载悬赏详情…</Typography>
          </Box>
        ) : !found ? (
          <Box sx={{ py: 3 }}>
            <Typography variant="h6" sx={{ mb: 1, fontSize: 16 }}>未找到该悬赏</Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>
              id: {bountyId || '（空）'} · 可能已被下架或还未到上线时间。
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* 顶部 Hero */}
            <Box
              sx={{
                position: 'relative',
                borderRadius: 2,
                overflow: 'hidden',
                p: 2.5,
                background: found.gradient || `linear-gradient(135deg, ${alpha('#FE2C55', 0.18)}, ${alpha('#8B5CF6', 0.18)})`,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <WhatshotIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                <Chip
                  size="small"
                  label={`#${found.id}`}
                  sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: 'action.hover', color: 'text.secondary' }}
                />
                {found.category && (
                  <Chip
                    size="small"
                    label={found.category.toUpperCase()}
                    sx={{ height: 20, fontSize: 10, fontWeight: 600, bgcolor: 'action.hover', color: 'text.secondary' }}
                  />
                )}
              </Box>
              <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'text.primary', lineHeight: 1.3 }}>
                {found.title}
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1 }}>
                主办方:{found.sponsor}
              </Typography>
            </Box>

            {/* 三张数据卡 */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <CardGiftcardIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>总赏金</Typography>
                </Box>
                <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'text.primary', mt: 0.75, fontFamily: 'monospace' }}>
                  ¥{(found.reward / 100).toLocaleString('zh-CN')}
                </Typography>
              </Box>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <GroupIcon sx={{ fontSize: 16, color: 'secondary.main' }} />
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>已接悬赏</Typography>
                </Box>
                <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'text.primary', mt: 0.75, fontFamily: 'monospace' }}>
                  {found.applicants}
                </Typography>
              </Box>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <AccessTimeIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>剩余天数</Typography>
                </Box>
                <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'text.primary', mt: 0.75, fontFamily: 'monospace' }}>
                  {found.daysLeft} 天
                </Typography>
              </Box>
            </Box>

            {/* 任务说明 */}
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', mb: 0.75 }}>任务说明</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.7 }}>
                完整任务说明 / 提交流程待接入富文本或关联具体任务模块。当前弹层保证卡片可达 + 关键数据可见。
              </Typography>
            </Box>

            {/* 操作 */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
              <Button variant="outlined" onClick={onClose} sx={{ textTransform: 'none' }}>
                关闭
              </Button>
              <Button variant="contained" disabled sx={{ textTransform: 'none' }}>
                接下悬赏（暂未开放）
              </Button>
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

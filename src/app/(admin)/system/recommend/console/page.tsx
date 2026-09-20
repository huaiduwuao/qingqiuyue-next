'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  fetchBoostList,
  fetchProfileStats,
  fetchRecommendOverview,
  revokeBoost,
  setBoost,
} from '@/apis/admin-recommend';
import { formatApiError } from '@/lib/api/client';

const TYPE_LABEL: Record<string, string> = {
  VIDEO: '视频', ARTICLE: '文章', NOVEL: '小说', MUSIC: '音乐', FILM: '电影',
  TELEPLAY: '电视剧', ANIMATION: '动画', COMICS: '漫画', PICTURE: '图文', NEWS: '新闻', VSHOW: '短剧', LIVE: '直播',
};

const PAGE_SIZE = 20;

function pct(v?: number) {
  return v == null ? '-' : `${(v * 100).toFixed(2)}%`;
}

/** 推荐系统与用户画像控制台:CTR/CVR 指标、画像分布、强推/降权干预。 */
export default function RecommendConsolePage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; sev: 'success' | 'error' }>({ open: false, msg: '', sev: 'success' });

  // 干预表单
  const [contentId, setContentId] = useState('');
  const [action, setAction] = useState<'boost' | 'suppress'>('boost');
  const [weight, setWeight] = useState('2.0');
  const [reason, setReason] = useState('');

  const toast = (msg: string, sev: 'success' | 'error' = 'success') => setSnack({ open: true, msg, sev });

  const overview = useQuery({ queryKey: ['admin', 'recommend', 'overview'], queryFn: () => fetchRecommendOverview(7), refetchInterval: 60_000 });
  const profile = useQuery({ queryKey: ['admin', 'recommend', 'profile'], queryFn: fetchProfileStats, refetchInterval: 120_000 });
  const boosts = useQuery({ queryKey: ['admin', 'recommend', 'boost', page], queryFn: () => fetchBoostList(page, PAGE_SIZE) });

  const ov = overview.data;
  const pf = profile.data;
  const boostTotal = boosts.data?.total ?? 0;
  const boostPages = Math.max(1, Math.ceil(boostTotal / PAGE_SIZE));
  const userSplit = pf?.userSplit;
  const userTotal = (userSplit?.real ?? 0) + (userSplit?.bot ?? 0);

  const submitBoost = async () => {
    const w = Number(weight);
    if (!contentId.trim() || !Number.isFinite(w)) {
      toast('请填写内容 ID 与有效权重', 'error');
      return;
    }
    try {
      await setBoost({ contentId: contentId.trim(), action, weight: w, reason: reason.trim() || undefined });
      toast('已设置');
      setDialogOpen(false);
      setContentId('');
      setReason('');
      qc.invalidateQueries({ queryKey: ['admin', 'recommend', 'boost'] });
    } catch (e) {
      toast(formatApiError(e), 'error');
    }
  };

  const revoke = async (id: number | string) => {
    if (!window.confirm('确定撤销这条干预?')) return;
    try {
      await revokeBoost(id);
      toast('已撤销');
      qc.invalidateQueries({ queryKey: ['admin', 'recommend', 'boost'] });
    } catch (e) {
      toast(formatApiError(e), 'error');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 0.5 }}>算法与用户画像</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        推荐引擎效果指标、全站画像分布,以及内容强推/降权干预。
      </Typography>

      {/* 指标卡 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 1.5, mb: 3 }}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary">推荐 CTR(近7天)</Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>{pct(ov?.ctr)}</Typography>
          <Typography variant="caption" color="text.secondary">点击 {ov?.clicks ?? '-'} / 曝光 {ov?.exposures ?? '-'}</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary">推荐 CVR(近7天)</Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>{pct(ov?.cvr)}</Typography>
          <Typography variant="caption" color="text.secondary">转化 {ov?.conversions ?? '-'}</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary">真人 / AI 用户</Typography>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {userSplit ? `${userSplit.real} / ${userSplit.bot}` : '-'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {userTotal > 0 ? `真人占比 ${(((userSplit?.real ?? 0) / userTotal) * 100).toFixed(1)}%` : '—'}
          </Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary">生效中的干预</Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'warning.main' }}>{boostTotal}</Typography>
          <Typography variant="caption" color="text.secondary">强推 / 降权</Typography>
        </Paper>
      </Box>
      {ov?.note && <Alert severity="info" sx={{ mb: 3 }}>{ov.note}</Alert>}

      {/* 画像分布 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 3 }}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography sx={{ fontWeight: 700, mb: 1.5 }}>画像标签云(Top)</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {(pf?.tagCloud ?? []).length === 0 && <Typography variant="caption" color="text.secondary">暂无数据</Typography>}
            {(pf?.tagCloud ?? []).map((t) => (
              <Chip
                key={t.tag}
                label={`${t.tag} ${t.count}`}
                size="small"
                variant="outlined"
                sx={{ fontSize: Math.min(15, 11 + Math.log2(t.count + 1)) }}
              />
            ))}
          </Box>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography sx={{ fontWeight: 700, mb: 1.5 }}>兴趣类型分布</Typography>
          {(pf?.typeDist ?? []).length === 0 && <Typography variant="caption" color="text.secondary">暂无数据</Typography>}
          {(pf?.typeDist ?? []).map((t) => {
            const max = Math.max(...(pf?.typeDist ?? []).map((x) => x.count), 1);
            return (
              <Box key={t.type} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                <Typography sx={{ width: 56, fontSize: 12 }}>{TYPE_LABEL[t.type] || t.type}</Typography>
                <Box sx={{ flex: 1, height: 8, bgcolor: 'action.hover', borderRadius: 1, overflow: 'hidden' }}>
                  <Box sx={{ width: `${(t.count / max) * 100}%`, height: '100%', bgcolor: 'primary.main' }} />
                </Box>
                <Typography sx={{ width: 48, fontSize: 12, textAlign: 'right' }}>{t.count}</Typography>
              </Box>
            );
          })}
        </Paper>
      </Box>

      {/* 强推/降权 */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography sx={{ fontWeight: 700, flex: 1 }}>内容强推 / 降权</Typography>
          <Button variant="contained" size="small" onClick={() => setDialogOpen(true)}>新增干预</Button>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>内容 ID</TableCell>
                <TableCell>动作</TableCell>
                <TableCell>权重</TableCell>
                <TableCell>原因</TableCell>
                <TableCell>过期时间</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {boosts.isLoading ? (
                <TableRow><TableCell colSpan={6} align="center">加载中...</TableCell></TableRow>
              ) : (boosts.data?.list.length ?? 0) === 0 ? (
                <TableRow><TableCell colSpan={6} align="center">暂无干预</TableCell></TableRow>
              ) : (
                boosts.data!.list.map((b) => (
                  <TableRow key={String(b.id)}>
                    <TableCell>{String(b.contentId)}</TableCell>
                    <TableCell>
                      <Chip size="small" label={b.action === 'boost' ? '强推' : '降权'} color={b.action === 'boost' ? 'success' : 'warning'} variant="outlined" />
                    </TableCell>
                    <TableCell>{b.weight}</TableCell>
                    <TableCell>{b.reason || '-'}</TableCell>
                    <TableCell>{b.expireAt ? new Date(b.expireAt).toLocaleString('zh-CN') : '永久'}</TableCell>
                    <TableCell>
                      <Button size="small" color="error" onClick={() => revoke(b.id)}>撤销</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, gap: 2 }}>
          <Button variant="outlined" size="small" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>上一页</Button>
          <Typography sx={{ alignSelf: 'center' }}>{page} / {boostPages}</Typography>
          <Button variant="outlined" size="small" onClick={() => setPage((p) => p + 1)} disabled={page >= boostPages}>下一页</Button>
        </Box>
      </Paper>

      {/* 新增干预 */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>新增内容干预</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField size="small" label="内容 ID" value={contentId} onChange={(e) => setContentId(e.target.value)} />
          <TextField select size="small" label="动作" value={action} onChange={(e) => setAction(e.target.value as 'boost' | 'suppress')}>
            <MenuItem value="boost">强推(Boost)</MenuItem>
            <MenuItem value="suppress">降权(Suppress)</MenuItem>
          </TextField>
          <TextField
            size="small"
            label="权重"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            helperText={action === 'boost' ? '>1 加权,如 2.0 = 双倍分' : '0~1 降权,0 = 沉底'}
          />
          <TextField size="small" label="原因(可选)" value={reason} onChange={(e) => setReason(e.target.value)} multiline rows={2} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} size="small">取消</Button>
          <Button variant="contained" size="small" onClick={submitBoost}>确定</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={2500} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={snack.sev} variant="filled" sx={{ width: '100%' }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}

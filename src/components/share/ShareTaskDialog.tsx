'use client';

/**
 * 「分享到抖音 / 快手」对话框
 *
 *   弹出后:
 *     1) 拉当前用户在指定 platform 的已授权账号
 *     2) 用户选账号 + 选立即/定时 + 编辑文案
 *     3) 调 POST /share/create;成功后立即 publish OR scheduled
 *     4) 失败提示(资质未下来 / 网络 / 账号未授权等)
 *
 *  小红书不弹此对话框(走 ShareButtons.xhsShare → ShareCardPreview 引导式)
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  Typography,
  Alert,
  Chip,
  CircularProgress,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  listAccounts,
  createTask,
  type PlatformAccountBrief,
} from '@/apis/share';
import { PLATFORMS, platformLabel } from '@/apis/system-platform-account';

export interface ShareTaskDialogProps {
  open: boolean;
  onClose: () => void;
  platform: 'douyin' | 'kuaishou'; // 小红书走另外的引导式 UI
  contentType: string;
  contentId: number;
  defaultTitle: string;
  defaultVideoUrl?: string;
  defaultCoverUrl?: string;
  defaultTags?: string[];
  topicId?: string;
  onSuccess?: () => void;
}

export default function ShareTaskDialog(props: ShareTaskDialogProps) {
  const {
    open, onClose, platform,
    contentType, contentId,
    defaultTitle, defaultVideoUrl, defaultCoverUrl, defaultTags, topicId,
    onSuccess,
  } = props;

  const [accounts, setAccounts] = useState<PlatformAccountBrief[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accountId, setAccountId] = useState<number>(0);
  const [title, setTitle] = useState(defaultTitle);
  const [videoUrl, setVideoUrl] = useState(defaultVideoUrl || '');
  const [coverUrl, setCoverUrl] = useState(defaultCoverUrl || '');
  const [tagsText, setTagsText] = useState((defaultTags || []).join(' '));
  const [scheduled, setScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(''); // datetime-local
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(defaultTitle);
    setVideoUrl(defaultVideoUrl || '');
    setCoverUrl(defaultCoverUrl || '');
    setTagsText((defaultTags || []).join(' '));
    setScheduled(false);
    setScheduledAt('');
    setError(null);
    setSuccess(null);
    setLoadingAccounts(true);
    listAccounts(platform)
      .then((data: any) => {
        const list = Array.isArray(data) ? data : data?.list || [];
        setAccounts(list);
        if (list.length > 0) setAccountId(list[0].id);
      })
      .catch((e: any) => setError(e?.message || '拉账号列表失败'))
      .finally(() => setLoadingAccounts(false));
  }, [open, platform, defaultTitle, defaultVideoUrl, defaultCoverUrl, defaultTags]);

  const platformMeta = useMemo(
    () => PLATFORMS.find((p) => p.value === platform),
    [platform]
  );

  const handleSubmit = async () => {
    if (!accountId) {
      setError('请选择目标账号');
      return;
    }
    if (!title.trim()) {
      setError('标题不能为空');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const tags = tagsText
        .split(/[\s,，]+/)
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);
      let scheduledAtSec: number | undefined;
      if (scheduled && scheduledAt) {
        const ts = new Date(scheduledAt).getTime();
        if (Number.isNaN(ts)) {
          setError('定时时间格式不正确');
          setSubmitting(false);
          return;
        }
        if (ts <= Date.now()) {
          setError('定时时间必须晚于当前时间');
          setSubmitting(false);
          return;
        }
        scheduledAtSec = Math.floor(ts / 1000);
      }
      await createTask({
        socialAccountId: accountId,
        contentType,
        contentId,
        title,
        videoUrl: videoUrl || undefined,
        coverUrl: coverUrl || undefined,
        tags: tags.length ? tags : undefined,
        topicId,
        scheduledAt: scheduledAtSec,
      });
      setSuccess(scheduledAtSec ? `已加入定时队列(${new Date(scheduledAt).toLocaleString('zh-CN')})` : '已加入发布队列,稍后会自动发布');
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (e: any) {
      setError(e?.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>分享到 {platformMeta?.label}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {loadingAccounts ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} />
              <Typography sx={{ fontSize: 13 }}>加载账号列表…</Typography>
            </Box>
          ) : accounts.length === 0 ? (
            <Alert severity="warning">
              你还没有 {platformMeta?.label} 平台已授权账号。请到「我的设置 → 第三方平台账号」先绑定,或管理员在后台「自媒体平台账号」完成 OAuth 授权。
            </Alert>
          ) : (
            <Box>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>目标账号</Typography>
              <TextField
                select
                fullWidth
                size="small"
                value={accountId}
                onChange={(e) => setAccountId(parseInt(e.target.value, 10))}
              >
                {accounts.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ fontSize: 13 }}>{a.accountName}</Typography>
                      {a.platformUserNickname && (
                        <Chip
                          label={a.platformUserNickname}
                          size="small"
                          variant="outlined"
                          sx={{ height: 18, fontSize: 10 }}
                        />
                      )}
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          )}

          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>标题</Typography>
            <TextField
              fullWidth
              size="small"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              multiline
              maxRows={3}
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>视频 URL(可选)</Typography>
            <TextField
              fullWidth
              size="small"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://..."
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>封面 URL(可选)</Typography>
            <TextField
              fullWidth
              size="small"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://..."
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>话题 / 标签(空格分隔)</Typography>
            <TextField
              fullWidth
              size="small"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="如 漫画 玄幻 推荐"
            />
          </Box>

          <FormControlLabel
            control={<Switch checked={scheduled} onChange={(e) => setScheduled(e.target.checked)} />}
            label="定时发布"
          />
          {scheduled && (
            <TextField
              type="datetime-local"
              size="small"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting || accounts.length === 0}>
          {submitting ? '提交中…' : scheduled ? '加入定时' : '立即发布'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
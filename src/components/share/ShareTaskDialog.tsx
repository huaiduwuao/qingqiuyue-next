'use client';

/**
 * 「分享到抖音 / 快手 / YouTube / TikTok」对话框
 *
 *   弹出后:
 *     1) 拉当前用户在指定 platform 的已授权账号
 *     2) 用户选账号 + 选立即/定时 + 编辑文案
 *     3) 调 POST /share/create;成功后立即 publish OR scheduled
 *     4) 失败提示(资质未下来 / 网络 / 账号未授权等)
 *
 *  YouTube / TikTok:只能由清秋月上传本站视频(不填 video_id / 封面),多一个正文和可见性;
 *  平台应用未过审时后端一律按私享 / 仅自己可见发,这里先提示。定时发布由后端队列到点再发,各平台通用。
 *
 *  小红书不弹此对话框(走 ShareButtons.xhsShare → ShareCardPreview 引导式)
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import NextLink from 'next/link';
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
  Link as MuiLink,
} from '@mui/material';
import {
  listAccounts,
  createTask,
  type PlatformAccountBrief,
} from '@/apis/share';
import { PLATFORMS, platforms as listPlatforms, type SharePlatformInfo } from '@/apis/share-account';
import type { EntityId } from '@/lib/id';
import { errMessage } from '@/lib/errMessage';

export type ShareTaskPlatform = 'douyin' | 'kuaishou' | 'youtube' | 'tiktok';

/** 海外平台:不收 video_id / 封面,有正文与可见性 */
export const isIntlSharePlatform = (p: string): p is 'youtube' | 'tiktok' => p === 'youtube' || p === 'tiktok';

const PRIVACY_OPTIONS: Record<'youtube' | 'tiktok', { value: string; label: string }[]> = {
  youtube: [
    { value: 'private', label: '私享(仅自己)' },
    { value: 'unlisted', label: '不公开(有链接可看)' },
    { value: 'public', label: '公开' },
  ],
  tiktok: [
    { value: 'private', label: '仅自己可见' },
    { value: 'friends', label: '互关好友' },
    { value: 'followers', label: '粉丝' },
    { value: 'public', label: '公开' },
  ],
};

export interface ShareTaskDialogProps {
  open: boolean;
  onClose: () => void;
  platform: ShareTaskPlatform; // 小红书走另外的引导式 UI
  contentType: string;
  contentId: EntityId;
  defaultTitle: string;
  defaultVideoUrl?: string; // deprecated:已不再使用,保留仅为不影响调用方
  defaultCoverUrl?: string;
  defaultTags?: string[];
  topicId?: string;
  onSuccess?: () => void;
}

const EMPTY_ACCOUNTS: PlatformAccountBrief[] = [];

export default function ShareTaskDialog(props: ShareTaskDialogProps) {
  const {
    open, onClose, platform,
    contentType, contentId,
    defaultTitle, defaultCoverUrl, defaultTags, topicId,
    onSuccess,
  } = props;

  // 账号列表走 react-query:每次打开都后台刷新一次(可能刚去绑定了新账号),
  // 但先显示缓存,不再每次打开都闪「加载账号列表…」。
  const accountsQ = useQuery({
    queryKey: ['share-accounts', platform],
    queryFn: async (): Promise<PlatformAccountBrief[]> => {
      const data = (await listAccounts(platform)) as PlatformAccountBrief[] | { list?: PlatformAccountBrief[] } | null;
      return Array.isArray(data) ? data : data?.list || [];
    },
    enabled: open,
    staleTime: 0,
  });
  const accounts = accountsQ.data ?? EMPTY_ACCOUNTS;
  const intl = isIntlSharePlatform(platform);
  // 海外平台:应用是否还在审核(只能私享);旧后端没有这个接口就当没限制
  const infoQ = useQuery({
    queryKey: ['share-platforms'],
    queryFn: async () => {
      try {
        return (await listPlatforms()) ?? [];
      } catch {
        return [] as SharePlatformInfo[];
      }
    },
    enabled: open && intl,
    staleTime: 5 * 60_000,
  });
  const privateOnly = intl && !!(infoQ.data ?? []).find((x) => x.platform === platform)?.privateOnly;
  const loadingAccounts = accountsQ.isLoading;
  // 用户选过且仍在列表里就用它,否则默认第一个(与原来「加载完选中第一个」一致)
  const [pickedAccountId, setAccountId] = useState<number>(0);
  const accountId = accounts.some((a) => a.id === pickedAccountId) ? pickedAccountId : (accounts[0]?.id ?? 0);
  const [title, setTitle] = useState(defaultTitle);
  const [videoId, setVideoId] = useState('');
  const [coverUrl, setCoverUrl] = useState(defaultCoverUrl || '');
  const [tagsText, setTagsText] = useState((defaultTags || []).join(' '));
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState('private');
  const [scheduled, setScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(''); // datetime-local
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(defaultTitle);
    setVideoId('');
    setCoverUrl(defaultCoverUrl || '');
    setTagsText((defaultTags || []).join(' '));
    setDescription('');
    setPrivacy('private');
    setScheduled(false);
    setScheduledAt('');
    setError(null);
    setSuccess(null);
    setAccountId(0);
  }, [open, platform, defaultTitle, defaultCoverUrl, defaultTags]);
  const loadError = accountsQ.error ? accountsQ.error.message || '拉账号列表失败' : null;
  const shownError = error ?? loadError;

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
        tags: tags.length ? tags : undefined,
        topicId,
        ...(intl
          ? { description: description.trim() || undefined, privacy: privateOnly ? 'private' : privacy }
          : {
              videoId: videoId.trim() || undefined, // 留空 = 后端自动上传本站视频
              coverUrl: coverUrl || undefined,
            }),
        scheduledAt: scheduledAtSec,
      });
      setSuccess(scheduledAtSec ? `已加入定时队列(${new Date(scheduledAt).toLocaleString('zh-CN')})` : '已加入发布队列,稍后会自动发布');
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (e) {
      setError(errMessage(e) || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>分享到 {platformMeta?.label}</DialogTitle>
      <DialogContent>
        {shownError && <Alert severity="error" sx={{ mb: 2 }}>{shownError}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
        {privateOnly && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {platform === 'youtube'
              ? '清秋月的 YouTube 应用还在审核中:视频只能以「私享」上传,发出后需要你在 YouTube Studio 里手动改为公开。'
              : '清秋月的 TikTok 应用还在审核中:只能「仅自己可见」发布,且要求 TikTok 账号本身设为私密;发出后需要你在 TikTok App 里手动改可见性。'}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {loadingAccounts ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} />
              <Typography sx={{ fontSize: 13 }}>加载账号列表…</Typography>
            </Box>
          ) : accounts.length === 0 ? (
            <Alert severity="warning">
              你还没有 {platformMeta?.label} 平台已授权账号。
              <MuiLink component={NextLink} href="/account/content?tab=accounts" sx={{ ml: 0.5 }}>
                去绑定
              </MuiLink>
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

          {intl ? (
            <>
              <Box>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>正文(可选)</Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  multiline
                  minRows={2}
                  maxRows={6}
                  helperText="清秋月会上传本站视频;竖屏且不超过 3 分钟的视频在 YouTube 会归为 Shorts"
                />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>可见性</Typography>
                <TextField
                  select
                  fullWidth
                  size="small"
                  value={privateOnly ? 'private' : privacy}
                  disabled={privateOnly}
                  onChange={(e) => setPrivacy(e.target.value)}
                  helperText={privateOnly ? '应用审核通过前只能这样发' : undefined}
                >
                  {PRIVACY_OPTIONS[platform as 'youtube' | 'tiktok'].map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
            </>
          ) : (
          <>
          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              视频 ID (video_id,可选)
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={videoId}
              onChange={(e) => setVideoId(e.target.value)}
              placeholder="如 v0200f9c0000bv9..."
              helperText="留空将自动上传本站视频(仅限在清秋月上传的视频)"
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
          </>
          )}

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
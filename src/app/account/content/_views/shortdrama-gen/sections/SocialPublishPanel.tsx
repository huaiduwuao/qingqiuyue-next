'use client';

/**
 * 后期 · 发布到 YouTube / TikTok。
 *
 * 只由用户点按钮触发(一键流水线不会发):把当前集当前语种的成片,用你在「创作者中心 → 平台账号」
 * 绑定的 YouTube / TikTok 账号上传出去。上传在 core-api 里异步进行,结果按账号记在
 * episode.distribution[语种][youtube_shorts|tiktok].posts 里;有进行中的记录时每 5 秒拉一次进度。
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { dramaAPI, type Episode, type SocialPostRecord } from '@/apis/shortdrama';
import { listAccounts, type PlatformAccountBrief } from '@/apis/share';
import { platforms as listPlatforms, type SharePlatformInfo } from '@/apis/share-account';

/** 工作台平台 code ↔ 平台账号的 platform */
const SOCIAL = [
  { code: 'youtube_shorts', platform: 'youtube', name: 'YouTube Shorts' },
  { code: 'tiktok', platform: 'tiktok', name: 'TikTok' },
] as const;

const STATUS: Record<SocialPostRecord['status'], { label: string; color: 'default' | 'primary' | 'success' | 'error' }> = {
  pending: { label: '排队中', color: 'default' },
  uploading: { label: '上传中', color: 'primary' },
  publishing: { label: '发布中', color: 'primary' },
  success: { label: '已发布', color: 'success' },
  failed: { label: '失败', color: 'error' },
};

const PRIVACY_LABEL: Record<string, string> = {
  private: '私享',
  unlisted: '不公开(有链接可看)',
  public: '公开',
  SELF_ONLY: '仅自己可见',
  PUBLIC_TO_EVERYONE: '公开',
  MUTUAL_FOLLOW_FRIENDS: '互关好友',
  FOLLOWER_OF_CREATOR: '粉丝',
};

const inFlight = (r: SocialPostRecord) => r.status === 'pending' || r.status === 'uploading' || r.status === 'publishing';

/** 某语种下所有发布记录 */
export function socialPosts(ep: Episode, lang: string): (SocialPostRecord & { code: string })[] {
  const out: (SocialPostRecord & { code: string })[] = [];
  for (const s of SOCIAL) {
    const posts = ep.distribution?.[lang]?.[s.code]?.posts ?? {};
    for (const r of Object.values(posts)) out.push({ ...r, code: s.code });
  }
  return out;
}

async function accountsOf(platform: string): Promise<PlatformAccountBrief[]> {
  try {
    const r = (await listAccounts(platform)) as PlatformAccountBrief[] | { list?: PlatformAccountBrief[] } | null;
    return Array.isArray(r) ? r : (r?.list ?? []);
  } catch {
    return [];
  }
}

export default function SocialPublishPanel({
  episode,
  lang,
  langName,
  onChanged,
}: {
  episode: Episode;
  lang: string;
  langName: string;
  onChanged: () => void;
}) {
  const accounts = useQuery({
    queryKey: ['share-accounts', 'intl'],
    queryFn: async () => {
      const [yt, tt] = await Promise.all([accountsOf('youtube'), accountsOf('tiktok')]);
      return [...yt, ...tt];
    },
    staleTime: 60_000,
  });
  const infos = useQuery({
    queryKey: ['share-platforms'],
    queryFn: async () => {
      try {
        return (await listPlatforms()) ?? [];
      } catch {
        return [] as SharePlatformInfo[];
      }
    },
    staleTime: 5 * 60_000,
  });

  const authed = useMemo(() => (accounts.data ?? []).filter((a) => a.authStatus === 1), [accounts.data]);
  const [picked, setPicked] = useState<number[] | null>(null); // null = 全选
  const [privacy, setPrivacy] = useState('private');
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ severity: 'success' | 'warning' | 'error'; text: string } | null>(null);

  const selected = picked ?? authed.map((a) => a.id);
  const final = episode.finals?.[lang];
  const posts = socialPosts(episode, lang);
  const pending = posts.some(inFlight);
  const privateOnly = (infos.data ?? []).filter((i) => i.privateOnly && SOCIAL.some((s) => s.platform === i.platform));

  // 有进行中的记录:每 5 秒去 core-api 取一次进度
  useEffect(() => {
    if (!pending) return;
    let stop = false;
    const timer = setInterval(async () => {
      try {
        await dramaAPI.socialRefresh(episode.id);
        if (!stop) onChanged();
      } catch {
        // 刷新失败下次再试
      }
    }, 5000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [pending, episode.id, onChanged]);

  const publish = async () => {
    if (!final?.url || selected.length === 0) return;
    const names = authed
      .filter((a) => selected.includes(a.id))
      .map((a) => `${a.platform === 'youtube' ? 'YouTube' : 'TikTok'}「${a.platformUserNickname || a.accountName}」`)
      .join('、');
    if (!window.confirm(`把第 ${episode.no} 集${langName}版成片发布到:${names}?\n可见性:${PRIVACY_LABEL[privacy] ?? privacy}`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const platforms = SOCIAL.filter((s) => authed.some((a) => selected.includes(a.id) && a.platform === s.platform)).map((s) => s.code);
      const r = await dramaAPI.socialPost(episode.id, { lang, platforms, account_ids: selected, privacy, force });
      const notes = [...(r.skipped ?? []), ...(r.errors ?? [])];
      const head = r.created ? `已提交 ${r.created} 个上传任务` : r.reused ? '上传还在进行中' : '没有新提交的任务';
      setMsg({ severity: r.errors?.length ? 'warning' : r.created || r.reused ? 'success' : 'warning', text: [head, ...notes].join(';') });
      onChanged();
    } catch (e) {
      setMsg({ severity: 'error', text: e instanceof Error ? e.message : '发布失败' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        发布到 YouTube / TikTok · {langName}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        用你绑定的账号上传这一集的{langName}版成片,标题和文案取上面对应平台的分发文案。只有你点了才会发,已经发成功的账号不会重复上传。
      </Typography>
      {privateOnly.length > 0 && (
        <Alert severity="warning" sx={{ mb: 1 }}>
          {privateOnly.map((i) => (i.platform === 'youtube' ? 'YouTube' : 'TikTok')).join(' / ')} 的清秋月应用还在审核中:视频只能以「私享 / 仅自己可见」发布,发出后需要你在平台里手动改为公开
          {privateOnly.some((i) => i.platform === 'tiktok') ? ';TikTok 还要求账号本身设为私密' : ''}。
        </Alert>
      )}
      {msg && (
        <Alert severity={msg.severity} sx={{ mb: 1 }} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}

      {accounts.isLoading ? (
        <Typography variant="body2" color="text.secondary">
          读取账号…
        </Typography>
      ) : authed.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          还没有已授权的 YouTube / TikTok 账号。先到
          <Link href="/account/content?tab=accounts" sx={{ mx: 0.5 }}>
            创作者中心 → 平台账号
          </Link>
          一键绑定。
        </Typography>
      ) : (
        <>
          <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
            {authed.map((a) => (
              <FormControlLabel
                key={a.id}
                sx={{ mr: 1.5 }}
                control={
                  <Checkbox
                    size="small"
                    checked={selected.includes(a.id)}
                    onChange={(ev) => setPicked(ev.target.checked ? [...selected, a.id] : selected.filter((x) => x !== a.id))}
                  />
                }
                label={<Typography variant="body2">{`${a.platform === 'youtube' ? 'YouTube' : 'TikTok'} · ${a.platformUserNickname || a.accountName}`}</Typography>}
              />
            ))}
          </Stack>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center', mt: 1 }}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>可见性</InputLabel>
              <Select label="可见性" value={privacy} onChange={(ev) => setPrivacy(ev.target.value)}>
                <MenuItem value="private">私享(推荐,先自己看一遍)</MenuItem>
                <MenuItem value="unlisted">不公开(仅 YouTube,有链接可看)</MenuItem>
                <MenuItem value="public">公开</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={<Checkbox size="small" checked={force} onChange={(ev) => setForce(ev.target.checked)} />}
              label={<Typography variant="caption">已发成功的也重发</Typography>}
            />
            <Button variant="contained" size="small" disabled={busy || !final?.url || selected.length === 0} onClick={publish}>
              {busy ? '提交中…' : '发布到 YouTube / TikTok'}
            </Button>
            {!final?.url && (
              <Typography variant="caption" color="text.secondary">
                还没有{langName}版成片,先合成
              </Typography>
            )}
          </Stack>
        </>
      )}

      {posts.length > 0 && (
        <Stack spacing={1} sx={{ mt: 1.5 }}>
          {posts.map((r) => {
            const meta = STATUS[r.status] ?? STATUS.pending;
            return (
              <Box key={`${r.code}-${r.account_id}`} sx={{ p: 1, borderRadius: 1, border: 1, borderColor: 'divider' }}>
                <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {SOCIAL.find((s) => s.code === r.code)?.name ?? r.code} · {r.account_name}
                  </Typography>
                  <Chip size="small" color={meta.color} label={meta.label} />
                  {r.privacy && <Chip size="small" variant="outlined" label={PRIVACY_LABEL[r.privacy] ?? r.privacy} />}
                  {r.remote_url && (
                    <Link href={r.remote_url} target="_blank" rel="noreferrer" variant="body2">
                      打开
                    </Link>
                  )}
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                    {r.at ? new Date(r.at).toLocaleString('zh-CN', { hour12: false }) : ''}
                  </Typography>
                </Stack>
                {r.notice && (
                  <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
                    {r.notice}
                  </Typography>
                )}
                {r.status === 'failed' && r.error && (
                  <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5, wordBreak: 'break-word' }}>
                    {r.error}
                  </Typography>
                )}
              </Box>
            );
          })}
        </Stack>
      )}
    </Paper>
  );
}

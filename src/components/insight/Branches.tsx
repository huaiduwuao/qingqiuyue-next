'use client';

// 人生感悟的分支:跟着实时热点和大家的心事自动开出来的 (主题, 线索词)。
//
// BranchStrip 列开着的分支(首页列全部,主题页只列本主题的),没有就什么都不渲染;
// NeedBox 是「此刻在想什么」—— 写一句,回给你相近的主题和分支。原话不上传保存,
// 登录时后端只记下命中了哪些词,够多人写到同一个词,那个分支就开了。

import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import { branches as fetchBranches, need as postNeed, type InsightBranch } from '@/apis/insight';
import { accentOf } from '@/components/insight/InsightCards';
import { useTopicImpressions } from '@/lib/topicTrack';

const SERIF = '"Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, serif';

/** 几分钟 / 几小时 / 几天前 */
export function ago(ts: number): string {
  if (!ts) return '';
  const s = Math.max(0, Date.now() / 1000 - ts);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} 分钟前`;
  if (s < 86400) return `${Math.round(s / 3600)} 小时前`;
  return `${Math.round(s / 86400)} 天前`;
}

/** 这个分支为什么开着:热搜 / 心事 / 搜索,有几样说几样。 */
export function branchSignals(b: InsightBranch): string[] {
  const out: string[] = [];
  if (b.hotCount) out.push(`热搜 ${b.hotCount} 条`);
  if (b.needUsers) out.push(`${b.needUsers} 人写下相近的心事`);
  if (b.searchUsers) out.push(`${b.searchUsers} 人搜过`);
  return out;
}

export function branchHref(key: string) {
  return `/insight/branch?key=${encodeURIComponent(key)}`;
}

export function BranchCard({ b, showTheme = true }: { b: InsightBranch; showTheme?: boolean }) {
  const router = useRouter();
  const accent = accentOf(b.group);
  return (
    <Box
      onClick={() => router.push(branchHref(b.key))}
      sx={{
        p: 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderLeft: `3px solid ${accent}`,
        cursor: 'pointer',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color .15s, transform .15s',
        '&:hover': { borderColor: accent, transform: 'translateY(-2px)' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, minWidth: 0 }}>
        <Typography sx={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700, color: accent, letterSpacing: '0.08em' }}>
          {b.cue}
        </Typography>
        {showTheme && (
          <Typography sx={{ fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap' }}>· {b.themeName}</Typography>
        )}
        <Typography sx={{ fontSize: 11, color: 'text.disabled', ml: 'auto', whiteSpace: 'nowrap' }}>
          {b.forYou ? '你可能在意 · ' : ''}
          {ago(b.lastSignal)}
        </Typography>
      </Box>
      {b.headline && (
        <Typography
          sx={{
            fontSize: 13,
            lineHeight: 1.7,
            mt: 0.75,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {b.headline}
        </Typography>
      )}
      <Typography sx={{ fontSize: 11.5, color: 'text.disabled', mt: 'auto', pt: 1 }}>
        {[...branchSignals(b), `相关作品 ${b.works.toLocaleString()}`].join(' · ')}
      </Typography>
    </Box>
  );
}

/** 开着的分支。theme 给了就只列这个主题下的;exclude 是当前页的分支。没有分支时不渲染。 */
export function BranchStrip({
  theme,
  title,
  exclude,
  limit = 12,
}: {
  theme?: string;
  title?: string;
  exclude?: string;
  limit?: number;
}) {
  const q = useQuery({
    queryKey: ['insight', 'branches', theme || '', limit],
    queryFn: () => fetchBranches({ theme, limit }),
    staleTime: 5 * 60_000,
  });
  const list = (q.data?.list ?? []).filter((b) => b.key !== exclude);
  useTopicImpressions(list.map((b) => b.key));
  if (!list.length) return null;
  return (
    <Box sx={{ mb: 5 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 0.5, flexWrap: 'wrap' }}>
        <Typography sx={{ fontFamily: SERIF, fontSize: theme ? 17 : 22, fontWeight: 700, letterSpacing: '0.12em' }}>
          {title || '此刻'}
        </Typography>
        <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>
          跟着热点和大家的心事自动长出来的分支{q.data?.personalized ? ' · 按你的偏好排' : ''}
        </Typography>
      </Box>
      <Box
        sx={{
          mt: 1.5,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' },
          gap: 1.5,
        }}
      >
        {list.map((b) => (
          <BranchCard key={b.key} b={b} showTheme={!theme} />
        ))}
      </Box>
    </Box>
  );
}

/** 此刻在想什么:写一句,回给你相近的主题和分支。 */
export function NeedBox() {
  const router = useRouter();
  const [text, setText] = React.useState('');
  const m = useMutation({ mutationFn: (t: string) => postNeed(t) });
  const submit = () => {
    const t = text.trim();
    if (t) m.mutate(t);
  };
  const r = m.data;
  const empty = r && !r.themes.length && !r.branches.length;
  return (
    <Box sx={{ mb: 5, p: { xs: 2, md: 2.5 }, borderRadius: 2, border: '1px dashed', borderColor: 'divider' }}>
      <Typography sx={{ fontSize: 15, fontWeight: 600, mb: 1 }}>此刻在想什么</Typography>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
        <TextField
          size="small"
          fullWidth
          placeholder="比如:加班到很晚,突然很想家"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit();
          }}
          slotProps={{ htmlInput: { maxLength: 300 } }}
        />
        <Button variant="outlined" onClick={submit} disabled={!text.trim() || m.isPending} sx={{ flexShrink: 0 }}>
          找找
        </Button>
      </Box>
      {r && (
        <Box sx={{ mt: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          {empty && (
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
              没找到相近的主题。换个说法试试,或者从下面的主题慢慢看。
            </Typography>
          )}
          {r.branches.map((b) => (
            <Box
              key={b.key}
              onClick={() => router.push(branchHref(b.key))}
              sx={{
                px: 1.5,
                py: 0.5,
                borderRadius: 5,
                fontSize: 13,
                cursor: 'pointer',
                color: '#fff',
                bgcolor: accentOf(b.group),
              }}
            >
              {b.cue} · {b.themeName}
            </Box>
          ))}
          {r.themes.map((t) => (
            <Box
              key={t.key}
              onClick={() => router.push(`/insight/theme?key=${encodeURIComponent(t.key)}`)}
              sx={{
                px: 1.5,
                py: 0.5,
                borderRadius: 5,
                fontSize: 13,
                cursor: 'pointer',
                border: '1px solid',
                borderColor: accentOf(t.group),
                color: accentOf(t.group),
              }}
            >
              {t.name}
            </Box>
          ))}
        </Box>
      )}
      <Typography sx={{ fontSize: 11, color: 'text.disabled', mt: 1 }}>
        你写的话不会保存。登录时只记下其中命中的词(比如「加班」「想家」),够多人写到同一个词,就会开出新的分支。
      </Typography>
    </Box>
  );
}

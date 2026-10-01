'use client';

// 文明图谱的公共部件:领域配色、节点卡、来源标签、「接一枝」表单。

import React from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import { graft, type CivNode, type CivOrigin } from '@/apis/civ';
import { ago } from '@/components/insight/Branches';
import { useAuth } from '@/contexts/AuthContext';
import { loginHref } from '@/lib/auth/redirect';

export const SERIF = '"Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, serif';

export const CIV_ACCENT: Record<string, string> = {
  society: '#B5651D',
  culture: '#8E5BA8',
  tech: '#2E86AB',
  politics: '#A23B3B',
  military: '#5B7042',
  livelihood: '#C98A1B',
  economy: '#2F7D6D',
  history: '#7A5C3E',
};
export const civAccent = (domain?: string) => CIV_ACCENT[domain || ''] || '#2E86AB';

export const ORIGIN_LABEL: Record<CivOrigin, string> = {
  editorial: '支架',
  hot: '热点长出',
  search: '搜索长出',
  user: '用户嫁接',
};

export const civHref = (key: string) => `/civ/node?key=${encodeURIComponent(key)}`;

/** 为什么开着:热搜 / 搜索,有几样说几样 */
export function civSignals(n: CivNode): string[] {
  const out: string[] = [];
  if (n.hotCount) out.push(`热搜 ${n.hotCount} 条`);
  if (n.searchUsers) out.push(`${n.searchUsers} 人搜过`);
  return out;
}

/** 长出来的分支卡 */
export function GrownCard({ n, showParent = true }: { n: CivNode; showParent?: boolean }) {
  const router = useRouter();
  const accent = civAccent(n.domain);
  return (
    <Box
      onClick={() => router.push(civHref(n.key))}
      sx={{
        p: 1.5,
        borderRadius: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        borderLeft: `3px solid ${accent}`,
        cursor: 'pointer',
        minWidth: 0,
        opacity: n.status === 'pending' ? 0.7 : 1,
        '&:hover': { borderColor: accent },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, minWidth: 0 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700, color: accent, whiteSpace: 'nowrap' }}>{n.name}</Typography>
        {showParent && n.parentName && (
          <Typography sx={{ fontSize: 11.5, color: 'text.secondary', whiteSpace: 'nowrap' }}>← {n.parentName}</Typography>
        )}
        <Typography sx={{ fontSize: 10.5, color: 'text.disabled', ml: 'auto', whiteSpace: 'nowrap' }}>
          {n.status === 'pending' ? '待长出' : ORIGIN_LABEL[n.origin]}
          {n.lastSignal ? ` · ${ago(n.lastSignal)}` : ''}
        </Typography>
      </Box>
      {(n.headline || n.intro) && (
        <Typography
          sx={{
            fontSize: 12.5,
            color: 'text.secondary',
            lineHeight: 1.6,
            mt: 0.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {n.headline || n.intro}
        </Typography>
      )}
      <Typography sx={{ fontSize: 11, color: 'text.disabled', mt: 0.5 }}>
        {[...civSignals(n), `作品 ${n.works.toLocaleString()}`].join(' · ')}
      </Typography>
    </Box>
  );
}

/** 只保留后端认的字符(汉字 / 字母 / 数字),截到 max 个字 */
export const cleanName = (s: string, max = 16) =>
  Array.from(s.replace(/[^\p{Script=Han}A-Za-z0-9 ·]/gu, '').trim()).slice(0, max).join('');

/**
 * 接一枝:名字 + 线索词(空格或逗号分隔)+ 一句话。
 * parents 给了就让人选接在哪个门类下(「未归类」里用);否则接在 parent 下。
 */
export function GraftBox({
  parent,
  parents,
  initialName = '',
  accent,
  onDone,
}: {
  parent?: string;
  parents?: { key: string; label: string }[];
  initialName?: string;
  accent: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const { isAuthenticated } = useAuth();
  const [target, setTarget] = React.useState(parent || '');
  const [name, setName] = React.useState(cleanName(initialName));
  const [cues, setCues] = React.useState('');
  const [intro, setIntro] = React.useState('');
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  if (!isAuthenticated) {
    return (
      <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
        <Box component="a" href={loginHref()} sx={{ color: accent }}>
          登录
        </Box>
        后可以在这里接一枝。
      </Typography>
    );
  }

  const submit = async () => {
    setErr('');
    const words = cues.split(/[\s,，、]+/).filter(Boolean);
    if (!target) return setErr('先选接在哪');
    if (!name.trim()) return setErr('给这一枝起个名字');
    if (!words.length) return setErr('至少写一个线索词');
    setBusy(true);
    try {
      const r = await graft({ parent: target, name: name.trim(), cues: words, intro: intro.trim() || undefined });
      qc.invalidateQueries({ queryKey: ['civ'] });
      onDone?.();
      router.push(civHref(r.node.key));
    } catch (e) {
      setErr((e as Error).message || '没接上,稍后再试');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {parents && (
        <TextField select size="small" label="接在哪个门类下" value={target} onChange={(e) => setTarget(e.target.value)}>
          {parents.map((p) => (
            <MenuItem key={p.key} value={p.key}>
              {p.label}
            </MenuItem>
          ))}
        </TextField>
      )}
      <TextField
        size="small"
        label="名字"
        placeholder="比如:国产大飞机"
        value={name}
        onChange={(e) => setName(e.target.value)}
        slotProps={{ htmlInput: { maxLength: 16 } }}
      />
      <TextField
        size="small"
        label="线索词"
        placeholder="空格隔开,1~6 个,比如:C919 大飞机 商飞"
        value={cues}
        onChange={(e) => setCues(e.target.value)}
        helperText="标签或标题里出现任意一个词的作品都会挂到这一枝上;以后的热搜命中这些词,也会挂过来"
      />
      <TextField
        size="small"
        label="一句话(可不填)"
        value={intro}
        onChange={(e) => setIntro(e.target.value)}
        slotProps={{ htmlInput: { maxLength: 120 } }}
      />
      {err && <Typography sx={{ fontSize: 12.5, color: 'error.main' }}>{err}</Typography>}
      <Box>
        <Button variant="contained" size="small" disabled={busy} onClick={submit} sx={{ bgcolor: accent }}>
          接上
        </Button>
      </Box>
    </Box>
  );
}

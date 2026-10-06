'use client';

// 人生轮回(docs/LIFE-CYCLE.md):选一个宇宙,捏一个出身,活一世;死后回看,挑一样东西带进下一世。
// ?run= 是正在活 / 回看的那一世(静态导出不能用动态段)。
// 不说破「人生如梦」这类结论 —— 页面只给处境和选择。

import React, { Suspense } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import LifeStage, { DarkStage, SERIF, pendingSays } from '@/components/life/LifeStage';
import { useAuth } from '@/contexts/AuthContext';
import { loginHref } from '@/lib/auth/redirect';
import { errMessage } from '@/lib/errMessage';
import {
  deleteMark,
  getUniverse,
  lifeMe,
  listUniverses,
  setShadeOff,
  startRun,
  type LifeRun,
  type LifeUniverse,
} from '@/apis/life';

const ACCENT = '#C8A27A';

/** 捏人:能选的字段自己挑(最多 choosable 项),其余随机 */
function Birth({ u, onBorn }: { u: LifeUniverse; onBorn: (id: string) => void }) {
  const [picks, setPicks] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const used = Object.keys(picks).length;
  const toggle = (k: string, v: string) => {
    setPicks((p) => {
      const n = { ...p };
      if (n[k] === v) delete n[k];
      else if (n[k] || used < u.origin.choosable) n[k] = v;
      return n;
    });
  };
  const born = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await startRun(u.key, picks);
      if (r.says?.length) pendingSays.set(r.run.id, r.says);
      onBorn(r.run.id);
    } catch (e) {
      setErr(errMessage(e) || '出错了,稍后再试');
      setBusy(false);
    }
  };
  return (
    <Box sx={{ mt: 3, p: { xs: 2, md: 3 }, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', mb: 2 }}>
        出身大多由不得你。下面这些,最多自己定 {u.origin.choosable} 样,其余随它去。
      </Typography>
      {u.origin.fields.map((f) => (
        <Box key={f.key} sx={{ mb: 1.8 }}>
          <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', mb: 0.8 }}>{f.name}</Typography>
          {f.choosable && f.options ? (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {f.options.map((o) => {
                const on = picks[f.key] === o;
                return (
                  <Chip
                    key={o}
                    label={o}
                    onClick={() => toggle(f.key, o)}
                    variant={on ? 'filled' : 'outlined'}
                    disabled={!on && !picks[f.key] && used >= u.origin.choosable}
                    sx={{ borderColor: on ? ACCENT : 'rgba(255,255,255,0.2)', bgcolor: on ? ACCENT : 'transparent', color: on ? '#1a1410' : 'rgba(255,255,255,0.85)' }}
                  />
                );
              })}
            </Box>
          ) : (
            <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>随缘</Typography>
          )}
        </Box>
      ))}
      {err && <Typography sx={{ color: '#ff8a80', fontSize: 13, mb: 1 }}>{err}</Typography>}
      <Button variant="contained" disabled={busy} onClick={born} sx={{ mt: 1, minWidth: 160, bgcolor: ACCENT, color: '#1a1410', '&:hover': { bgcolor: ACCENT, filter: 'brightness(1.08)' } }}>
        {busy ? '…' : '投胎'}
      </Button>
    </Box>
  );
}

function UniverseCard({ k, alive, onBorn }: { k: string; alive?: LifeRun; onBorn: (id: string) => void }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const q = useQuery({ queryKey: ['life-universe', k], queryFn: () => getUniverse(k), staleTime: 10 * 60_000 });
  const u = q.data;
  if (!u) return <Box sx={{ height: 140, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)' }} />;
  return (
    <Box sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: 2, background: 'linear-gradient(160deg, #1b1622 0%, #3e2632 60%, #6a3c30 100%)' }}>
      <Typography sx={{ fontSize: 12, color: ACCENT, letterSpacing: '0.2em' }}>{u.era}</Typography>
      <Typography sx={{ fontFamily: SERIF, fontSize: { xs: 26, md: 30 }, letterSpacing: '0.1em', my: 1 }}>{u.name}</Typography>
      <Typography sx={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.9, mb: 2 }}>{u.summary}</Typography>
      <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', mb: 2 }}>
        {u.stages.map((s) => s.name).join(' → ')}
      </Typography>
      {alive ? (
        <Button variant="contained" onClick={() => router.push(`/life?run=${alive.id}`)} sx={{ bgcolor: ACCENT, color: '#1a1410', '&:hover': { bgcolor: ACCENT, filter: 'brightness(1.08)' } }}>
          接着活 · 第 {alive.no} 世 · {Math.floor(alive.age)} 岁
        </Button>
      ) : open ? (
        <Birth u={u} onBorn={onBorn} />
      ) : (
        <Button variant="outlined" onClick={() => setOpen(true)} sx={{ borderColor: ACCENT, color: ACCENT, '&:hover': { borderColor: ACCENT } }}>
          入这一世
        </Button>
      )}
    </Box>
  );
}

function Landing() {
  const router = useRouter();
  const qc = useQueryClient();
  const { status } = useAuth();
  const authed = status === 'authenticated';
  const us = useQuery({ queryKey: ['life-universes'], queryFn: listUniverses, staleTime: 10 * 60_000 });
  const me = useQuery({ queryKey: ['life-me'], queryFn: lifeMe, enabled: authed });
  const shade = useMutation({ mutationFn: setShadeOff, onSuccess: () => qc.invalidateQueries({ queryKey: ['life-me'] }) });
  const drop = useMutation({ mutationFn: deleteMark, onSuccess: () => qc.invalidateQueries({ queryKey: ['life-me'] }) });
  const runs = me.data?.runs || [];
  const onBorn = (id: string) => {
    qc.invalidateQueries({ queryKey: ['life-me'] });
    router.push(`/life?run=${id}`);
  };
  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: '#0c0c10', color: 'text.primary', px: { xs: 2, md: 6 }, py: { xs: 5, md: 8 } }}>
      <Box sx={{ maxWidth: 720, mx: 'auto' }}>
        <Typography sx={{ fontFamily: SERIF, fontSize: { xs: 34, md: 44 }, letterSpacing: '0.2em', mb: 1 }}>人生轮回</Typography>
        <Typography sx={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 2, mb: 4 }}>
          换一个出身,再活一次。一世之内不能回头;死后可以回看,挑一样东西带进下一世。
          {me.data && me.data.lives > 0 && ` 你已经活过 ${me.data.lives} 世。`}
        </Typography>

        {!authed && status !== 'loading' && (
          <Box sx={{ mb: 4 }}>
            <Typography sx={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', mb: 1.5 }}>登录之后,每一世都会记在你自己的账号里。</Typography>
            <Button variant="contained" href={loginHref()} sx={{ bgcolor: ACCENT, color: '#1a1410', '&:hover': { bgcolor: ACCENT } }}>
              登录
            </Button>
          </Box>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mb: 6 }}>
          {(us.data?.list || []).map((u) => (
            <UniverseCard key={u.key} k={u.key} alive={runs.find((r) => r.universe === u.key && r.status === 'alive')} onBorn={authed ? onBorn : () => router.push(loginHref())} />
          ))}
        </Box>

        {authed && me.data && (
          <>
            {me.data.marks.length > 0 && (
              <Box sx={{ mb: 5 }}>
                <Typography sx={{ fontSize: 13, color: ACCENT, letterSpacing: '0.2em', mb: 1.5 }}>你带着的</Typography>
                {me.data.marks.map((m) => (
                  <Box key={m.key} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, py: 1.2, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: 15 }}>
                        {m.key}
                        <Box component="span" sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', ml: 1 }}>
                          第 {m.life} 世留下的
                        </Box>
                      </Typography>
                      {m.text && <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>{m.text}</Typography>}
                    </Box>
                    <Button size="small" onClick={() => drop.mutate(m.key)} sx={{ color: 'rgba(255,255,255,0.45)', flexShrink: 0 }}>
                      放下
                    </Button>
                  </Box>
                ))}
              </Box>
            )}

            {runs.length > 0 && (
              <Box sx={{ mb: 5 }}>
                <Typography sx={{ fontSize: 13, color: ACCENT, letterSpacing: '0.2em', mb: 1.5 }}>活过的</Typography>
                {runs.map((r) => (
                  <Box
                    key={r.id}
                    onClick={() => router.push(`/life?run=${r.id}`)}
                    sx={{ py: 1.4, borderBottom: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}
                  >
                    <Typography sx={{ fontSize: 15 }}>
                      第 {r.no} 世 · {r.universeName}
                      <Box component="span" sx={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', ml: 1 }}>
                        {r.status === 'alive' ? `活着 · ${Math.floor(r.age)} 岁` : `${Math.floor(r.age)} 岁${r.cause ? `,${r.cause}` : ''}`}
                      </Box>
                    </Typography>
                    {r.words && <Typography sx={{ fontFamily: SERIF, fontSize: 14, color: 'rgba(255,255,255,0.6)', mt: 0.3 }}>「{r.words}」</Typography>}
                  </Box>
                ))}
              </Box>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 14 }}>我的选择可以成为别人一世里的人</Typography>
                <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.8 }}>
                  别人坐在另一个座位上时,场景里那个人会照某个真人当年的选择去做。只用选了哪一项,不带名字、不带你写的话。
                </Typography>
              </Box>
              <Switch checked={!me.data.shadeOff} onChange={(e) => shade.mutate(!e.target.checked)} />
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}

function LifeInner() {
  const run = useSearchParams().get('run') || '';
  const { status } = useAuth();
  if (run && status === 'authenticated') return <LifeStage key={run} runId={run} />;
  return (
    <DarkStage>
      <Landing />
    </DarkStage>
  );
}

export default function LifePage() {
  return (
    <Suspense fallback={null}>
      <LifeInner />
    </Suspense>
  );
}

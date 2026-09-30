'use client';

// 人生感悟 · 我的心路。
//
// 心路 = 我在站内留下的人生轨迹:走完的回廊(结局 + 感受词)和自己写的一笔。
// 五个内在维度(本心 / 底气 / 棱角 / 沉默 / 微笑)累起来是一张侧写;愿意公开的人之间,
// 侧写方向相近的互为「同路人」。默认只有自己看得到;公开后别人只看到昵称、五维和
// 共同走到的结局,看不到写的字。

import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import DetailHeader from '@/components/detail/DetailHeader';
import { EmptyState } from '@/components/common/AsyncState';
import { UserAvatarLink } from '@/components/common/UserAvatarLink';
import { useAuth } from '@/contexts/AuthContext';
import { loginHref } from '@/lib/auth/redirect';
import { accentOf } from '@/components/insight/InsightCards';
import { overview } from '@/apis/insight';
import {
  LIFE_AXES,
  addMoment,
  deleteNode,
  mine as fetchMine,
  peers as fetchPeers,
  setVisibility,
  type LifeAxis,
  type LifeAxisMeta,
  type LifePathNode,
  type LifeProfile,
} from '@/apis/lifepath';

const SERIF = '"Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, serif';
const MOMENT_MAX = 300;

/** 五个维度各一个颜色,和感悟分组的主色一个调性。 */
const AXIS_COLOR: Record<LifeAxis, string> = {
  heart: '#C8553D',
  spine: '#A07A3C',
  edge: '#3A6EA5',
  silence: '#6B6B7B',
  smile: '#3A9E9A',
};

const fmtDate = (ts: number) => {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

/** 五维雷达。只画方向感,不标刻度 —— 这不是量表。 */
function Radar({ axes, meta, size = 220 }: { axes: Record<LifeAxis, number>; meta: LifeAxisMeta[]; size?: number }) {
  const c = size / 2;
  const r = size / 2 - 28;
  const max = Math.max(1, ...LIFE_AXES.map((a) => axes[a] || 0));
  const pt = (i: number, k: number) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return [c + r * k * Math.cos(ang), c + r * k * Math.sin(ang)] as const;
  };
  const ring = (k: number) => LIFE_AXES.map((_, i) => pt(i, k).join(',')).join(' ');
  const shape = LIFE_AXES.map((a, i) => pt(i, (axes[a] || 0) / max).join(',')).join(' ');
  const names = Object.fromEntries(meta.map((m) => [m.key, m.name]));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="五维侧写">
      {[0.33, 0.66, 1].map((k) => (
        <polygon key={k} points={ring(k)} fill="none" stroke="currentColor" strokeOpacity={0.12} />
      ))}
      {LIFE_AXES.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="currentColor" strokeOpacity={0.12} />;
      })}
      <polygon points={shape} fill="#C8553D" fillOpacity={0.18} stroke="#C8553D" strokeWidth={1.5} />
      {LIFE_AXES.map((a, i) => {
        const [x, y] = pt(i, (axes[a] || 0) / max);
        const [lx, ly] = pt(i, 1.18);
        return (
          <g key={a}>
            <circle cx={x} cy={y} r={3} fill={AXIS_COLOR[a]} />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize={12} fill={AXIS_COLOR[a]} fontFamily={SERIF}>
              {names[a] || a}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function AxisChips({ value, onChange, meta }: { value: LifeAxis | ''; onChange: (a: LifeAxis | '') => void; meta: LifeAxisMeta[] }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      {meta.map((m) => {
        const on = value === m.key;
        return (
          <Box
            key={m.key}
            onClick={() => onChange(on ? '' : m.key)}
            title={m.hint}
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: 5,
              fontSize: 13,
              cursor: 'pointer',
              border: '1px solid',
              borderColor: on ? AXIS_COLOR[m.key] : 'divider',
              bgcolor: on ? `${AXIS_COLOR[m.key]}1a` : 'transparent',
              color: on ? AXIS_COLOR[m.key] : 'text.secondary',
            }}
          >
            {m.name}
          </Box>
        );
      })}
    </Box>
  );
}

function MomentBox({ meta, onAdded }: { meta: LifeAxisMeta[]; onAdded: () => void }) {
  const [text, setText] = React.useState('');
  const [axis, setAxis] = React.useState<LifeAxis | ''>('');
  const [err, setErr] = React.useState('');
  const m = useMutation({
    mutationFn: () => addMoment({ text: text.trim(), axis }),
    onSuccess: () => {
      setText('');
      setAxis('');
      setErr('');
      onAdded();
    },
    onError: () => setErr('没存上，稍后再试'),
  });
  return (
    <Box sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2.5, border: '1px solid', borderColor: 'divider' }}>
      <Typography sx={{ fontSize: 15, fontWeight: 600, mb: 0.5 }}>记一笔</Typography>
      <Typography sx={{ fontSize: 12, color: 'text.disabled', mb: 1.5 }}>
        此刻的处境、刚做的一个决定、看完某部作品的一句话。只有你自己看得到。
      </Typography>
      <TextField
        multiline
        minRows={2}
        maxRows={6}
        fullWidth
        size="small"
        value={text}
        placeholder="今天……"
        onChange={(e) => setText(e.target.value.slice(0, MOMENT_MAX))}
      />
      <Box sx={{ mt: 1.5, mb: 1.5 }}>
        <Typography sx={{ fontSize: 12, color: 'text.disabled', mb: 0.75 }}>这一笔偏向哪一面（可不选）</Typography>
        <AxisChips value={axis} onChange={setAxis} meta={meta} />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography sx={{ fontSize: 11, color: err ? 'error.main' : 'text.disabled' }}>
          {err || `${text.length}/${MOMENT_MAX}`}
        </Typography>
        <Button size="small" variant="contained" disabled={!text.trim() || m.isPending} onClick={() => m.mutate()}>
          记下
        </Button>
      </Box>
    </Box>
  );
}

function NodeRow({ n, names, onDelete }: { n: LifePathNode; names: Record<string, string>; onDelete: () => void }) {
  const router = useRouter();
  const color = n.axis ? AXIS_COLOR[n.axis] : '#999';
  return (
    <Box sx={{ display: 'flex', gap: 2, position: 'relative', pb: 3 }}>
      <Box sx={{ width: 12, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color, mt: '6px', flexShrink: 0 }} />
        <Box sx={{ flex: 1, width: '1px', bgcolor: 'divider', mt: 0.5 }} />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>{fmtDate(n.createdAt)}</Typography>
          {n.axis && <Typography sx={{ fontSize: 11, color }}>{names[n.axis] || n.axis}</Typography>}
          {n.kind === 'journey' && (
            <Typography
              onClick={() => n.scriptKey && router.push(`/insight/journey?key=${encodeURIComponent(n.scriptKey)}`)}
              sx={{ fontSize: 11, color: 'text.secondary', cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
            >
              回廊《{n.scriptTitle || n.scriptKey}》
            </Typography>
          )}
        </Box>
        <Typography sx={{ fontSize: 14.5, lineHeight: 1.8, mt: 0.25, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {n.kind === 'journey' ? `走到了「${n.text}」` : n.text}
        </Typography>
        {n.feel && <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>{n.feel}</Typography>}
        {n.kind === 'moment' && (
          <Typography
            onClick={onDelete}
            sx={{ fontSize: 11, color: 'text.disabled', mt: 0.5, cursor: 'pointer', display: 'inline-block', '&:hover': { color: 'error.main' } }}
          >
            删掉这一笔
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function Peers({ profile, meta, onToggle }: { profile: LifeProfile; meta: LifeAxisMeta[]; onToggle: (v: boolean) => void }) {
  const q = useQuery({ queryKey: ['lifepath', 'peers', profile.public], queryFn: fetchPeers, enabled: profile.public });
  const names = Object.fromEntries(meta.map((m) => [m.key, m.name]));
  const dominant = (p: LifeProfile) => {
    const best = LIFE_AXES.reduce((a, b) => ((p.axes[b] || 0) > (p.axes[a] || 0) ? b : a));
    return (p.axes[best] || 0) > 0 ? names[best] : '';
  };
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 1 }}>
        <Box>
          <Typography sx={{ fontSize: 16, fontWeight: 600 }}>同路人</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>
            侧写方向和你接近、也愿意公开的人。公开后别人只看到你的昵称、五维和共同走到的结局。
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>公开我的侧写</Typography>
          <Switch size="small" checked={profile.public} onChange={(_, v) => onToggle(v)} />
        </Box>
      </Box>
      {!profile.public ? (
        <Typography sx={{ fontSize: 13, color: 'text.disabled', py: 2 }}>打开公开，才能看到同路人 —— 对等的。</Typography>
      ) : q.isLoading ? (
        <Skeleton variant="rounded" height={96} />
      ) : (q.data?.list.length ?? 0) === 0 ? (
        <Typography sx={{ fontSize: 13, color: 'text.disabled', py: 2 }}>
          {q.data?.reason === 'empty' ? '先走一条回廊或记一笔，才有侧写可比。' : '还没有方向相近的人，过几天再来看。'}
        </Typography>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
          {q.data!.list.map((p) => (
            <Box key={p.userId} sx={{ display: 'flex', gap: 1.5, p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', minWidth: 0 }}>
              <UserAvatarLink userId={p.userId} name={p.nickname} src={p.avatar} size={40} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.nickname || '同路人'}
                </Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                  {dominant(p.profile) ? `偏向「${dominant(p.profile)}」 · ` : ''}方向相近 {Math.round(p.sim * 100)}%
                </Typography>
                {(p.shared?.length ?? 0) > 0 && (
                  <Typography sx={{ fontSize: 12, color: 'text.disabled', mt: 0.25 }}>
                    和你一样走到了{p.shared!.map((s) => `「${s.endingTitle || s.ending}」`).join('、')}
                  </Typography>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

export default function LifePathPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { status, isAuthenticated } = useAuth();
  const q = useQuery({ queryKey: ['lifepath', 'mine'], queryFn: fetchMine, enabled: isAuthenticated });
  const ov = useQuery({ queryKey: ['insight', 'overview'], queryFn: overview, staleTime: 60 * 60_000 });
  const reload = () => void qc.invalidateQueries({ queryKey: ['lifepath'] });
  const vis = useMutation({ mutationFn: setVisibility, onSuccess: reload });
  const del = useMutation({ mutationFn: deleteNode, onSuccess: reload });

  const meta = q.data?.axesMeta ?? [];
  const names = Object.fromEntries(meta.map((m) => [m.key, m.name]));
  // 一个感悟主题一条回廊,先拿第一个主题的主色当页面主色
  const accent = accentOf(ov.data?.groups[0]?.key);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DetailHeader title="人生感悟" />
      <Container maxWidth="md" sx={{ py: 3, pb: 8 }}>
        <Typography
          onClick={() => router.push('/insight')}
          sx={{ fontSize: 12, color: 'text.disabled', cursor: 'pointer', mb: 1, letterSpacing: '0.1em' }}
        >
          人生感悟
        </Typography>
        <Typography sx={{ fontFamily: SERIF, fontSize: { xs: 34, md: 42 }, fontWeight: 700, letterSpacing: '0.15em', lineHeight: 1.2, mb: 1 }}>
          我的心路
        </Typography>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.8, mb: 4, maxWidth: 560 }}>
          走完的回廊、记下的一笔，攒起来是你的人生轨迹。五个面 —— 本心、底气、棱角、沉默、微笑 —— 只说这段路偏向哪边，不下结论。
        </Typography>

        {status === 'loading' ? (
          <Skeleton variant="rounded" height={260} />
        ) : !isAuthenticated ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <EmptyState text="心路是自己的东西，登录后才有" />
            <Button variant="contained" href={loginHref()} sx={{ mt: 2 }}>
              登录
            </Button>
          </Box>
        ) : q.isLoading || !q.data ? (
          <Skeleton variant="rounded" height={260} />
        ) : (
          <>
            {/* 侧写 */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '240px minmax(0, 1fr)' },
                gap: 3,
                alignItems: 'center',
                mb: 4,
                p: { xs: 2, md: 3 },
                borderRadius: 2.5,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box sx={{ justifySelf: 'center', color: 'text.primary' }}>
                <Radar axes={q.data.profile.axes} meta={meta} />
              </Box>
              <Box>
                {q.data.profile.nodes === 0 ? (
                  <>
                    <Typography sx={{ fontSize: 15, lineHeight: 1.8 }}>还是一张白纸。</Typography>
                    <Typography sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.8, mt: 0.5 }}>
                      走一条回廊，或者在下面记一笔，这里就会开始有形状。
                    </Typography>
                    <Button variant="outlined" size="small" onClick={() => router.push('/insight')} sx={{ mt: 2, borderColor: accent, color: accent }}>
                      去人生感悟
                    </Button>
                  </>
                ) : (
                  <Box sx={{ display: 'grid', gap: 1 }}>
                    {meta.map((m) => {
                      const v = q.data!.profile.axes[m.key] || 0;
                      const max = Math.max(1, ...LIFE_AXES.map((a) => q.data!.profile.axes[a] || 0));
                      return (
                        <Box key={m.key}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <Typography sx={{ fontSize: 13 }}>
                              <Box component="span" sx={{ color: AXIS_COLOR[m.key], fontFamily: SERIF, fontWeight: 700, mr: 1 }}>
                                {m.name}
                              </Box>
                              <Box component="span" sx={{ fontSize: 11, color: 'text.disabled' }}>
                                {m.hint}
                              </Box>
                            </Typography>
                            <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>{v}</Typography>
                          </Box>
                          <Box sx={{ height: 4, borderRadius: 2, bgcolor: 'action.hover', overflow: 'hidden', mt: 0.5 }}>
                            <Box sx={{ height: '100%', width: `${(v / max) * 100}%`, bgcolor: AXIS_COLOR[m.key] }} />
                          </Box>
                        </Box>
                      );
                    })}
                    <Typography sx={{ fontSize: 11, color: 'text.disabled', mt: 0.5 }}>
                      {q.data.profile.nodes} 个节点 · 每个节点给它的那一面 +1
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>

            <Box sx={{ mb: 4 }}>
              <MomentBox meta={meta} onAdded={reload} />
            </Box>

            {/* 轨迹 */}
            <Box sx={{ mb: 5 }}>
              <Typography sx={{ fontSize: 16, fontWeight: 600, mb: 2 }}>
                轨迹
                <Typography component="span" sx={{ fontSize: 12, color: 'text.disabled', ml: 1 }}>
                  新的在前
                </Typography>
              </Typography>
              {q.data.list.length === 0 ? (
                <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>还没有节点。</Typography>
              ) : (
                q.data.list.map((n) => <NodeRow key={n.id} n={n} names={names} onDelete={() => del.mutate(n.id)} />)
              )}
            </Box>

            <Peers profile={q.data.profile} meta={meta} onToggle={(v) => vis.mutate(v)} />
          </>
        )}
      </Container>
    </Box>
  );
}

'use client';

// 人生轮回 · 完善一个宇宙(?key=,作者才能改):定律、出身、一生里的处境、地方和藏着的奥秘。
// 每一块都有「AI 帮想」:给几个候选,自己挑了才放进来 —— AI 是手,定稿的是人。
// 存的时候后端重新拼成宇宙、过敏感词、校验;不合格的会说哪里不行。

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import { DarkStage, SERIF } from '@/components/life/LifeStage';
import { useAuth } from '@/contexts/AuthContext';
import { loginHref } from '@/lib/auth/redirect';
import { errMessage } from '@/lib/errMessage';
import {
  assistOutline,
  getMade,
  putMade,
  type AssistKind,
  type OutlineEvent,
  type OutlineLaw,
  type OutlinePlace,
  type UniverseOutline,
} from '@/apis/life';

const ACCENT = '#C8A27A';
const STAGES = [
  ['childhood', '童年'],
  ['youth', '少年'],
  ['young', '青年'],
  ['middle', '中年'],
  ['late', '暮年'],
] as const;
const AXES = [
  ['', '不标'],
  ['heart', '本心'],
  ['spine', '底气'],
  ['edge', '棱角'],
  ['silence', '沉默'],
  ['smile', '微笑'],
] as const;
const DOMAINS = [
  ['society', '社会'],
  ['nature', '自然'],
  ['ethics', '伦理'],
  ['power', '力量'],
  ['economy', '生计'],
  ['fate', '命运'],
  ['mind', '心'],
] as const;

const field = { '& .MuiOutlinedInput-root': { bgcolor: 'rgba(0,0,0,0.3)', fontSize: 14 } };

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 5 }}>
      <Typography sx={{ fontFamily: SERIF, fontSize: 19, letterSpacing: '0.1em' }}>{title}</Typography>
      {note && <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', mb: 1.5, lineHeight: 1.8 }}>{note}</Typography>}
      {children}
    </Box>
  );
}

/** 「AI 帮想」:一句提示 → 候选 → 点一个放进来 */
function Assist({
  kind,
  outline,
  render,
  onPick,
}: {
  kind: AssistKind;
  outline: UniverseOutline;
  render: (item: unknown) => string;
  onPick: (item: unknown) => void;
}) {
  const [hint, setHint] = React.useState('');
  const [items, setItems] = React.useState<unknown[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const go = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await assistOutline(kind, outline, hint.trim());
      setItems(r.items || []);
    } catch (e) {
      setErr(errMessage(e) || '一时没想出来,再试一次');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 1, bgcolor: 'rgba(200,162,122,0.06)' }}>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField size="small" fullWidth value={hint} onChange={(e) => setHint(e.target.value.slice(0, 200))} placeholder="给 AI 一句提示(可以不写)" sx={field} />
        <Button size="small" variant="outlined" disabled={busy} onClick={go} sx={{ flexShrink: 0, borderColor: ACCENT, color: ACCENT }}>
          {busy ? '在想…' : 'AI 帮想'}
        </Button>
      </Box>
      {err && <Typography sx={{ fontSize: 12, color: '#ff8a80', mt: 1 }}>{err}</Typography>}
      {items.length > 0 && (
        <Box sx={{ mt: 1 }}>
          {items.map((it, i) => (
            <Box
              key={i}
              onClick={() => {
                onPick(it);
                setItems(items.filter((_, k) => k !== i));
              }}
              sx={{ p: 1, my: 0.5, borderRadius: 1, cursor: 'pointer', fontSize: 13, lineHeight: 1.8, border: '1px solid rgba(255,255,255,0.12)', '&:hover': { borderColor: ACCENT } }}
            >
              + {render(it)}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const asEvent = (v: unknown): OutlineEvent => {
  const o = (v || {}) as Record<string, unknown>;
  return {
    stage: str(o.stage) || 'young',
    situation: str(o.situation),
    choice: str(o.choice),
    alternatives: Array.isArray(o.alternatives) ? o.alternatives.map(str).filter(Boolean) : [],
    consequence: str(o.consequence),
    axis: str(o.axis),
    feel: str(o.feel),
  };
};
const asPlace = (v: unknown): OutlinePlace => {
  const o = (v || {}) as Record<string, unknown>;
  const secrets = Array.isArray(o.secrets) ? (o.secrets as Record<string, unknown>[]).map((s) => ({ text: str(s.text), hint: str(s.hint) })) : [];
  return { name: str(o.name), description: str(o.description), secrets };
};

function Editor({ k }: { k: string }) {
  const q = useQuery({ queryKey: ['life-made', k], queryFn: () => getMade(k), retry: false });
  if (q.isError) return <Typography sx={{ color: 'rgba(255,255,255,0.6)' }}>只有造这个宇宙的人能改它。</Typography>;
  if (!q.data) return <Typography sx={{ color: 'rgba(255,255,255,0.5)' }}>…</Typography>;
  return <Form k={k} initial={q.data.outline} plays={q.data.plays} />;
}

function Form({ k, initial, plays }: { k: string; initial: UniverseOutline; plays: number }) {
  const router = useRouter();
  const [o, setO] = React.useState<UniverseOutline>(() => ({
    ...initial,
    laws: initial.laws || [],
    births: initial.births || [],
    events: initial.events || [],
    places: initial.places || [],
  }));
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const set = (patch: Partial<UniverseOutline>) => setO({ ...o, ...patch });
  const setLaw = (i: number, l: OutlineLaw | null) => set({ laws: l ? o.laws.map((x, k2) => (k2 === i ? l : x)) : o.laws.filter((_, k2) => k2 !== i) });
  const setEvent = (i: number, e: OutlineEvent | null) =>
    set({ events: e ? o.events.map((x, k2) => (k2 === i ? e : x)) : o.events.filter((_, k2) => k2 !== i) });
  const setPlace = (i: number, p: OutlinePlace | null) =>
    set({ places: p ? o.places.map((x, k2) => (k2 === i ? p : x)) : o.places.filter((_, k2) => k2 !== i) });
  const save = async () => {
    setBusy(true);
    setMsg('');
    try {
      const r = await putMade(k, o);
      setMsg(`存好了(第 ${r.version} 版)。`);
    } catch (e) {
      setMsg(errMessage(e) || '没存上,稍后再试');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Typography sx={{ fontSize: 12, color: ACCENT, letterSpacing: '0.2em' }}>完善你的宇宙{plays ? ` · 有人在这里活过 ${plays} 世` : ''}</Typography>
      <TextField value={o.name} onChange={(e) => set({ name: e.target.value.slice(0, 30) })} variant="standard" fullWidth
        sx={{ my: 1.5, '& input': { fontFamily: SERIF, fontSize: 30, letterSpacing: '0.1em' } }} />
      <TextField value={o.era || ''} onChange={(e) => set({ era: e.target.value.slice(0, 40) })} size="small" fullWidth placeholder="时代" sx={{ ...field, mb: 1.5 }} />
      <TextField value={o.summary || ''} onChange={(e) => set({ summary: e.target.value.slice(0, 200) })} multiline minRows={2} fullWidth placeholder="一两句话说这个世界" sx={{ ...field, mb: 1 }} />
      <Assist kind="summary" outline={o} render={str} onPick={(v) => set({ summary: str(v) })} />

      <Box sx={{ mt: 5 }} />
      <Section title="定律" note="前三条写在宇宙卡片上;其余的藏起来,要人自己在「四处走走」里发现。">
        {o.laws.map((l, i) => (
          <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
            <TextField select size="small" value={l.domain || 'society'} onChange={(e) => setLaw(i, { ...l, domain: e.target.value })} sx={{ ...field, width: 90 }}>
              {DOMAINS.map(([v, n]) => (
                <MenuItem key={v} value={v}>{n}</MenuItem>
              ))}
            </TextField>
            <TextField size="small" fullWidth value={l.text} onChange={(e) => setLaw(i, { ...l, text: e.target.value.slice(0, 80) })} sx={field} />
            <IconButton size="small" onClick={() => setLaw(i, null)} sx={{ color: 'rgba(255,255,255,0.4)' }}><CloseIcon fontSize="small" /></IconButton>
          </Box>
        ))}
        <Button size="small" onClick={() => set({ laws: [...o.laws, { text: '', domain: 'society' }] })} sx={{ color: 'rgba(255,255,255,0.6)' }}>+ 写一条</Button>
        <Assist kind="laws" outline={o} render={(v) => str((v as OutlineLaw)?.text)} onPick={(v) => set({ laws: [...o.laws, { text: str((v as OutlineLaw)?.text), domain: str((v as OutlineLaw)?.domain) || 'society' }] })} />
      </Section>

      <Section title="出身" note="投胎时随机抽一种。">
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
          {o.births.map((b, i) => (
            <Chip key={i} label={b} onDelete={() => set({ births: o.births.filter((_, k2) => k2 !== i) })} />
          ))}
        </Box>
        <TextField size="small" placeholder="写一种出身,回车加上" sx={field}
          onKeyDown={(e) => {
            const t = (e.target as HTMLInputElement).value.trim();
            if (e.key === 'Enter' && t) {
              set({ births: [...o.births, t.slice(0, 12)] });
              (e.target as HTMLInputElement).value = '';
            }
          }} />
        <Assist kind="births" outline={o} render={str} onPick={(v) => set({ births: [...o.births, str(v).slice(0, 12)] })} />
      </Section>

      <Section title="一生里的处境" note="至少 6 段。「多数人会走的路」选了能看见后来;别的路交给推演。">
        {o.events.map((e, i) => (
          <Box key={i} sx={{ p: 1.5, mb: 1.5, borderRadius: 1, border: '1px solid rgba(255,255,255,0.1)' }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField select size="small" value={e.stage} onChange={(ev) => setEvent(i, { ...e, stage: ev.target.value })} sx={{ ...field, width: 100 }}>
                {STAGES.map(([v, n]) => (
                  <MenuItem key={v} value={v}>{n}</MenuItem>
                ))}
              </TextField>
              <TextField select size="small" value={e.axis || ''} onChange={(ev) => setEvent(i, { ...e, axis: ev.target.value })} sx={{ ...field, width: 100 }}>
                {AXES.map(([v, n]) => (
                  <MenuItem key={v} value={v}>{n}</MenuItem>
                ))}
              </TextField>
              <Box sx={{ flex: 1 }} />
              <IconButton size="small" onClick={() => setEvent(i, null)} sx={{ color: 'rgba(255,255,255,0.4)' }}><CloseIcon fontSize="small" /></IconButton>
            </Box>
            <TextField size="small" fullWidth multiline value={e.situation} onChange={(ev) => setEvent(i, { ...e, situation: ev.target.value.slice(0, 180) })} placeholder="处境(你……)" sx={{ ...field, mb: 1 }} />
            <TextField size="small" fullWidth value={e.choice} onChange={(ev) => setEvent(i, { ...e, choice: ev.target.value.slice(0, 40) })} placeholder="多数人会走的路" sx={{ ...field, mb: 1 }} />
            <TextField size="small" fullWidth value={e.alternatives.join(' / ')}
              onChange={(ev) => setEvent(i, { ...e, alternatives: ev.target.value.split('/').map((s) => s.trim()).filter(Boolean).slice(0, 3) })}
              placeholder="别的路(用 / 隔开)" sx={{ ...field, mb: 1 }} />
            <TextField size="small" fullWidth value={e.consequence || ''} onChange={(ev) => setEvent(i, { ...e, consequence: ev.target.value.slice(0, 120) })} placeholder="走了多数人那条路,后来" sx={field} />
          </Box>
        ))}
        <Button size="small" onClick={() => set({ events: [...o.events, { stage: 'young', situation: '', choice: '', alternatives: [] }] })} sx={{ color: 'rgba(255,255,255,0.6)' }}>+ 写一段</Button>
        <Assist kind="events" outline={o} render={(v) => `${str((v as OutlineEvent)?.situation)} → ${str((v as OutlineEvent)?.choice)}`} onPick={(v) => set({ events: [...o.events, asEvent(v)] })} />
      </Section>

      <Section title="地方和奥秘" note="两场之间可以去的地方。奥秘只有人做了对的事才看得见;「怎样才见得到」只给推演者看。">
        {o.places.map((p, i) => (
          <Box key={i} sx={{ p: 1.5, mb: 1.5, borderRadius: 1, border: '1px solid rgba(255,255,255,0.1)' }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField size="small" fullWidth value={p.name} onChange={(e) => setPlace(i, { ...p, name: e.target.value.slice(0, 20) })} placeholder="地方的名字" sx={field} />
              <IconButton size="small" onClick={() => setPlace(i, null)} sx={{ color: 'rgba(255,255,255,0.4)' }}><CloseIcon fontSize="small" /></IconButton>
            </Box>
            <TextField size="small" fullWidth value={p.description || ''} onChange={(e) => setPlace(i, { ...p, description: e.target.value.slice(0, 150) })} placeholder="一两句" sx={{ ...field, mb: 1 }} />
            {(p.secrets || []).map((s, j) => (
              <Box key={j} sx={{ pl: 1.5, borderLeft: `2px solid ${ACCENT}`, mb: 1 }}>
                <TextField size="small" fullWidth value={s.text} placeholder="奥秘:见到时看见的画面" sx={{ ...field, mb: 0.5 }}
                  onChange={(e) => setPlace(i, { ...p, secrets: (p.secrets || []).map((x, k2) => (k2 === j ? { ...x, text: e.target.value.slice(0, 150) } : x)) })} />
                <TextField size="small" fullWidth value={s.hint} placeholder="怎样的举动才见得到它(只给推演者看)" sx={field}
                  onChange={(e) => setPlace(i, { ...p, secrets: (p.secrets || []).map((x, k2) => (k2 === j ? { ...x, hint: e.target.value.slice(0, 100) } : x)) })} />
              </Box>
            ))}
            {(p.secrets || []).length < 3 && (
              <Button size="small" onClick={() => setPlace(i, { ...p, secrets: [...(p.secrets || []), { text: '', hint: '' }] })} sx={{ color: 'rgba(255,255,255,0.6)' }}>+ 藏一个奥秘</Button>
            )}
          </Box>
        ))}
        {o.places.length < 3 && (
          <Button size="small" onClick={() => set({ places: [...o.places, { name: '', description: '', secrets: [] }] })} sx={{ color: 'rgba(255,255,255,0.6)' }}>+ 加一个地方</Button>
        )}
        <Assist kind="place" outline={o} render={(v) => `${str((v as OutlinePlace)?.name)}:${str((v as OutlinePlace)?.description)}`} onPick={(v) => set({ places: [...o.places, asPlace(v)].slice(0, 3) })} />
      </Section>

      <Box sx={{ position: 'sticky', bottom: 0, py: 2, bgcolor: '#0c0c10', display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button variant="contained" disabled={busy} onClick={save} sx={{ bgcolor: ACCENT, color: '#1a1410', '&:hover': { bgcolor: ACCENT } }}>
          {busy ? '…' : '存下来'}
        </Button>
        <Button onClick={() => router.push(`/life?u=${k}`)} sx={{ color: 'rgba(255,255,255,0.7)' }}>去里面活一世</Button>
        {msg && <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{msg}</Typography>}
      </Box>
    </>
  );
}

function EditInner() {
  const k = useSearchParams().get('key') || '';
  const { status } = useAuth();
  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: '#0c0c10', color: 'text.primary', px: { xs: 2, md: 6 }, py: { xs: 4, md: 6 } }}>
      <Box sx={{ maxWidth: 760, mx: 'auto' }}>
        {status === 'authenticated' ? (
          k ? <Editor key={k} k={k} /> : <Typography>没有指定宇宙。</Typography>
        ) : status === 'loading' ? null : (
          <Button variant="contained" href={loginHref()} sx={{ bgcolor: ACCENT, color: '#1a1410' }}>登录后才能完善宇宙</Button>
        )}
      </Box>
    </Box>
  );
}

export default function LifeEditPage() {
  return (
    <Suspense fallback={null}>
      <DarkStage>
        <EditInner />
      </DarkStage>
    </Suspense>
  );
}

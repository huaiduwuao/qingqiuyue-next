'use client';

// 世界的共创:认同、补一条(定律 / 地方 / 人群 / 人物 / 一段人生 / 一句感悟)、AI 帮想。
// AI 只给候选,点一个填进表单,改好了自己提交 —— 定稿的是人。
// 没登录点了去登录;补成功了给一句「+5 积分」。

import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useAuth } from '@/contexts/AuthContext';
import { loginHref } from '@/lib/auth/redirect';
import { errMessage } from '@/lib/errMessage';
import { addCharacter, addEvent, addInsight, addLaw, addPlace, cogAssist, endorse, type CogAssistKind } from '@/apis/cog';

const DOMAINS: [string, string][] = [
  ['society', '社会'],
  ['nature', '自然'],
  ['ethics', '伦理'],
  ['power', '力量'],
  ['economy', '生计'],
  ['fate', '命运'],
  ['mind', '心'],
];
const STAGES: [string, string][] = [
  ['childhood', '童年'],
  ['youth', '少年'],
  ['young', '青年'],
  ['middle', '中年'],
  ['late', '暮年'],
];
const LAYERS: [string, string][] = [
  ['1', '照见'],
  ['2', '体味'],
  ['3', '参悟'],
];

/** 认同:一人一票,再点一下收回 */
export function EndorseButton({ kind, id, count }: { kind: 'law' | 'insight'; id: string; count?: number }) {
  const { status } = useAuth();
  const [n, setN] = React.useState(count || 0);
  const [on, setOn] = React.useState(false);
  const toggle = async () => {
    if (status !== 'authenticated') {
      window.location.href = loginHref();
      return;
    }
    try {
      const r = await endorse(kind, id, !on);
      setN(r.endorse);
      setOn(r.on);
    } catch {
      /* 没认同上就算了 */
    }
  };
  return (
    <Box component="span" onClick={toggle} sx={{ ml: 1, fontSize: 11, cursor: 'pointer', color: on ? 'primary.main' : 'text.disabled', whiteSpace: 'nowrap', '&:hover': { color: 'primary.main' } }}>
      {on ? '已认同' : '认同'}
      {n > 0 ? ` ${n}` : ''}
    </Box>
  );
}

/** 用户补的,标一下 */
export function ByUser({ authorId }: { authorId?: string }) {
  if (!authorId || authorId === '0') return null;
  return (
    <Box component="span" sx={{ ml: 1, fontSize: 10, color: 'text.disabled', border: '1px solid', borderColor: 'divider', borderRadius: 0.5, px: 0.5 }}>
      有人补的
    </Box>
  );
}

type Fields = Record<string, string>;

const LABEL: Record<CogAssistKind, string> = {
  law: '补一条定律',
  place: '补一个地方',
  group: '补一群人',
  character: '补一个在这里活过的人',
  event: '补一段人生',
  insight: '写一句你看见的',
};

/** AI 候选 → 表单字段 */
function toFields(kind: CogAssistKind, it: Record<string, unknown>): Fields {
  const s = (k: string) => (typeof it[k] === 'string' ? (it[k] as string) : '');
  switch (kind) {
    case 'event':
      return {
        stage: s('stage') || 'young',
        situation: s('situation'),
        choice: s('choice'),
        alternatives: Array.isArray(it.alternatives) ? (it.alternatives as unknown[]).filter((x) => typeof x === 'string').join(' / ') : '',
        consequence: s('consequence'),
        axis: s('axis'),
      };
    case 'insight':
      return { text: s('text'), layer: String(it.layer || 2), axis: s('axis') };
    case 'law':
      return { text: s('text'), domain: s('domain') || 'society' };
    case 'character':
      return { name: s('name'), identity: s('identity'), arc: s('arc'), persona: s('persona') };
    default:
      return { name: s('name'), kind: s('kind'), description: s('description') };
  }
}

function summary(kind: CogAssistKind, f: Fields) {
  if (kind === 'event') return `${f.situation} → ${f.choice}`;
  if (kind === 'law' || kind === 'insight') return f.text;
  return `${f.name}${f.description ? ':' + f.description : f.arc ? ':' + f.arc : ''}`;
}

/** 补一条:表单 + AI 帮想 */
export function ContributeBox({
  kind,
  worldId,
  contentId,
  characterId,
  invalidate,
}: {
  kind: CogAssistKind;
  worldId?: string;
  contentId?: string;
  characterId?: string;
  /** 补成功后要刷新的查询 */
  invalidate: unknown[];
}) {
  const qc = useQueryClient();
  const { status } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState<Fields>({ domain: 'society', stage: 'young', layer: '2' });
  const [hint, setHint] = React.useState('');
  const [cands, setCands] = React.useState<Fields[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const v = (k: string) => f[k] || '';
  const setV = (k: string, val: string) => setF({ ...f, [k]: val });

  if (!open) {
    return (
      <Button
        size="small"
        onClick={() => (status === 'authenticated' ? setOpen(true) : (window.location.href = loginHref()))}
        sx={{ mt: 0.5, color: 'text.secondary' }}
      >
        + {LABEL[kind]}
      </Button>
    );
  }

  const think = async () => {
    if (!worldId) return;
    setBusy(true);
    setMsg('');
    try {
      const r = await cogAssist(worldId, kind, hint.trim(), characterId);
      setCands((r.items || []).map((it) => toFields(kind, it)));
    } catch (e) {
      setMsg(errMessage(e) || '一时没想出来,再试一次');
    } finally {
      setBusy(false);
    }
  };
  const submit = async () => {
    setBusy(true);
    setMsg('');
    try {
      let points = 0;
      if (kind === 'law') points = (await addLaw(worldId!, v('text'), v('domain'))).points;
      else if (kind === 'place' || kind === 'group') points = (await addPlace(worldId!, kind, { name: v('name'), kind: v('kind'), description: v('description') })).points;
      else if (kind === 'character') points = (await addCharacter(worldId!, { name: v('name'), identity: v('identity'), persona: v('persona'), arc: v('arc') })).points;
      else if (kind === 'event')
        points = (
          await addEvent(characterId!, {
            stage: v('stage'),
            situation: v('situation'),
            choice: v('choice'),
            alternatives: v('alternatives').split('/').map((s) => s.trim()).filter(Boolean),
            consequence: v('consequence'),
            axis: v('axis'),
          })
        ).points;
      else points = (await addInsight({ worldId, contentId, characterId, text: v('text'), layer: Number(v('layer') || 2), axis: v('axis') })).points;
      setMsg(points > 0 ? `补上了,+${points} 积分` : '补上了');
      setF({ domain: 'society', stage: 'young', layer: '2' });
      setCands([]);
      void qc.invalidateQueries({ queryKey: invalidate });
    } catch (e) {
      setMsg(errMessage(e) || '没补上,稍后再试');
    } finally {
      setBusy(false);
    }
  };

  const input = (k: string, placeholder: string, multiline = false) => (
    <TextField size="small" fullWidth multiline={multiline} value={v(k)} onChange={(e) => setV(k, e.target.value)} placeholder={placeholder} sx={{ mb: 1 }} />
  );
  const select = (k: string, opts: [string, string][], width = 110) => (
    <TextField select size="small" value={v(k)} onChange={(e) => setV(k, e.target.value)} sx={{ mb: 1, mr: 1, width }}>
      {opts.map(([val, name]) => (
        <MenuItem key={val} value={val}>{name}</MenuItem>
      ))}
    </TextField>
  );

  return (
    <Box sx={{ mt: 1, p: 1.5, borderRadius: 1.5, border: '1px dashed', borderColor: 'divider' }}>
      <Typography sx={{ fontSize: 13, mb: 1 }}>{LABEL[kind]}</Typography>
      {kind === 'law' && (
        <>
          {select('domain', DOMAINS)}
          {input('text', '一句这个世界的规矩(写通用的,不写具体情节)')}
        </>
      )}
      {(kind === 'place' || kind === 'group') && (
        <>
          {input('name', kind === 'place' ? '地方的名字' : '这群人叫什么')}
          {input('description', '一两句')}
        </>
      )}
      {kind === 'character' && (
        <>
          {input('name', '名字')}
          {input('identity', '出身、身份')}
          {input('arc', '一生的走向', true)}
        </>
      )}
      {kind === 'event' && (
        <>
          {select('stage', STAGES)}
          {input('situation', '那时的处境', true)}
          {input('choice', '他怎么选的')}
          {input('alternatives', '他本可以(用 / 隔开)')}
          {input('consequence', '后来怎样')}
        </>
      )}
      {kind === 'insight' && (
        <>
          {select('layer', LAYERS)}
          {input('text', '用自己的话写一句你看见的', true)}
        </>
      )}
      {worldId && (
        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <TextField size="small" fullWidth value={hint} onChange={(e) => setHint(e.target.value.slice(0, 200))} placeholder="给 AI 一句提示(可以不写)" />
          <Button size="small" variant="outlined" disabled={busy} onClick={think} sx={{ flexShrink: 0 }}>
            {busy ? '在想…' : 'AI 帮想'}
          </Button>
        </Box>
      )}
      {cands.map((c, i) => (
        <Box key={i} onClick={() => setF({ ...f, ...c })} sx={{ p: 1, mb: 0.5, fontSize: 13, borderRadius: 1, cursor: 'pointer', border: '1px solid', borderColor: 'divider', '&:hover': { borderColor: 'primary.main' } }}>
          用这个:{summary(kind, c)}
        </Box>
      ))}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
        <Button size="small" variant="contained" disabled={busy} onClick={submit}>补上</Button>
        <Button size="small" onClick={() => setOpen(false)} sx={{ color: 'text.secondary' }}>收起</Button>
        {msg && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{msg}</Typography>}
      </Box>
    </Box>
  );
}

/**
 * scene-ui/RuleForm.tsx — 规则的三种写法之一:表单(docs/WORLD-MODEL.md §6)
 *
 * 规则 = 当〈事件〉且〈条件〉就做〈一串效果〉。表单把它拆成选择框和输入框:
 *   - 事件:中文选项(被点、走进来、有人说话、有人进房……),也能写自定义事件名(别的规则 emit 来的);
 *   - 条件:一个表达式(state.open、actor.isOwner、contains(text, '芝麻开门')……),常用的点一下就填好;
 *   - 效果:每种效果有自己的几个格子(改状态的键和值、挪多远、说什么、等多久……);wait / if 里面还能再套一串效果。
 * 表单认不出来的效果(手写 JSON 的花样)原样留着,显示成一小段 JSON 可以直接改。
 * RulesEditor 在「表单 / JSON」之间切换,两边改的是同一份数据。AiCompose 是第三种写法:一句话交给 AI 出草稿。
 */

import React from 'react';
import { Box, Button, ButtonBase, CircularProgress, TextField, Typography } from '@mui/material';
import { composeWorld, type ComposeDraft, type ComposeTarget, type WorldRule } from '@/apis/world';

type Effect = Record<string, unknown>;
export type RuleScope = 'kind' | 'entity' | 'space' | 'material';

const mono = { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 11.5 } as const;
const inputSx = { '& .MuiInputBase-root': { color: '#fff', fontSize: 12, py: 0 }, '& .MuiInputBase-input': { py: 0.6, px: 0.9 }, '& fieldset': { borderColor: 'rgba(255,255,255,0.18)' } } as const;
const selectStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 6, fontSize: 12, padding: '4px 6px', minWidth: 0 };

/** 事件:value → 中文;scope 决定哪些能选 */
const EVENTS: { v: string; label: string; scopes: RuleScope[]; hint?: string }[] = [
  { v: 'use', label: '被点', scopes: ['kind', 'entity'] },
  { v: 'enter', label: '有人走进范围', scopes: ['kind', 'entity'], hint: '要有属性 zone(范围)' },
  { v: 'leave', label: '有人走出范围', scopes: ['kind', 'entity'], hint: '要有属性 zone(范围)' },
  { v: 'touch', label: '碰到', scopes: ['kind', 'entity'], hint: '要有属性 zone(范围)' },
  { v: 'touch', label: '有人踩上去 / 走进去', scopes: ['material'] },
  { v: 'leave', label: '有人离开这种积木', scopes: ['material'] },
  { v: 'say', label: '有人说话', scopes: ['kind', 'entity', 'space'], hint: '那句话在 text 里' },
  { v: 'changed', label: '自己的状态变了', scopes: ['kind', 'entity'], hint: 'key / old / new' },
  { v: 'spawn', label: '被生成出来', scopes: ['kind', 'entity'] },
  { v: 'remove', label: '被拿走', scopes: ['kind', 'entity'] },
  { v: 'join', label: '有人进了房间', scopes: ['space'] },
  { v: 'part', label: '有人离开房间', scopes: ['space'] },
];

/** 条件:点一下就填 */
const CONDS: { label: string; v: string }[] = [
  { label: '只有房主', v: 'actor.isOwner' },
  { label: '是真人', v: 'actor.isPlayer' },
  { label: '说了某句话', v: "contains(text, '芝麻开门')" },
  { label: '开着时', v: 'state.open' },
  { label: '一半概率', v: 'random() < 0.5' },
];

const TARGETS = [
  { v: '', label: '自己' },
  { v: 'actor', label: '触发的人' },
  { v: 'space', label: '整间房' },
];

const SOUNDS = ['click', 'door', 'coin', 'whoosh', 'chime', 'ding'];

type FieldKind = 'expr' | 'text' | 'num' | 'select' | 'target';
interface Field { k: string; label: string; kind: FieldKind; options?: { v: string; label: string }[]; placeholder?: string; width?: number }

/** 每种效果怎么画:fields 是参数对象里的格子;str = 参数也可以直接是一个字符串(那时它就是这一格) */
interface Spec { label: string; fields: Field[]; str?: string; nest?: ('do' | 'then' | 'else')[]; pairs?: boolean }
const SPECS: Record<string, Spec> = {
  set: { label: '改状态', fields: [{ k: 'target', label: '谁的', kind: 'target' }], pairs: true },
  add: { label: '加减数', fields: [{ k: 'target', label: '谁的', kind: 'target' }], pairs: true },
  toggle: { label: '开 / 关', fields: [{ k: 'key', label: '状态名', kind: 'text', placeholder: 'open' }, { k: 'target', label: '谁的', kind: 'target' }], str: 'key' },
  move: { label: '挪动', fields: [{ k: 'dx', label: '→x 米', kind: 'num', width: 64 }, { k: 'dy', label: '↑y 米', kind: 'num', width: 64 }, { k: 'dz', label: '→z 米', kind: 'num', width: 64 }, { k: 'ms', label: '用时 ms', kind: 'num', width: 70 }, { k: 'target', label: '谁', kind: 'target' }] },
  rotate: { label: '转', fields: [{ k: 'dy', label: '转多少度', kind: 'num', width: 80 }, { k: 'ms', label: '用时 ms', kind: 'num', width: 70 }, { k: 'target', label: '谁', kind: 'target' }] },
  scale: { label: '变大小', fields: [{ k: 's', label: '倍数', kind: 'num', width: 64 }, { k: 'ms', label: '用时 ms', kind: 'num', width: 70 }, { k: 'target', label: '谁', kind: 'target' }] },
  spawn: { label: '生成一个', fields: [{ k: 'kind', label: '原型', kind: 'text', placeholder: 'star' }, { k: 'x', label: 'x', kind: 'num', width: 56 }, { k: 'z', label: 'z', kind: 'num', width: 56 }] },
  remove: { label: '拿走', fields: [{ k: '$', label: '谁(self / tag:名字)', kind: 'text', placeholder: 'self' }], str: '$' },
  teleport: { label: '传送人', fields: [{ k: 'to', label: '到哪(tag:名字 / space:room:uid)', kind: 'text', placeholder: 'tag:exit' }] },
  say: { label: '头顶冒字', fields: [{ k: '$', label: '说什么({{state.x}} 嵌值)', kind: 'text' }], str: '$' },
  toast: { label: '提示条', fields: [{ k: 'text', label: '说什么', kind: 'text' }, { k: 'to', label: '给谁', kind: 'select', options: [{ v: '', label: '房里所有人' }, { v: 'actor', label: '触发的人' }] }], str: 'text' },
  label: { label: '改牌子', fields: [{ k: '$', label: '牌子上写', kind: 'text' }], str: '$' },
  sound: { label: '放声音', fields: [{ k: '$', label: '声音', kind: 'select', options: SOUNDS.map((s) => ({ v: s, label: s })) }], str: '$' },
  emit: { label: '发信号', fields: [{ k: 'event', label: '信号名', kind: 'text', placeholder: 'open' }, { k: 'to', label: '发给(tag:名字 / space)', kind: 'text', placeholder: 'tag:door' }] },
  env: { label: '改时辰天气', fields: [{ k: 'time', label: '时辰', kind: 'select', options: [{ v: '', label: '不变' }, { v: 'dawn', label: '清晨' }, { v: 'day', label: '白天' }, { v: 'dusk', label: '黄昏' }, { v: 'night', label: '夜里' }] }, { k: 'weather', label: '天气', kind: 'select', options: [{ v: '', label: '不变' }, { v: 'clear', label: '晴' }, { v: 'rain', label: '雨' }, { v: 'snow', label: '雪' }, { v: 'petals', label: '花瓣' }] }] },
  wait: { label: '过一会儿', fields: [{ k: 'ms', label: '等多少 ms', kind: 'num', width: 80 }], nest: ['do'] },
  if: { label: '如果', fields: [], nest: ['then', 'else'] },
};
const EFFECT_ORDER = ['set', 'add', 'toggle', 'say', 'toast', 'label', 'sound', 'move', 'rotate', 'scale', 'spawn', 'remove', 'teleport', 'emit', 'env', 'wait', 'if'];

const NEW_EFFECT: Record<string, () => Effect> = {
  set: () => ({ set: { open: 'true' } }),
  add: () => ({ add: { count: 1 } }),
  toggle: () => ({ toggle: 'open' }),
  move: () => ({ move: { dy: 0.5, ms: 400 } }),
  rotate: () => ({ rotate: { dy: 90, ms: 400 } }),
  scale: () => ({ scale: { s: 1.5, ms: 300 } }),
  spawn: () => ({ spawn: { kind: 'star' } }),
  remove: () => ({ remove: 'self' }),
  teleport: () => ({ teleport: { to: 'tag:exit' } }),
  say: () => ({ say: '你好' }),
  toast: () => ({ toast: { text: '欢迎', to: 'actor' } }),
  label: () => ({ label: '{{state.count}}' }),
  sound: () => ({ sound: 'click' }),
  emit: () => ({ emit: { event: 'open', to: 'tag:door' } }),
  env: () => ({ env: { time: 'night' } }),
  wait: () => ({ wait: { ms: 3000, do: [] } }),
  if: () => ({ if: 'state.open', then: [], else: [] }),
};

/** 一个效果是哪种(if 的 then / else 不算名字) */
export function effectKind(e: Effect): string {
  if ('if' in e) return 'if';
  return Object.keys(e).find((k) => k !== 'then' && k !== 'else') ?? '?';
}

/** 表单认得这个效果吗(不认得就整段 JSON 显示) */
export function formable(e: Effect): boolean {
  const k = effectKind(e);
  const spec = SPECS[k];
  if (!spec) return false;
  if (k === 'if') return typeof e.if === 'string';
  const arg = e[k];
  if (typeof arg === 'string') return !!spec.str;
  if (!arg || typeof arg !== 'object' || Array.isArray(arg)) return false;
  if (spec.pairs) return true;
  const known = new Set([...spec.fields.map((f) => f.k), ...(spec.nest ?? [])]);
  return Object.keys(arg).every((k2) => known.has(k2));
}

/** 数字格:能当数字就存数字,否则当表达式字符串存 */
function numOrExpr(s: string): unknown {
  const t = s.trim();
  if (t === '') return undefined;
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : t;
}

function Small({ value, onChange, placeholder, width, title, mono: m }: { value: string; onChange: (v: string) => void; placeholder?: string; width?: number; title?: string; mono?: boolean }) {
  return <TextField size="small" title={title} value={value} placeholder={placeholder ?? title} onChange={(e) => onChange(e.target.value)} sx={{ ...inputSx, width: width ?? 'auto', flex: width ? 'none' : 1, minWidth: width ?? 90, ...(m ? { '& .MuiInputBase-input': { ...mono, py: 0.6, px: 0.9 } } : {}) }} />;
}

function EffectRow({ eff, onChange, onRemove, onMove, depth, scope }: {
  eff: Effect; onChange: (e: Effect) => void; onRemove: () => void; onMove: (d: -1 | 1) => void; depth: number; scope: RuleScope;
}) {
  const kind = effectKind(eff);
  const spec = SPECS[kind];
  const [raw, setRaw] = React.useState(() => JSON.stringify(eff));
  const [rawErr, setRawErr] = React.useState('');
  React.useEffect(() => { setRaw(JSON.stringify(eff)); }, [eff]);
  const head = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
      <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#9be8ff', flex: 1 }}>{spec?.label ?? kind}</Typography>
      <ButtonBase onClick={() => onMove(-1)} sx={{ fontSize: 11, px: 0.5, color: 'rgba(255,255,255,0.5)' }} aria-label="上移">↑</ButtonBase>
      <ButtonBase onClick={() => onMove(1)} sx={{ fontSize: 11, px: 0.5, color: 'rgba(255,255,255,0.5)' }} aria-label="下移">↓</ButtonBase>
      <ButtonBase onClick={onRemove} sx={{ fontSize: 11, px: 0.5, color: '#ffb0b0' }} aria-label="删掉这个效果">✕</ButtonBase>
    </Box>
  );
  const box = { p: 0.75, borderRadius: 1.5, bgcolor: depth ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' } as const;
  if (!spec || !formable(eff)) {
    return (
      <Box sx={box}>
        {head}
        <TextField multiline minRows={1} maxRows={6} value={raw} onChange={(e) => setRaw(e.target.value)} sx={{ ...inputSx, width: '100%', '& .MuiInputBase-input': { ...mono } }}
          onBlur={() => { try { onChange(JSON.parse(raw) as Effect); setRawErr(''); } catch (e) { setRawErr((e as Error).message); } }} />
        {rawErr && <Typography sx={{ fontSize: 10.5, color: '#ff9b9b' }}>{rawErr}</Typography>}
      </Box>
    );
  }
  const arg = eff[kind];
  const obj: Record<string, unknown> = typeof arg === 'string' ? { [spec.str ?? '$']: arg } : { ...((arg as Record<string, unknown>) ?? {}) };
  const write = (next: Record<string, unknown>) => {
    // 只有字符串那一格有值时,写回成简写的字符串(和手写的一样)
    // 空着的格子不写进去;改状态那几对(键 → 值)正在输入时可以是空的,先留着
    const keys = Object.keys(next).filter((k) => next[k] !== undefined && (next[k] !== '' || (spec.pairs && k !== 'target')));
    if (spec.str && keys.length === 1 && keys[0] === spec.str && typeof next[spec.str] === 'string' && !spec.nest) {
      onChange({ [kind]: next[spec.str] });
      return;
    }
    const clean: Record<string, unknown> = {};
    for (const k of keys) clean[k === '$' ? 'name' : k] = next[k];
    onChange({ [kind]: clean });
  };
  const set = (k: string, v: unknown) => write({ ...obj, [k]: v });
  if (kind === 'if') {
    return (
      <Box sx={box}>
        {head}
        <Small value={String(eff.if ?? '')} onChange={(v) => onChange({ ...eff, if: v })} title="条件(表达式)" mono />
        {(['then', 'else'] as const).map((b) => (
          <Box key={b} sx={{ mt: 0.5, pl: 1, borderLeft: '2px solid rgba(155,232,255,0.25)' }}>
            <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)' }}>{b === 'then' ? '是的话' : '不是的话'}</Typography>
            <EffectList list={(eff[b] as Effect[]) ?? []} onChange={(l) => onChange({ ...eff, [b]: l })} depth={depth + 1} scope={scope} />
          </Box>
        ))}
      </Box>
    );
  }
  return (
    <Box sx={box}>
      {head}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {spec.pairs && Object.keys(obj).filter((k) => k !== 'target').map((k, i, keys) => (
          <Box key={i} sx={{ display: 'flex', gap: 0.5, width: '100%' }}>
            <Small value={k} title="状态名" width={96} onChange={(nk) => { const next: Record<string, unknown> = {}; for (const [kk, vv] of Object.entries(obj)) next[kk === k ? nk : kk] = vv; write(next); }} />
            <Small value={typeof obj[k] === 'string' ? (obj[k] as string) : JSON.stringify(obj[k])} title={kind === 'add' ? '加多少(负数是减)' : '变成(表达式:true、1、state.x + 1、\'文字\')'} mono onChange={(v) => set(k, numOrExpr(v) ?? '')} />
            {keys.length > 1 && <ButtonBase onClick={() => { const next = { ...obj }; delete next[k]; write(next); }} sx={{ fontSize: 11, color: '#ffb0b0', px: 0.5 }}>−</ButtonBase>}
          </Box>
        ))}
        {spec.pairs && <ButtonBase onClick={() => set(`key${Object.keys(obj).length}`, 1)} sx={{ fontSize: 11, color: '#9be8ff', px: 0.5 }}>＋ 再改一个</ButtonBase>}
        {spec.fields.map((f) => {
          const v = obj[f.k];
          const sv = v === undefined || v === null ? '' : typeof v === 'string' ? v : String(v);
          if (f.kind === 'select' || f.kind === 'target') {
            const opts = f.kind === 'target' ? TARGETS : f.options ?? [];
            const custom = sv !== '' && !opts.some((o) => o.v === sv);
            return (
              <Box key={f.k} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)' }}>{f.label}</Typography>
                <select aria-label={f.label} style={selectStyle} value={custom ? '__custom' : sv} onChange={(e) => set(f.k, e.target.value === '__custom' ? 'tag:' : e.target.value || undefined)}>
                  {opts.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                  {f.kind === 'target' && <option value="__custom">带标签的(tag:…)</option>}
                </select>
                {custom && <Small value={sv} width={110} onChange={(x) => set(f.k, x)} title="tag:名字" />}
              </Box>
            );
          }
          return <Small key={f.k} value={sv} title={f.label} placeholder={f.placeholder ? `${f.label}:${f.placeholder}` : f.label} width={f.width} mono={f.kind !== 'text'} onChange={(x) => set(f.k, f.kind === 'num' ? numOrExpr(x) : x)} />;
        })}
      </Box>
      {spec.nest?.map((n) => (
        <Box key={n} sx={{ mt: 0.5, pl: 1, borderLeft: '2px solid rgba(155,232,255,0.25)' }}>
          <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)' }}>然后</Typography>
          <EffectList list={(obj[n] as Effect[]) ?? []} onChange={(l) => set(n, l)} depth={depth + 1} scope={scope} />
        </Box>
      ))}
    </Box>
  );
}

function EffectList({ list, onChange, depth, scope }: { list: Effect[]; onChange: (l: Effect[]) => void; depth: number; scope: RuleScope }) {
  const [adding, setAdding] = React.useState('');
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {list.map((eff, i) => (
        <EffectRow key={i} eff={eff} depth={depth} scope={scope}
          onChange={(e) => onChange(list.map((x, j) => (j === i ? e : x)))}
          onRemove={() => onChange(list.filter((_, j) => j !== i))}
          onMove={(d) => { const j = i + d; if (j < 0 || j >= list.length) return; const next = [...list]; [next[i], next[j]] = [next[j], next[i]]; onChange(next); }} />
      ))}
      <select aria-label="加一个效果" style={{ ...selectStyle, color: '#9be8ff', alignSelf: 'flex-start' }} value={adding}
        onChange={(e) => { const k = e.target.value; setAdding(''); if (k && NEW_EFFECT[k]) onChange([...list, NEW_EFFECT[k]()]); }}>
        <option value="">＋ 加一个效果…</option>
        {EFFECT_ORDER.map((k) => <option key={k} value={k}>{SPECS[k].label}</option>)}
      </select>
    </Box>
  );
}

/** 规则列表的表单 */
export function RuleListForm({ rules, onChange, scope }: { rules: WorldRule[]; onChange: (r: WorldRule[]) => void; scope: RuleScope }) {
  const events = EVENTS.filter((e) => e.scopes.includes(scope));
  const setRule = (i: number, r: WorldRule) => onChange(rules.map((x, j) => (j === i ? r : x)));
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {rules.length === 0 && <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)' }}>还没有规则。加一条:当什么事发生,就做什么。</Typography>}
      {rules.map((r, i) => {
        const known = events.some((e) => e.v === r.on);
        const hint = events.find((e) => e.v === r.on)?.hint;
        return (
          <Box key={i} sx={{ p: 0.75, borderRadius: 2, bgcolor: 'rgba(37,244,238,0.05)', border: '1px solid rgba(37,244,238,0.18)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: 12, fontWeight: 800 }}>当</Typography>
              <select aria-label="事件" style={selectStyle} value={known ? r.on : '__custom'} onChange={(e) => setRule(i, { ...r, on: e.target.value === '__custom' ? 'my-signal' : e.target.value })}>
                {events.map((e) => <option key={e.v} value={e.v}>{e.label}</option>)}
                <option value="__custom">收到信号(自定义)…</option>
              </select>
              {!known && <Small value={r.on} width={110} title="信号名(别的规则 emit 的)" onChange={(v) => setRule(i, { ...r, on: v })} />}
              <Box sx={{ flex: 1 }} />
              <ButtonBase onClick={() => onChange(rules.filter((_, j) => j !== i))} sx={{ fontSize: 11, color: '#ffb0b0', px: 0.5 }}>删这条</ButtonBase>
            </Box>
            {hint && <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)' }}>{hint}</Typography>}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 800 }}>且</Typography>
              <Small value={r.if ?? ''} title="条件(可以不写)" placeholder="条件(可以不写,比如 actor.isOwner)" mono onChange={(v) => { const next: WorldRule = { ...r, if: v }; if (!v) delete next.if; setRule(i, next); }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.25 }}>
              {CONDS.map((c) => <ButtonBase key={c.label} onClick={() => setRule(i, { ...r, if: r.if ? `(${r.if}) && ${c.v}` : c.v })} sx={{ fontSize: 10.5, px: 0.75, py: 0.1, borderRadius: 5, bgcolor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)' }}>{c.label}</ButtonBase>)}
            </Box>
            <Typography sx={{ fontSize: 12, fontWeight: 800, mt: 0.5, mb: 0.25 }}>就</Typography>
            <EffectList list={(r.do ?? []) as Effect[]} onChange={(l) => setRule(i, { ...r, do: l })} depth={0} scope={scope} />
          </Box>
        );
      })}
      <Button size="small" variant="outlined" onClick={() => onChange([...rules, { on: events[0].v, do: [] }])} sx={{ alignSelf: 'flex-start', color: '#9be8ff', borderColor: 'rgba(155,232,255,0.4)', fontSize: 12 }}>＋ 加一条规则</Button>
    </Box>
  );
}

/** 表单 / JSON 两种写法切换,改的是同一份规则 */
export function RulesEditor({ rules, onChange, scope }: { rules: WorldRule[]; onChange: (r: WorldRule[]) => void; scope: RuleScope }) {
  const [mode, setMode] = React.useState<'form' | 'json'>('form');
  const [text, setText] = React.useState(() => JSON.stringify(rules, null, 2));
  const [err, setErr] = React.useState('');
  React.useEffect(() => { if (mode === 'form') setText(JSON.stringify(rules, null, 2)); }, [rules, mode]);
  const tab = (m: 'form' | 'json', label: string) => (
    <ButtonBase onClick={() => { if (m === 'form' && mode === 'json') { try { onChange(JSON.parse(text || '[]') as WorldRule[]); setErr(''); } catch (e) { setErr(`JSON 写错了:${(e as Error).message}`); return; } } setMode(m); }}
      sx={{ fontSize: 11.5, px: 1, py: 0.25, borderRadius: 5, bgcolor: mode === m ? 'rgba(37,244,238,0.2)' : 'transparent', color: mode === m ? '#fff' : 'rgba(255,255,255,0.55)' }}>{label}</ButtonBase>
  );
  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 0.5, mb: 0.5 }}>{tab('form', '表单')}{tab('json', 'JSON')}</Box>
      {mode === 'form' ? <RuleListForm rules={rules} onChange={onChange} scope={scope} /> : (
        <TextField multiline minRows={4} maxRows={18} value={text} onChange={(e) => setText(e.target.value)} sx={{ ...inputSx, width: '100%', '& .MuiInputBase-input': { ...mono } }}
          onBlur={() => { try { onChange(JSON.parse(text || '[]') as WorldRule[]); setErr(''); } catch (e) { setErr(`JSON 写错了:${(e as Error).message}`); } }} />
      )}
      {err && <Typography sx={{ fontSize: 11, color: '#ff9b9b' }}>{err}</Typography>}
    </Box>
  );
}

const AI_HINTS: Record<ComposeTarget, string> = {
  kind: '比如:做一个点一下就转圈的风车 / 一盏走近就亮的灯',
  entity: '比如:只有我能开、开了 10 秒自动关',
  space: '比如:有人进来就说欢迎,说「关灯」就变成夜里',
};

/** 第三种写法:一句话交给 AI,出来的是草稿,填进上面的编辑器,人看过再存 */
export function AiCompose({ target, current, onDraft }: { target: ComposeTarget; current?: unknown; onDraft: (d: ComposeDraft) => void }) {
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<{ ok: boolean; text: string; errors?: string[] } | null>(null);
  const go = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const d = await composeWorld(text.trim(), target, current);
      onDraft(d);
      setNote({ ok: !d.errors?.length, text: d.explain || '写好了', errors: d.errors });
    } catch (e) {
      setNote({ ok: false, text: (e as Error)?.message || 'AI 没写出来' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Box sx={{ p: 0.75, borderRadius: 2, bgcolor: 'rgba(181,140,255,0.08)', border: '1px solid rgba(181,140,255,0.25)' }}>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <TextField size="small" value={text} placeholder={`✨ 一句话交给 AI —— ${AI_HINTS[target]}`} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void go(); } }} sx={{ ...inputSx, flex: 1 }} slotProps={{ htmlInput: { maxLength: 300 } }} />
        <Button size="small" variant="contained" disabled={busy || !text.trim()} onClick={() => void go()} sx={{ minWidth: 0, px: 1.25, bgcolor: '#8a63d2' }}>{busy ? <CircularProgress size={14} /> : '写'}</Button>
      </Box>
      {note && (
        <Box sx={{ mt: 0.5 }}>
          <Typography sx={{ fontSize: 11.5, color: note.ok ? 'rgba(255,255,255,0.8)' : '#ffd27a' }}>{note.ok ? '🤖 ' : '⚠️ '}{note.text}{note.ok ? '(草稿已经填进下面,看过再存)' : ''}</Typography>
          {note.errors?.map((e) => <Typography key={e} sx={{ fontSize: 10.5, color: '#ff9b9b' }}>· {e}</Typography>)}
        </Box>
      )}
    </Box>
  );
}

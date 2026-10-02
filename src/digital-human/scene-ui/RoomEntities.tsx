/**
 * scene-ui/RoomEntities.tsx — 世界模型(docs/WORLD-MODEL.md)的编辑入口
 *
 *   - KindsDrawer:布置抽屉里的「机关」一栏 —— 平台原型(灯、门、按钮、告示牌、传送区、星星……)和我自己的原型,
 *     点「放一个」就按原型放一个实体;「＋ 新原型」写一个原型(外观、属性、状态、规则),服务端先校验再存;
 *     最上面「整间房的规则」:有人进房 / 离开、有人说话、收到信号时整间房做什么(空间级规则和空间状态)。
 *   - EntityPanel:选中一件东西时,看它的原型、算好的属性,改它的原型 / 状态 / 规则 / 标签,存的时候服务端校验规则。
 *     原型空着 = 用素材的默认原型(椅子是 seat、灯是 lamp……),写 "-" = 只是摆着看。
 * 三种写法写同一份数据:表单(RuleForm)、JSON、一句话交给 AI(出草稿,人看过再存)。
 */

import React from 'react';
import { Box, Button, ButtonBase, Chip, CircularProgress, Switch, TextField, Typography } from '@mui/material';
import { deleteKind, getSpaceRules, listKinds, resetRoomPlayers, saveKind, saveSpaceRules, type ComposeDraft, type WorldKind, type WorldPlacement, type WorldRule } from '@/apis/world';
import { AiCompose, RulesEditor } from './RuleForm';

const NEW_KIND: Record<string, unknown> = {
  key: 'my-thing',
  name: '我的机关',
  look: { shape: 'box', color: '#88ccff', size: [0.3, 0.3, 0.3] },
  state: { count: 0 },
  props: { solid: true, label: { text: '被点了 {{state.count}} 次' } },
  rules: [{ on: 'use', do: [{ add: { count: 1 } }, { say: '第 {{state.count}} 次' }] }],
};

const CHEAT = '表达式:state.x、actor.isOwner、actor.state.x、space.state.x、text;文字里用 {{表达式}}。'
  + '属性:solid 挡人 · visible 看得见 · sittable 能坐 · emits {color,intensity,radius} 发光 · label {text} 头顶字 · zone {hx,hy,hz} 感应范围'
  + ' · movable 推得动 · portal {to: room:uid / plaza / tag:名字} 走进去送走(配 zone)'
  + ' · sound {key, volume, radius} 走近了循环出声(key 是声音库的,比如 amb_stream 流水、amb_fire 篝火、amb_chimes 风铃)。外观 material: 积木物质 id。';

const mono = { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 11.5 } as const;
const field = { '& .MuiInputBase-root': { color: '#fff', ...mono }, '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } as const;
const selectStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 6, fontSize: 12, padding: '4px 6px' };

function errText(e: unknown) { return (e as Error)?.message || '没成功'; }
const label = (t: string) => <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', mt: 0.5 }}>{t}</Typography>;

/** 一小块 JSON(状态 / 属性):失焦时解析,写错了就地提示 */
function JsonBox({ value, onChange, minRows = 2 }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void; minRows?: number }) {
  const [text, setText] = React.useState(() => JSON.stringify(value ?? {}, null, 2));
  const [err, setErr] = React.useState('');
  const last = React.useRef(JSON.stringify(value ?? {}));
  React.useEffect(() => {
    const s = JSON.stringify(value ?? {});
    if (s !== last.current) { last.current = s; setText(JSON.stringify(value ?? {}, null, 2)); setErr(''); }
  }, [value]);
  return (
    <>
      <TextField multiline minRows={minRows} maxRows={10} value={text} onChange={(e) => setText(e.target.value)} sx={field}
        onBlur={() => {
          try {
            const v = JSON.parse(text || '{}') as Record<string, unknown>;
            if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('要是一个 {…} 对象');
            last.current = JSON.stringify(v);
            onChange(v);
            setErr('');
          } catch (e) { setErr(`JSON 写错了:${errText(e)}`); }
        }} />
      {err && <Typography sx={{ fontSize: 11, color: '#ff9b9b' }}>{err}</Typography>}
    </>
  );
}

/** 常用属性:点一下加上 / 去掉 */
const PROP_CHIPS: { k: string; label: string; v: unknown }[] = [
  { k: 'solid', label: '挡人', v: true },
  { k: 'sittable', label: '能坐', v: true },
  { k: 'emits', label: '发光', v: { color: '#ffc98a', intensity: 3, radius: 4 } },
  { k: 'zone', label: '感应范围', v: { hx: 0.6, hy: 1, hz: 0.6 } },
  { k: 'label', label: '头顶字', v: { text: '{{state.text}}' } },
  { k: 'movable', label: '推得动', v: true },
  { k: 'sound', label: '持续出声', v: { key: 'amb_stream', volume: 0.8, radius: 6 } },
  { k: 'portal', label: '传送门', v: { to: 'plaza' } },
];

/** 原型的表单:名字、继承、外观、状态、属性、规则 */
function KindForm({ def, onChange, kinds, isNew }: { def: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void; kinds: WorldKind[]; isNew: boolean }) {
  const look = (def.look as Record<string, unknown>) ?? {};
  const size = Array.isArray(look.size) ? (look.size as number[]) : [0.3, 0.3, 0.3];
  const props = (def.props as Record<string, unknown>) ?? {};
  const set = (k: string, v: unknown) => { const next = { ...def, [k]: v }; if (v === undefined || v === '') delete next[k]; onChange(next); };
  const setLook = (k: string, v: unknown) => { const next = { ...look, [k]: v }; if (v === undefined || v === '') delete next[k]; set('look', next); };
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <TextField size="small" label="名字" value={String(def.name ?? '')} onChange={(e) => set('name', e.target.value)} sx={{ ...field, flex: 1 }} />
        {isNew && <TextField size="small" label="key" value={String(def.key ?? '')} onChange={(e) => set('key', e.target.value)} sx={{ ...field, width: 120 }} />}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>照着</Typography>
        <select aria-label="继承的原型" style={selectStyle} value={String(def.extends ?? '')} onChange={(e) => set('extends', e.target.value || undefined)}>
          <option value="">不继承</option>
          {kinds.filter((k) => k.key !== def.key).map((k) => <option key={k.key} value={k.key}>{k.name || k.key}</option>)}
        </select>
        <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)' }}>(继承它的外观、属性、规则,再改)</Typography>
      </Box>
      {label('外观:素材模型 key,或者没有模型时画个简单形状')}
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" placeholder="模型 key(可空)" value={String(look.model ?? '')} onChange={(e) => setLook('model', e.target.value)} sx={{ ...field, width: 150 }} />
        <select aria-label="形状" style={selectStyle} value={String(look.shape ?? '')} onChange={(e) => setLook('shape', e.target.value || undefined)}>
          <option value="">无形状</option><option value="box">盒子</option><option value="cylinder">圆柱</option><option value="sphere">球</option><option value="disc">圆盘</option>
        </select>
        <Box component="input" type="color" aria-label="颜色" value={String(look.color ?? '#88ccff')} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLook('color', e.target.value)} sx={{ width: 30, height: 24, p: 0, border: 0, bgcolor: 'transparent' }} />
        {['半宽', '半高', '半深'].map((t, i) => (
          <TextField key={t} size="small" title={`${t}(米)`} placeholder={t} value={String(size[i] ?? '')} sx={{ ...field, width: 58 }}
            onChange={(e) => { const s = [...size]; s[i] = Number(e.target.value) || 0; setLook('size', s); }} />
        ))}
      </Box>
      {label('状态(规则读写的变量,这里是默认值)')}
      <JsonBox value={(def.state as Record<string, unknown>) ?? {}} onChange={(v) => set('state', v)} />
      {label('属性(值可以是表达式,比如 "solid": "!state.open")')}
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {PROP_CHIPS.map((c) => {
          const on = c.k in props && props[c.k] !== false;
          return <ButtonBase key={c.k} onClick={() => { const next = { ...props }; if (on) delete next[c.k]; else next[c.k] = c.v; set('props', next); }}
            sx={{ fontSize: 11, px: 0.9, py: 0.2, borderRadius: 5, bgcolor: on ? 'rgba(37,244,238,0.22)' : 'rgba(255,255,255,0.07)', color: on ? '#fff' : 'rgba(255,255,255,0.65)' }}>{on ? '✓ ' : '＋ '}{c.label}</ButtonBase>;
        })}
      </Box>
      <JsonBox value={props} onChange={(v) => set('props', v)} />
      {label('规则')}
      <RulesEditor rules={(def.rules as WorldRule[]) ?? []} onChange={(r) => set('rules', r)} scope="kind" />
    </Box>
  );
}

/** 写 / 改一个原型:表单、JSON、AI 三种写法 */
function KindEditor({ initial, editKey, initialPublic, kinds, onDone, onCancel, toast }: {
  initial: Record<string, unknown>; editKey?: string; initialPublic: boolean; kinds: WorldKind[];
  onDone: () => void; onCancel: () => void; toast: (icon: string, text: string) => void;
}) {
  const [def, setDef] = React.useState(initial);
  const [mode, setMode] = React.useState<'form' | 'json'>('form');
  const [text, setText] = React.useState(() => JSON.stringify(initial, null, 2));
  const [pub, setPub] = React.useState(initialPublic);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const fromText = (): Record<string, unknown> | null => {
    try { const v = JSON.parse(text) as Record<string, unknown>; setErr(''); return v; } catch (e) { setErr(`JSON 写错了:${errText(e)}`); return null; }
  };
  const switchTo = (m: 'form' | 'json') => {
    if (m === mode) return;
    if (m === 'form') { const v = fromText(); if (!v) return; setDef(v); } else setText(JSON.stringify(def, null, 2));
    setMode(m);
  };
  const onDraft = (d: ComposeDraft) => {
    if (!d.kind) return;
    const next = { ...d.kind } as Record<string, unknown>;
    if (editKey) delete next.key;
    setDef(next);
    setText(JSON.stringify(next, null, 2));
  };
  const save = async () => {
    const body = mode === 'json' ? fromText() : def;
    if (!body) return;
    setBusy(true);
    setErr('');
    try {
      const k = await saveKind(body, { key: editKey, visibility: pub ? 'public' : 'private' });
      toast('🧩', `原型「${k.name || k.key}」存好了${pub ? '(公开)' : ''}`);
      onDone();
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };
  const tab = (m: 'form' | 'json', t: string) => <ButtonBase onClick={() => switchTo(m)} sx={{ fontSize: 11.5, px: 1, py: 0.25, borderRadius: 5, bgcolor: mode === m ? 'rgba(37,244,238,0.2)' : 'transparent', color: mode === m ? '#fff' : 'rgba(255,255,255,0.55)' }}>{t}</ButtonBase>;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{editKey ? `改「${editKey}」` : '新原型(key 会自动加上你的前缀)'}</Typography>
      <AiCompose target="kind" current={mode === 'json' ? undefined : def} onDraft={onDraft} />
      <Box sx={{ display: 'flex', gap: 0.5 }}>{tab('form', '表单')}{tab('json', 'JSON')}</Box>
      {mode === 'form'
        ? <KindForm def={def} onChange={setDef} kinds={kinds} isNew={!editKey} />
        : <TextField multiline minRows={10} maxRows={22} value={text} onChange={(e) => setText(e.target.value)} sx={field} />}
      {err && <Typography sx={{ fontSize: 11.5, color: '#ff9b9b', whiteSpace: 'pre-wrap' }}>{err}</Typography>}
      <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{CHEAT}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', fontSize: 12 }}>
        <Switch size="small" checked={pub} onChange={(e) => setPub(e.target.checked)} />
        {pub ? '公开:别人也能放这个原型、照着做' : '只有我自己用'}
      </Box>
      <Box sx={{ display: 'flex', gap: 0.75 }}>
        <Button size="small" variant="contained" disabled={busy} onClick={() => void save()} sx={{ flex: 1 }}>{busy ? <CircularProgress size={14} /> : '存'}</Button>
        <Button size="small" onClick={onCancel} sx={{ color: '#9be8ff' }}>取消</Button>
      </Box>
    </Box>
  );
}

/** 整间房的规则(空间级):有人进房 / 离开、有人说话、收到信号…… */
export function SpaceRulesPanel({ toast }: { toast: (icon: string, text: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [rules, setRules] = React.useState<WorldRule[] | null>(null);
  const [state, setState] = React.useState<Record<string, unknown>>({});
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  React.useEffect(() => {
    if (!open || rules) return;
    getSpaceRules().then((r) => { setRules(r.rules); setState(r.state); }).catch((e) => { setRules([]); setErr(errText(e)); });
  }, [open, rules]);
  const save = async () => {
    if (!rules) return;
    setBusy(true);
    setErr('');
    try {
      const r = await saveSpaceRules({ rules, state });
      setRules(r.rules);
      setState(r.state);
      toast('🏠', '整间房的规则存好了,马上生效');
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(255,210,122,0.06)', border: '1px solid rgba(255,210,122,0.2)' }}>
      <ButtonBase onClick={() => setOpen((v) => !v)} sx={{ display: 'flex', width: '100%', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 700 }}>
        <span>🏠 整间房的规则{rules && rules.length ? `(${rules.length} 条)` : ''}</span>
        <span style={{ color: '#ffd27a', fontWeight: 400 }}>{open ? '收起' : '有人进来、说话时……'}</span>
      </ButtonBase>
      {open && (!rules ? <Box sx={{ display: 'grid', placeItems: 'center', py: 1 }}><CircularProgress size={16} /></Box> : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 0.75 }}>
          <AiCompose target="space" current={{ rules, state }} onDraft={(d) => { if (d.rules) setRules(d.rules); if (d.state) setState({ ...state, ...d.state }); }} />
          <RulesEditor rules={rules} onChange={setRules} scope="space" />
          {label('整间房的状态(规则里用 space.state.x 读写)')}
          <JsonBox value={state} onChange={setState} />
          {err && <Typography sx={{ fontSize: 11.5, color: '#ff9b9b', whiteSpace: 'pre-wrap' }}>{err}</Typography>}
          <Button size="small" variant="contained" disabled={busy} onClick={() => void save()}>{busy ? <CircularProgress size={14} /> : '存'}</Button>
          <Button size="small" onClick={() => {
            if (!window.confirm('清空所有来过的人在这间房里的状态(分数、背包、通关记号……)?相当于重开一局')) return;
            resetRoomPlayers().then((r) => toast('🧹', `清空了 ${r.cleared} 个人的状态`)).catch((e) => toast('⚠️', errText(e)));
          }} sx={{ color: '#ffb0b0', fontSize: 12 }}>清空所有人的状态(重开一局)</Button>
        </Box>
      ))}
    </Box>
  );
}

/** 原型去掉列表里才有的字段,剩下的就是定义 */
function defOf(k: WorldKind): Record<string, unknown> {
  const { ownerId: _o, mine: _m, visibility: _v, ...def } = k as WorldKind & { match?: unknown };
  const out: Record<string, unknown> = { ...def };
  delete out.match;
  return out;
}

export function KindsDrawer({ onPlace, toast }: {
  onPlace: (kind: WorldKind) => void;
  toast: (icon: string, text: string) => void;
}) {
  const [list, setList] = React.useState<WorldKind[] | null>(null);
  const [editing, setEditing] = React.useState<{ key?: string; def: Record<string, unknown>; pub: boolean } | null>(null);
  const load = React.useCallback(() => { listKinds().then(setList).catch(() => setList([])); }, []);
  React.useEffect(load, [load]);

  if (editing) {
    return <KindEditor initial={editing.def} editKey={editing.key} initialPublic={editing.pub} kinds={list ?? []} toast={toast}
      onCancel={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} />;
  }
  if (!list) return <Box sx={{ display: 'grid', placeItems: 'center', py: 2 }}><CircularProgress size={18} /></Box>;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <SpaceRulesPanel toast={toast} />
      <Button size="small" variant="outlined" onClick={() => setEditing({ def: NEW_KIND, pub: false })} sx={{ color: '#9be8ff', borderColor: 'rgba(155,232,255,0.4)' }}>＋ 新原型</Button>
      {list.map((k) => (
        <Box key={k.key} sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.05)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.name || k.key}</Typography>
            <Chip size="small" label={k.ownerId === '0' ? '平台' : k.mine ? (k.visibility === 'public' ? '我的 · 公开' : '我的') : '别人公开的'} sx={{ height: 18, fontSize: 10, color: '#fff', bgcolor: k.mine ? 'rgba(37,244,238,0.2)' : 'rgba(255,255,255,0.1)' }} />
          </Box>
          <Typography sx={{ ...mono, fontSize: 10.5, color: 'rgba(255,255,255,0.45)' }}>{k.key}{k.extends ? ` ← ${k.extends}` : ''} · {(k.rules ?? []).map((r) => r.on).join(' / ') || '没有规则'}</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
            <Button size="small" variant="contained" onClick={() => onPlace(k)} sx={{ minWidth: 0, px: 1.25, fontSize: 12 }}>放一个</Button>
            {k.mine && <Button size="small" onClick={() => setEditing({ key: k.key, def: defOf(k), pub: k.visibility === 'public' })} sx={{ minWidth: 0, fontSize: 12, color: '#9be8ff' }}>改</Button>}
            {k.mine && (
              <Button size="small" onClick={() => { if (window.confirm(`删掉原型「${k.name || k.key}」?已经放出去的会变成不动的摆设`)) deleteKind(k.key).then(load).catch((e) => toast('⚠️', errText(e))); }} sx={{ minWidth: 0, fontSize: 12, color: '#ffb0b0' }}>删</Button>
            )}
            {!k.mine && <Button size="small" onClick={() => setEditing({ def: { ...defOf(k), key: `${k.key.split('.').pop()}-copy`, extends: k.key, rules: [] }, pub: false })} sx={{ minWidth: 0, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>照着做一个</Button>}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export function EntityPanel({ item, onSave }: {
  item: WorldPlacement;
  onSave: (patch: { kind?: string; state?: Record<string, unknown>; rules?: WorldPlacement['rules']; tags?: string[] }) => Promise<void>;
}) {
  const [kind, setKind] = React.useState('');
  const [state, setState] = React.useState<Record<string, unknown>>({});
  const [rules, setRules] = React.useState<WorldRule[]>([]);
  const [tags, setTags] = React.useState('');
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    setKind(item.kind ?? '');
    setState(item.state ?? {});
    setRules((item.rules ?? []) as WorldRule[]);
    setTags((item.tags ?? []).join(', '));
    setErr('');
  }, [item.id, item.kind, item.state, item.rules, item.tags]);
  const props = item.props ?? {};
  const flags = [
    props.sittable && '能坐',
    props.usable && '能点',
    props.sense && '感应进出',
    props.solid === false ? '不挡人' : '挡人',
    props.visible === false && '藏着',
    props.emits && `发光 ${props.emits.intensity ?? 0}`,
  ].filter(Boolean) as string[];

  const save = async () => {
    const tg = tags.split(/[,，\s]+/).map((x) => x.trim()).filter(Boolean);
    const patch: Parameters<typeof onSave>[0] = { state, rules, tags: tg };
    if (kind.trim() !== (item.kind ?? '')) patch.kind = kind.trim();
    setBusy(true);
    setErr('');
    try { await onSave(patch); } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  const onDraft = (d: ComposeDraft) => {
    if (d.rules) setRules(d.rules);
    if (d.state) setState({ ...state, ...d.state });
    if (d.tags?.length) setTags(Array.from(new Set([...tags.split(/[,，\s]+/).filter(Boolean), ...d.tags])).join(', '));
  };

  return (
    <Box sx={{ mt: 0.75, pt: 0.75, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
      <ButtonBase onClick={() => setOpen((v) => !v)} sx={{ display: 'flex', width: '100%', justifyContent: 'space-between', fontSize: 12 }}>
        <span>🧩 {item.kind || (item.props ? '自定义实体' : '摆着看')}{item.props ? ` · ${flags.join(' · ')}` : ''}</span>
        <span style={{ color: '#9be8ff' }}>{open ? '收起' : '属性 / 规则'}</span>
      </ButtonBase>
      {open && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 0.75 }}>
          <AiCompose target="entity" current={{ kind: item.kind, state, rules, tags }} onDraft={onDraft} />
          {label('原型(空着 = 素材默认的,椅子是 seat、灯是 lamp;写 - = 只是摆着看)')}
          <TextField size="small" value={kind} placeholder="素材默认" onChange={(e) => setKind(e.target.value)} sx={field} />
          {label('状态(规则读写的变量)')}
          <JsonBox value={state} onChange={setState} />
          {label('这一个自己的规则(接在原型的规则后面)')}
          <RulesEditor rules={rules} onChange={setRules} scope="entity" />
          {label('标签(逗号分开,别的规则用 tag:名字 找到它)')}
          <TextField size="small" value={tags} onChange={(e) => setTags(e.target.value)} sx={field} />
          {err && <Typography sx={{ fontSize: 11.5, color: '#ff9b9b', whiteSpace: 'pre-wrap' }}>{err}</Typography>}
          <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{CHEAT}</Typography>
          <Button size="small" variant="contained" disabled={busy} onClick={() => void save()}>{busy ? <CircularProgress size={14} /> : '存'}</Button>
        </Box>
      )}
    </Box>
  );
}

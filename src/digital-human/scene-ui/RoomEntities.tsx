/**
 * scene-ui/RoomEntities.tsx — 世界模型(docs/WORLD-MODEL.md)的编辑入口
 *
 *   - KindsDrawer:布置抽屉里的「机关」一栏 —— 平台原型(灯、门、按钮、告示牌、传送区、星星……)和我自己的原型,
 *     点「放一个」就按原型放一个实体;「＋ 新原型」写一份原型 JSON(外观、属性、状态、规则),服务端先校验再存;
 *   - EntityPanel:选中一个实体时,看它的原型、算好的属性,改它的状态 / 规则 / 标签(JSON),存的时候服务端校验规则。
 * 这是三种写法里的「JSON」那一种;表单和「一句话交给 AI」写的是同一份数据。
 */

import React from 'react';
import { Box, Button, ButtonBase, Chip, CircularProgress, TextField, Typography } from '@mui/material';
import { deleteKind, listKinds, saveKind, type WorldKind, type WorldPlacement } from '@/apis/world';

const NEW_KIND = `{
  "key": "my-thing",
  "name": "我的机关",
  "look": { "shape": "box", "color": "#88ccff", "size": [0.3, 0.3, 0.3] },
  "state": { "count": 0 },
  "props": { "solid": true, "label": { "text": "被点了 {{state.count}} 次" } },
  "rules": [
    { "on": "use", "do": [ { "add": { "count": 1 } }, { "say": "第 {{state.count}} 次" } ] }
  ]
}`;

const CHEAT = '事件:use 被点 / enter leave touch 进出碰到 / say 有人说话 / changed 状态变了 / timer / 自定义(emit 发的)。'
  + '效果:set add toggle 改状态 · move rotate scale(dx/dy 相对)· spawn remove · teleport · say toast label · sound · emit · env · wait · if。'
  + '表达式:state.x、actor.isOwner、actor.state.x、space.state.x、text;文字里用 {{表达式}}。';

const mono = { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 11.5 } as const;
const field = { '& .MuiInputBase-root': { color: '#fff', ...mono }, '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } as const;

function errText(e: unknown) { return (e as Error)?.message || '没成功'; }

export function KindsDrawer({ onPlace, toast }: {
  onPlace: (kind: WorldKind) => void;
  toast: (icon: string, text: string) => void;
}) {
  const [list, setList] = React.useState<WorldKind[] | null>(null);
  const [editing, setEditing] = React.useState<{ key?: string; text: string } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const load = React.useCallback(() => { listKinds().then(setList).catch(() => setList([])); }, []);
  React.useEffect(load, [load]);

  const save = async () => {
    if (!editing) return;
    let def: Record<string, unknown>;
    try { def = JSON.parse(editing.text); } catch (e) { setErr(`JSON 写错了:${errText(e)}`); return; }
    setBusy(true);
    setErr('');
    try {
      const k = await saveKind(def, { key: editing.key });
      toast('🧩', `原型「${k.name || k.key}」存好了`);
      setEditing(null);
      load();
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{editing.key ? `改「${editing.key}」` : '新原型(key 会自动加上你的前缀)'}</Typography>
        <TextField multiline minRows={10} maxRows={22} value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} sx={field} />
        {err && <Typography sx={{ fontSize: 11.5, color: '#ff9b9b', whiteSpace: 'pre-wrap' }}>{err}</Typography>}
        <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{CHEAT}</Typography>
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          <Button size="small" variant="contained" disabled={busy} onClick={() => void save()} sx={{ flex: 1 }}>{busy ? <CircularProgress size={14} /> : '存'}</Button>
          <Button size="small" onClick={() => { setEditing(null); setErr(''); }} sx={{ color: '#9be8ff' }}>取消</Button>
        </Box>
      </Box>
    );
  }
  if (!list) return <Box sx={{ display: 'grid', placeItems: 'center', py: 2 }}><CircularProgress size={18} /></Box>;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <Button size="small" variant="outlined" onClick={() => setEditing({ text: NEW_KIND })} sx={{ color: '#9be8ff', borderColor: 'rgba(155,232,255,0.4)' }}>＋ 新原型</Button>
      {list.map((k) => (
        <Box key={k.key} sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.05)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.name || k.key}</Typography>
            <Chip size="small" label={k.ownerId === '0' ? '平台' : k.mine ? '我的' : '别人公开的'} sx={{ height: 18, fontSize: 10, color: '#fff', bgcolor: k.mine ? 'rgba(37,244,238,0.2)' : 'rgba(255,255,255,0.1)' }} />
          </Box>
          <Typography sx={{ ...mono, fontSize: 10.5, color: 'rgba(255,255,255,0.45)' }}>{k.key}{k.extends ? ` ← ${k.extends}` : ''} · {(k.rules ?? []).map((r) => r.on).join(' / ') || '没有规则'}</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
            <Button size="small" variant="contained" onClick={() => onPlace(k)} sx={{ minWidth: 0, px: 1.25, fontSize: 12 }}>放一个</Button>
            {k.mine && <Button size="small" onClick={() => { const { ownerId: _o, mine: _m, visibility: _v, ...def } = k; setEditing({ key: k.key, text: JSON.stringify(def, null, 2) }); }} sx={{ minWidth: 0, fontSize: 12, color: '#9be8ff' }}>改</Button>}
            {k.mine && (
              <Button size="small" onClick={() => { if (window.confirm(`删掉原型「${k.name || k.key}」?已经放出去的会变成不动的摆设`)) deleteKind(k.key).then(load).catch((e) => toast('⚠️', errText(e))); }} sx={{ minWidth: 0, fontSize: 12, color: '#ffb0b0' }}>删</Button>
            )}
            {!k.mine && <Button size="small" onClick={() => { const { ownerId: _o, mine: _m, visibility: _v, ...def } = k; setEditing({ text: JSON.stringify({ ...def, key: `${k.key.split('.').pop()}-copy`, extends: k.key, rules: [] }, null, 2) }); }} sx={{ minWidth: 0, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>照着做一个</Button>}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export function EntityPanel({ item, onSave }: {
  item: WorldPlacement;
  onSave: (patch: { state?: Record<string, unknown>; rules?: WorldPlacement['rules']; tags?: string[] }) => Promise<void>;
}) {
  const [state, setState] = React.useState('');
  const [rules, setRules] = React.useState('');
  const [tags, setTags] = React.useState('');
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    setState(JSON.stringify(item.state ?? {}, null, 2));
    setRules(JSON.stringify(item.rules ?? [], null, 2));
    setTags((item.tags ?? []).join(', '));
    setErr('');
  }, [item.id, item.state, item.rules, item.tags]);
  const props = item.props ?? {};
  const flags = [
    props.usable && '能点',
    props.sense && '感应进出',
    props.solid === false ? '不挡人' : '挡人',
    props.visible === false && '藏着',
    props.emits && `发光 ${props.emits.intensity ?? 0}`,
  ].filter(Boolean) as string[];

  const save = async () => {
    let st: Record<string, unknown>;
    let rl: WorldPlacement['rules'];
    try { st = JSON.parse(state || '{}'); } catch (e) { setErr(`状态的 JSON 写错了:${errText(e)}`); return; }
    try { rl = JSON.parse(rules || '[]'); } catch (e) { setErr(`规则的 JSON 写错了:${errText(e)}`); return; }
    const tg = tags.split(/[,，\s]+/).map((x) => x.trim()).filter(Boolean);
    setBusy(true);
    setErr('');
    try { await onSave({ state: st, rules: rl, tags: tg }); } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };

  return (
    <Box sx={{ mt: 0.75, pt: 0.75, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
      <ButtonBase onClick={() => setOpen((v) => !v)} sx={{ display: 'flex', width: '100%', justifyContent: 'space-between', fontSize: 12 }}>
        <span>🧩 {item.kind || '自定义实体'} · {flags.join(' · ')}</span>
        <span style={{ color: '#9be8ff' }}>{open ? '收起' : '属性 / 规则'}</span>
      </ButtonBase>
      {open && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 0.75 }}>
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>状态(规则读写的变量)</Typography>
          <TextField multiline minRows={2} maxRows={8} value={state} onChange={(e) => setState(e.target.value)} sx={field} />
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>这一个自己的规则(接在原型的规则后面)</Typography>
          <TextField multiline minRows={3} maxRows={14} value={rules} onChange={(e) => setRules(e.target.value)} sx={field} />
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>标签(逗号分开,别的规则用 tag:名字 找到它)</Typography>
          <TextField size="small" value={tags} onChange={(e) => setTags(e.target.value)} sx={field} />
          {err && <Typography sx={{ fontSize: 11.5, color: '#ff9b9b', whiteSpace: 'pre-wrap' }}>{err}</Typography>}
          <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{CHEAT}</Typography>
          <Button size="small" variant="contained" disabled={busy} onClick={() => void save()}>{busy ? <CircularProgress size={14} /> : '存'}</Button>
        </Box>
      )}
    </Box>
  );
}

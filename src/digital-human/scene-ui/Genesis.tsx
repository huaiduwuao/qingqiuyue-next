/**
 * scene-ui/Genesis.tsx — 创世在 /digital-human 里的那一层(不单开入口)
 *
 *   useGenesis:房间(useRoom)+ 形象(捏人参数、底模)+ 几块面板的开关 + 布置时选中的那件 + 泼溅加载状态
 *   GenesisHud:右上角工具列里的几个按钮(我的房间 / 布置 / 房间设置 / 捏人)+ 串门时顶上的门牌
 *   GenesisPanels:布置编辑器、房间设置、捏人面板
 *   RoomsSection:「去哪儿走走」里的「我的房间 + 串门」
 *
 * 形象只在世界里生效:在世界里走动的那个人就是你(和写实场景换成写实形象是同一个道理),
 * 收起世界回到舞台时还是后台配的数字人。
 */

import React from 'react';
import { Box, Button, ButtonBase, CircularProgress, Typography } from '@mui/material';
import { getMyAvatar, saveMyAvatar, roomOwnerOf, type AvatarParams, type WorldAvatar, type WorldPlacement, type WorldAssetFull } from '@/apis/world';
import { mediaUrl } from '@/lib/media';
import type { VrmStageHandle } from '../VrmStage';
import type { AvatarInfo } from '../vrm/avatarCustomize';
import { WORLD_ASSET_BASE } from '../vrm/world/realKit';
import type { WorldDef } from '../vrm/world/worldLayout';
import type { SplatStatus } from '../vrm/world/roomShell';
import type { WorldEvent } from '../vrm/world/useVrmWorld';
import { AvatarStudio, type AvatarBase } from './AvatarStudio';
import { RoomEditor } from './RoomEditor';
import { RoomSettings } from './RoomSettings';
import { useRoom } from './useRoom';
import { WorldUpload } from './WorldUpload';
import { useRealtimeEvent, type RealtimeEvent } from '@/lib/realtime';
import { DesignBar } from './RoomAI';
import type { DesignPlan } from './useWorldObjects';

/** 底模地址 → 能加载的 URL:站内 /avatars/… 原样;qq-media/world 下的补前缀 */
export function avatarUrlOf(base: string | undefined | null): string | null {
  if (!base) return null;
  if (base.startsWith('/')) return base;
  return mediaUrl(`${WORLD_ASSET_BASE}/${base}`);
}

type Draft = { base: string; baseName: string; params: AvatarParams };

export function useGenesis(opts: { enabled: boolean; initialRoom?: string | null }) {
  const room = useRoom(opts.enabled);
  const [editing, setEditing] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [studioOpen, setStudioOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [splat, setSplat] = React.useState<{ status: SplatStatus; splats?: number; error?: string } | null>(null);

  // ── 形象
  const [saved, setSaved] = React.useState<WorldAvatar | null>(null);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [info, setInfo] = React.useState<AvatarInfo | null>(null);
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    if (!opts.enabled) return;
    getMyAvatar().then((a) => {
      setSaved(a);
      setDraft((d) => d ?? { base: a.base, baseName: a.baseName, params: a.params ?? {} });
    }).catch(() => { /* 没登录 / 接口没上线:用默认形象 */ });
  }, [opts.enabled]);
  const dirty = !!draft && (!saved || draft.base !== saved.base || JSON.stringify(draft.params) !== JSON.stringify(saved.params ?? {}));
  const saveAvatar = React.useCallback(async () => {
    if (!draft) return false;
    setSaving(true);
    try {
      const a = await saveMyAvatar({ base: draft.base, baseName: draft.baseName, params: draft.params });
      setSaved(a);
      return true;
    } finally {
      setSaving(false);
    }
  }, [draft]);

  const onWorldEvent = React.useCallback((e: WorldEvent): boolean => {
    if (e.type === 'object') { setSelected(e.id); return true; }
    if (e.type === 'splat') { setSplat({ status: e.status, splats: e.splats, error: e.error }); return true; }
    return false;
  }, []);

  return {
    room, editing, setEditing, settingsOpen, setSettingsOpen, studioOpen, setStudioOpen, selected, setSelected, splat, setSplat,
    avatar: { saved, draft, setDraft, info, setInfo, dirty, save: saveAvatar, saving },
    /** 世界里用的形象地址(没捏过 = null,沿用原来的) */
    avatarUrl: draft?.base ? avatarUrlOf(draft.base) : null,
    avatarParams: draft?.params ?? null,
    onWorldEvent,
  };
}

export type Genesis = ReturnType<typeof useGenesis>;

const pill = { px: 1.25, py: 0.4, borderRadius: 999, bgcolor: 'rgba(8,10,20,0.62)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 12, fontWeight: 700 } as const;

/** 右上角工具列里的按钮 */
export function GenesisHud({ g, def, onGoHome, narrow }: { g: Genesis; def: WorldDef; onGoHome: () => void; narrow?: boolean }) {
  const inRoom = def.kind === 'room';
  const mine = inRoom && !!def.room?.mine;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, alignItems: 'stretch', width: narrow ? 104 : 156 }}>
      {!mine && <ButtonBase onClick={onGoHome} sx={pill}>🏠 我的房间</ButtonBase>}
      {mine && (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <ButtonBase onClick={() => { g.setSettingsOpen(false); g.setEditing((v) => !v); }} sx={{ ...pill, flex: 1, borderColor: g.editing ? '#25F4EE' : pill.border }}>🛠️ 布置</ButtonBase>
          <ButtonBase onClick={() => { g.setEditing(false); g.setSettingsOpen((v) => !v); }} sx={{ ...pill, px: 1 }} aria-label="房间设置">⚙️</ButtonBase>
        </Box>
      )}
      <ButtonBase onClick={() => g.setStudioOpen((v) => !v)} sx={{ ...pill, borderColor: g.studioOpen ? '#25F4EE' : pill.border }}>🧑‍🎨 捏人</ButtonBase>
    </Box>
  );
}

/** 串门时顶上的门牌 */
export function RoomPlate({ def, onGoHome, narrow }: { def: WorldDef; onGoHome: () => void; narrow?: boolean }) {
  if (def.kind !== 'room' || !def.room || def.room.mine) return null;
  return (
    <Box sx={{ position: 'absolute', zIndex: 3, left: narrow ? 12 : 16, top: narrow ? 'calc(112px + var(--sat, 0px))' : 'calc(64px + var(--sat, 0px))', maxWidth: 300, p: 1.25, borderRadius: 3, bgcolor: 'rgba(8,10,20,0.66)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}>
      <Typography sx={{ fontSize: 12, color: '#9be8ff' }}>正在串门</Typography>
      <Typography sx={{ fontSize: 15, fontWeight: 800 }}>🏠 {def.name}</Typography>
      {def.intro && <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', mt: 0.25, lineHeight: 1.6 }}>{def.intro}</Typography>}
      <Button size="small" onClick={onGoHome} sx={{ mt: 0.5, color: '#9be8ff', px: 0 }}>回我的房间</Button>
    </Box>
  );
}

type ObjectsApi = {
  items: WorldPlacement[];
  placeAsset: (a: WorldAssetFull, at?: { x: number; z: number; rotY?: number }) => Promise<WorldPlacement | null>;
  patchItem: (id: string, patch: { x?: number; y?: number; z?: number; rotY?: number; scale?: number; label?: string }) => Promise<boolean>;
  removeItem: (id: string) => Promise<WorldPlacement | null>;
  restoreItem: (p: WorldPlacement) => Promise<WorldPlacement | null>;
  /** 三期:布置助手的方案预览 */
  design?: DesignPlan | null;
  applyDesign?: () => Promise<void>;
  cancelDesign?: () => void;
  applying?: boolean;
};

export function GenesisPanels({ g, def, handle, objects, siteBases, toast, narrow, onVisitor }: {
  g: Genesis; def: WorldDef; handle: VrmStageHandle | null; objects: ObjectsApi; siteBases: AvatarBase[];
  toast: (icon: string, text: string) => void; narrow?: boolean;
  /** 有人来我房间串门(推送):不在自己房间时给个「回去看看」 */
  onVisitor?: (nickname: string) => void;
}) {
  const mine = def.kind === 'room' && !!def.room?.mine;
  // 有人进了我的房间(服务端推 world.visit,不管我在哪个页面)
  useRealtimeEvent(React.useCallback((ev: RealtimeEvent) => {
    if (ev.type !== 'world.visit') return;
    const v = (ev.data as { visitor?: { nickname?: string } } | undefined)?.visitor;
    const name = v?.nickname || '有人';
    if (mine) return; // 在自己房间里:房里的「XX 来了」已经提示过
    if (onVisitor) onVisitor(name); else toast('🏠', `${name}来你的房间串门了`);
  }, [mine, onVisitor, toast]));
  // 离开自己的房间:编辑器和设置收起
  React.useEffect(() => { if (!mine) { g.setEditing(false); g.setSettingsOpen(false); g.setSelected(null); } }, [mine]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (!g.editing) g.setSelected(null); }, [g.editing]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { g.setSplat(null); }, [def.key, def.room?.splatUrl]); // eslint-disable-line react-hooks/exhaustive-deps
  const [uploaded, setUploaded] = React.useState<AvatarBase[]>([]);
  const draft = g.avatar.draft ?? { base: '', baseName: '', params: {} };

  return (
    <>
      <DesignBar design={objects.design ?? null} applying={!!objects.applying} onApply={() => void objects.applyDesign?.()} onCancel={() => objects.cancelDesign?.()} narrow={narrow} />
      {mine && g.editing && (
        <RoomEditor handle={handle} def={def} objects={objects} selectedId={g.selected} onSelect={g.setSelected} onClose={() => g.setEditing(false)} toast={toast} narrow={narrow} />
      )}
      {mine && g.settingsOpen && g.room.mine && (
        <RoomSettings room={g.room.mine} handle={handle} save={g.room.save} splat={g.splat} onClose={() => g.setSettingsOpen(false)} toast={toast} narrow={narrow} />
      )}
      {g.studioOpen && (
        <AvatarStudio
          siteBases={siteBases}
          base={draft.base || siteBases[0]?.base || ''}
          params={draft.params}
          info={g.avatar.info}
          dirty={g.avatar.dirty}
          saving={g.avatar.saving}
          onBase={(b) => { g.avatar.setInfo(null); g.avatar.setDraft({ ...draft, base: b.base, baseName: b.name }); }}
          onParams={(p) => g.avatar.setDraft({ ...draft, params: p })}
          onSave={() => { void g.avatar.save().then((ok) => ok && toast('🧑‍🎨', '形象存好了')).catch((e) => toast('⚠️', e?.message || '没存上')); }}
          onReset={() => g.avatar.setDraft({ ...draft, params: {} })}
          onClose={() => g.setStudioOpen(false)}
          toast={toast}
          narrow={narrow}
          extraBases={uploaded}
          uploader={<WorldUpload kind="avatar" label="上传自己的 VRM 形象" compact toast={toast} onUploaded={(a) => {
            const b = { base: a.file, name: a.nameZh, hint: '上传的形象' };
            setUploaded((cur) => [b, ...cur]);
            g.avatar.setInfo(null);
            g.avatar.setDraft({ ...draft, base: b.base, baseName: b.name });
          }} />}
        />
      )}
    </>
  );
}

/** 「去哪儿走走」里的房间:我的 + 开放串门的 */
export function RoomsSection({ g, current, onPick }: { g: Genesis; current: string; onPick: (key: string) => void }) {
  const liveBadge = (n?: number) => (n && n > 0 ? <Box component="span" sx={{ ml: 0.75, fontSize: 10.5, color: '#7dffb0', border: '1px solid rgba(125,255,176,0.5)', borderRadius: 1, px: 0.5 }}>{n} 人在</Box> : null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  React.useEffect(() => { void g.room.loadPublic(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const visit = async (ownerId: string) => {
    setBusy(ownerId);
    setErr(null);
    try { onPick(await g.room.enter(ownerId)); } catch (e: any) { setErr(e?.message || '进不去'); } finally { setBusy(null); }
  };
  const mineKey = g.room.mine ? `room:${g.room.mine.ownerId}` : null;
  return (
    <Box sx={{ mt: 2 }}>
      <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#fff', mb: 1 }}>🏠 房间</Typography>
      {g.room.mine && (
        <ButtonBase onClick={() => mineKey && onPick(mineKey)} sx={{ display: 'block', width: '100%', textAlign: 'left', p: 1.25, mb: 1, borderRadius: 3, bgcolor: current === mineKey ? 'rgba(37,244,238,0.16)' : 'rgba(255,255,255,0.05)', border: `1px solid ${current === mineKey ? '#25F4EE' : 'transparent'}` }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{g.room.mine.name} <Box component="span" sx={{ fontSize: 11, color: '#9be8ff' }}>我的</Box>{liveBadge(g.room.mine.online)}</Typography>
          <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)' }}>{g.room.mine.items} 件摆设 · {g.room.mine.visibility === 'public' ? `开放串门,来过 ${g.room.mine.visits} 次` : '只有自己能进'}</Typography>
        </ButtonBase>
      )}
      {g.room.error && !g.room.mine && <Typography sx={{ fontSize: 12, color: '#ff9b9b', mb: 1 }}>{g.room.error}</Typography>}
      <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', mb: 0.75 }}>去别人家串门</Typography>
      {err && <Typography sx={{ fontSize: 12, color: '#ff9b9b', mb: 0.75 }}>{err}</Typography>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
        {g.room.publicRooms.map((r) => {
          const key = `room:${r.ownerId}`;
          return (
            <ButtonBase key={r.ownerId} disabled={!!busy} onClick={() => void visit(r.ownerId)} sx={{ display: 'block', textAlign: 'left', p: 1.25, borderRadius: 3, bgcolor: current === key ? 'rgba(37,244,238,0.16)' : 'rgba(255,255,255,0.05)', position: 'relative' }}>
              <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}{liveBadge(r.online)}</Typography>
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{r.owner?.nickname} · {r.items} 件 · 来过 {r.visits} 次</Typography>
              {r.intro && <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.65)', mt: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.intro}</Typography>}
              {busy === r.ownerId && <CircularProgress size={14} sx={{ position: 'absolute', top: 10, right: 10 }} />}
            </ButtonBase>
          );
        })}
      </Box>
      {g.room.publicRooms.length === 0 && <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>还没有人开放串门。把自己的房间布置好,在房间设置里打开「开放串门」吧。</Typography>}
    </Box>
  );
}

/** 当前场景是不是某人的房间(返回房主 uid) */
export const roomOwnerOfDef = (def: WorldDef) => (def.kind === 'room' ? roomOwnerOf(def.key) : null);

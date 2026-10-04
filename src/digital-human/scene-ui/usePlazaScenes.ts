/**
 * scene-ui/usePlazaScenes.ts — 从后台拉场景和人物,转成 3D 世界用的 WorldDef / WorldCharacter
 *
 * 接口拿不到(没登录、服务没上线)时只有默认的星光广场,没有人物。
 * 选中的场景记在 localStorage(dh_world_scene),下次进来还在那。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { themePoets } from '@/apis/insight';
import { listPlazaScenes, type PlazaCharacter, type PlazaLandmark, type PlazaScene } from '@/apis/plaza';
import { DEFAULT_WORLD, type WorldCharacter, type WorldDef, type WorldZone, type ZoneFeedKind, type ZoneProp } from '../vrm/world/worldLayout';

const SCENE_KEY = 'dh_world_scene';

export function parseColor(c: string | undefined | null): number | undefined {
  if (!c || !/^#[0-9a-fA-F]{6}$/.test(c)) return undefined;
  return parseInt(c.slice(1), 16);
}

export function toZone(l: PlazaLandmark): WorldZone {
  return {
    id: l.id,
    label: l.label,
    emoji: l.emoji || '✨',
    hint: l.hint || '',
    actionLabel: l.actionLabel || '聊聊',
    x: Number(l.x) || 0,
    z: Number(l.z) || 0,
    radius: Number(l.radius) || 2.4,
    solidRadius: Number(l.solidRadius) || 0,
    color: parseColor(l.color) ?? 0x25f4ee,
    prompt: l.prompt || undefined,
    prop: (l.prop || undefined) as ZoneProp | undefined,
    feed: (l.feed || undefined) as ZoneFeedKind | undefined,
    themeKey: l.themeKey || undefined,
  };
}

export function toWorldDef(s: PlazaScene): WorldDef {
  const zones = (s.landmarks ?? []).map(toZone);
  return {
    key: s.key,
    name: s.name,
    intro: s.intro,
    kind: s.kind === 'insight' ? 'insight' : 'plaza',
    group: s.group || undefined,
    stage: s.stage || 'concert',
    palette: { ground: parseColor(s.palette?.ground), path: parseColor(s.palette?.path), accent: parseColor(s.palette?.accent) },
    env: { time: s.palette?.time || undefined, weather: s.palette?.weather || undefined, grass: typeof s.palette?.grass === 'boolean' ? s.palette.grass : undefined, style: s.palette?.style === 'realistic' ? 'realistic' : undefined },
    zones: zones.length > 0 ? zones : DEFAULT_WORLD.zones,
  };
}

export function toCharacter(c: PlazaCharacter): WorldCharacter {
  return {
    id: String(c.id),
    sceneKey: c.sceneKey,
    name: c.name || c.poet || '',
    title: c.title || undefined,
    kind: c.kind === 'poet' ? 'poet' : 'guide',
    poet: c.poet || undefined,
    themeKey: c.themeKey || undefined,
    groupKey: c.groupKey || undefined,
    lines: c.lines ?? [],
    x: Number(c.x) || 0,
    z: Number(c.z) || 0,
    color: parseColor(c.color),
  };
}

/** extraDefs:后台场景之外的(创世的房间:我的房间 + 串门去过的),排在后台场景后面 */
export function usePlazaScenes(enabled: boolean, extraDefs: WorldDef[] = []) {
  const [plazaDefs, setDefs] = useState<WorldDef[]>([DEFAULT_WORLD]);
  const defs = useMemo(() => (extraDefs.length ? [...plazaDefs, ...extraDefs] : plazaDefs), [plazaDefs, extraDefs]);
  const [chars, setChars] = useState<WorldCharacter[]>([]);
  const [current, setCurrent] = useState<string>('plaza');
  // 诗人名字留空时由前端按主题补上(见 CharacterPanel),补到的名字写回来,名牌就能显示
  const [resolvedNames, setResolvedNames] = useState<Record<string, string>>({});

  useEffect(() => {
    try { const k = localStorage.getItem(SCENE_KEY); if (k) setCurrent(k); } catch { /* 隐私模式 */ }
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await listPlazaScenes();
      const d = r.scenes.map(toWorldDef);
      setDefs(d.length > 0 ? d : [DEFAULT_WORLD]);
      setChars(r.characters.map(toCharacter));
    } catch {
      setDefs([DEFAULT_WORLD]);
      setChars([]);
    }
  }, []);
  useEffect(() => { if (enabled) void load(); }, [enabled, load]);

  const def = defs.find((d) => d.key === current) ?? defs[0] ?? DEFAULT_WORLD;
  const characters = useMemo(
    () => chars.filter((c) => c.sceneKey === def.key).map((c) => (!c.name && resolvedNames[c.id] ? { ...c, name: resolvedNames[c.id] } : c)),
    [chars, def.key, resolvedNames],
  );

  const switchTo = useCallback((key: string) => {
    setCurrent(key);
    try { localStorage.setItem(SCENE_KEY, key); } catch { /* ignore */ }
  }, []);

  const resolveName = useCallback((id: string, name: string) => {
    setResolvedNames((m) => (m[id] === name ? m : { ...m, [id]: name }));
  }, []);

  // 进场景时把「诗人留空」的人物补上名字:这个主题下写得最多的名家(有据可查,不是随便挑的)
  useEffect(() => {
    let alive = true;
    const pending = chars.filter((c) => c.sceneKey === def.key && c.kind === 'poet' && !c.poet && !c.name && c.themeKey && !resolvedNames[c.id]);
    // 同一场景里尽量别让两个人物成了同一位诗人:按顺序取还没被占用的那位
    const taken = new Set(chars.filter((c) => c.sceneKey === def.key).map((c) => c.poet || c.name).filter(Boolean));
    (async () => {
      for (const c of pending) {
        try {
          const r = await themePoets(c.themeKey!);
          const pick = (r?.list ?? []).map((x) => x.author).find((a) => a && !taken.has(a));
          if (!alive || !pick) continue;
          taken.add(pick);
          resolveName(c.id, pick);
        } catch { /* 取不到就保持「…」 */ }
      }
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chars, def.key]);

  return { defs, def, characters, switchTo, reload: load, resolveName };
}

export type PlazaScenes = ReturnType<typeof usePlazaScenes>;

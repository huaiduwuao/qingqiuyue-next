/**
 * scene-ui/useAmbientSounds.ts — 房间里带 sound 属性的东西,人走近了循环播(声音库,soundLib.ts AmbientMixer)
 *
 * 每 100 毫秒:听的人放在人物的头(脚上 1.5 米),朝向跟镜头(转镜头时左右跟着变);
 * 每 250 毫秒看一次哪些东西在出声(规则把 sound 属性改了 / 藏起来,下一轮就跟着变)。离开场景全部停掉。
 */

import React from 'react';
import type { WorldPlacement } from '@/apis/world';
import type { VrmStageHandle } from '../VrmStage';
import { AmbientMixer, setListener, soundPropOf, type AmbientSource } from './soundLib';

/** 人物的头在哪、镜头水平朝向(给声场) */
export function listenerOf(handle: VrmStageHandle): { at: { x: number; y: number; z: number }; forward: { x: number; z: number } } {
  const me = handle.getPosition();
  const cam = handle.getThree()?.camera;
  let forward = { x: 0, z: -1 };
  if (cam) {
    const e = cam.matrixWorld.elements; // 镜头看的是 −z
    forward = { x: -e[8], z: -e[10] };
  }
  return { at: { x: me.x, y: 1.5, z: me.z }, forward };
}

export function useAmbientSounds({ handle, items, enabled }: { handle: VrmStageHandle | null; items: WorldPlacement[]; enabled: boolean }) {
  const itemsRef = React.useRef(items);
  itemsRef.current = items;
  React.useEffect(() => {
    if (!handle || !enabled) return;
    const mixer = new AmbientMixer();
    let n = 0;
    const t = window.setInterval(() => {
      const l = listenerOf(handle);
      setListener(l.at, l.forward);
      if (n++ % 3) return;
      const sources: AmbientSource[] = [];
      for (const p of itemsRef.current) {
        if (p.props?.visible === false) continue;
        const s = soundPropOf(p.props?.sound);
        if (s) sources.push({ id: p.id, key: s.key, x: p.x, y: p.y, z: p.z, volume: s.volume, radius: s.radius });
      }
      void mixer.update(sources, { x: l.at.x, y: 0, z: l.at.z });
    }, 100);
    return () => { window.clearInterval(t); mixer.dispose(); };
  }, [handle, enabled]);
}

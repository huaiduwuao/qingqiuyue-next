/**
 * scene-ui/useAmbientSounds.ts — 房间里带 sound 属性的东西,人走近了循环播(声音库,soundLib.ts AmbientMixer)
 *
 * 每 250 毫秒看一次人在哪、哪些东西在出声(规则把 sound 属性改了 / 藏起来,下一轮就跟着变);离开场景全部停掉。
 */

import React from 'react';
import type { WorldPlacement } from '@/apis/world';
import type { VrmStageHandle } from '../VrmStage';
import { AmbientMixer, soundPropOf, type AmbientSource } from './soundLib';

export function useAmbientSounds({ handle, items, enabled }: { handle: VrmStageHandle | null; items: WorldPlacement[]; enabled: boolean }) {
  const itemsRef = React.useRef(items);
  itemsRef.current = items;
  React.useEffect(() => {
    if (!handle || !enabled) return;
    const mixer = new AmbientMixer();
    const t = window.setInterval(() => {
      const sources: AmbientSource[] = [];
      for (const p of itemsRef.current) {
        if (p.props?.visible === false) continue;
        const s = soundPropOf(p.props?.sound);
        if (s) sources.push({ id: p.id, key: s.key, x: p.x, y: p.y, z: p.z, volume: s.volume, radius: s.radius });
      }
      const me = handle.getPosition();
      void mixer.update(sources, { x: me.x, y: 0, z: me.z });
    }, 250);
    return () => { window.clearInterval(t); mixer.dispose(); };
  }, [handle, enabled]);
}

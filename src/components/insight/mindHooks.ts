'use client';

// 心境的共享 hook。单独一个文件:ThemeWorks 和 Mind 都要用,放进任一边都会互相 import。

import { useQuery } from '@tanstack/react-query';
import { me as fetchMe, MIND_ME_KEY, LAYER_FALLBACK, type MindMe } from '@/apis/mind';

export function useMindMe() {
  return useQuery({ queryKey: MIND_ME_KEY, queryFn: fetchMe, staleTime: 60_000 });
}

export function layerMeta(m: MindMe | undefined, layer: number) {
  return (m?.layers ?? LAYER_FALLBACK).find((l) => l.layer === layer) ?? LAYER_FALLBACK[layer - 1];
}

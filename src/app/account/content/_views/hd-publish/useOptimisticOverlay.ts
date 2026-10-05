'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { formatApiError } from '@/lib/api/client';
import type { HdVideo } from './data';
import { applyHdOps, liveHdOps, type HdPendingOp, type HdSyncMark } from './hdPublishModel';

/** 服务端数据的一路来源:查询 key + 它的 useQuery 结果(只读两个时间戳当刷新触发器)。 */
export interface OverlaySource {
  key: QueryKey;
  query: { dataUpdatedAt: number; errorUpdatedAt: number };
}

export type NewHdOp =
  | { kind: 'remove'; videoId: string }
  | { kind: 'update'; videoId: string; apply: (v: HdVideo) => HdVideo };

/**
 * 「服务端数据为准 + 未落定的乐观改动叠在上面」的通用部分,高清发布(useHdVideos)和
 * 审核员工作台(useHdReviewVideos)共用。见 HdPendingOp:
 * - runOptimistic:先叠改动再发请求;失败撤掉(= 回滚到服务端真实状态),成功记下各路查询
 *   当时落定过几次并重拉,各路都再落定一次后撤掉,此后以服务端为准;
 * - addConfirmed:服务端已经建好、列表还没拉到的条目,先显示;
 * - overlay(serverVideos):把仍有效的改动叠到服务端列表上。
 */
export function useOptimisticOverlay(sources: OverlaySource[], setSnack: (msg: string) => void) {
  const queryClient = useQueryClient();
  const keysJson = JSON.stringify(sources.map((s) => s.key));
  const stamp = sources.map((s) => `${s.query.dataUpdatedAt}:${s.query.errorUpdatedAt}`).join('|');

  // 各路查询落定(拿到数据或失败)过几次。用次数不用时间戳:请求和重拉落在同一毫秒时分不出先后。
  const markNow = useCallback((): HdSyncMark => {
    const mark: HdSyncMark = {};
    (JSON.parse(keysJson) as QueryKey[]).forEach((key, i) => {
      const st = queryClient.getQueryState(key);
      mark[String(i)] = st ? st.dataUpdateCount + st.errorUpdateCount : 0;
    });
    return mark;
  }, [queryClient, keysJson]);
  // stamp 只当触发器:任一路落定一次(哪怕数据和上次一样、data 引用没变)它就变,重新数一遍。
  // 调用方传进来的 query 读了这两个时间戳,useQuery 也就订阅了它们,重拉到相同数据时照样重渲染。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const synced = useMemo(() => markNow(), [markNow, stamp]);

  const refetchServer = useCallback(() => {
    for (const key of JSON.parse(keysJson) as QueryKey[]) void queryClient.invalidateQueries({ queryKey: key });
  }, [queryClient, keysJson]);

  const [ops, setOps] = useState<HdPendingOp[]>([]);
  const opSeqRef = useRef(0);
  // 已被服务端覆盖的改动不再叠加(落定次数只增不减,排除后不会再回来);state 里的旧条目在下次加改动时顺手清掉
  const liveOps = useMemo(() => liveHdOps(ops, synced), [ops, synced]);
  const overlay = useCallback((server: HdVideo[]) => applyHdOps(server, liveOps), [liveOps]);

  /** 先叠上乐观改动再发请求:成功则等服务端刷新后撤掉改动,失败立即撤掉(回滚)。返回是否成功。 */
  const runOptimistic = useCallback(
    async <T,>(op: NewHdOp, request: () => Promise<T>, okMsg: string | ((res: T) => string), failMsg: string) => {
      const opId = ++opSeqRef.current;
      setOps((p) => [...liveHdOps(p, markNow()), { ...op, opId } as HdPendingOp]);
      let res: T;
      try {
        res = await request();
      } catch (e) {
        setOps((p) => p.filter((o) => o.opId !== opId));
        setSnack(`${failMsg}:${formatApiError(e)}`);
        return false;
      }
      const confirmedAt = markNow();
      setOps((p) => p.map((o) => (o.opId === opId ? { ...o, confirmedAt } : o)));
      refetchServer();
      setSnack(typeof okMsg === 'function' ? okMsg(res) : okMsg);
      return true;
    },
    [markNow, refetchServer, setSnack],
  );

  /** 服务端已建好、列表还没拉到的条目先放进列表,等服务端列表拉到它为止 */
  const addConfirmed = useCallback(
    (video: HdVideo) => {
      const opId = ++opSeqRef.current;
      const confirmedAt = markNow();
      setOps((p) => [...liveHdOps(p, confirmedAt), { opId, kind: 'add', videoId: video.id, video, confirmedAt }]);
      refetchServer();
    },
    [markNow, refetchServer],
  );

  return { overlay, runOptimistic, addConfirmed, refetchServer };
}

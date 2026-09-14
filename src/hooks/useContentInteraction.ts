'use client';

import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getInteraction, setCollect, setDislike, setLike, type Interaction } from '@/apis/interaction';
import { formatApiError } from '@/lib/api/client';
import { toEntityId } from '@/lib/id';

type Severity = 'success' | 'error' | 'info';
type Notify = (message: string, severity?: Severity) => void;
type Kind = 'like' | 'dislike' | 'collect';

/** 同一条内容的所有按钮(点赞、收藏按钮、推荐流)共用这一份缓存,状态不会各说各话。 */
export const interactionQueryKey = (contentId: unknown) => ['interaction', String(toEntityId(contentId) ?? '')];

interface Options {
  /** 成功 / 失败提示;不传则静默。 */
  notify?: Notify;
  /** 页面已知的点赞 / 收藏基数(详情接口给的);不传则以第一次读到的服务端值为基线。 */
  baseLikes?: number;
  baseCollects?: number;
}

/**
 * 内容互动(赞 / 踩 / 收藏)的统一实现。
 *
 * - 进入页面先从 /interaction 拉当前用户的真实状态:刷新后心形 / 收藏仍然是对的。
 * - 点击时先乐观更新,请求结束(成功或失败)都重新拉一次服务端状态,以库里的为准:
 *   失败时自然回滚,计数也是库里的真值,不是前端加减出来的。
 * - 每次操作都给提示:成功「已点赞 / 已收藏…」,失败显示后端给的原因(如「请先登录」)。
 */
export function useContentInteraction(contentId: unknown, opts: Options = {}) {
  const { notify, baseLikes, baseCollects } = opts;
  const id = toEntityId(contentId);
  const queryClient = useQueryClient();
  const queryKey = interactionQueryKey(contentId);

  const query = useQuery({
    queryKey,
    queryFn: () => getInteraction(id!),
    enabled: id !== null,
    staleTime: 10_000,
  });

  const [pending, setPending] = useState<Kind | null>(null);
  const [optimistic, setOptimistic] = useState<Partial<Interaction> | null>(null);

  const server = query.data;
  const liked = optimistic?.liked ?? server?.liked ?? false;
  const disliked = optimistic?.disliked ?? server?.disliked ?? false;
  const collected = optimistic?.collected ?? server?.collected ?? false;
  const likeCount = optimistic?.agreeNum ?? server?.agreeNum ?? baseLikes ?? 0;
  const collectCount = optimistic?.collectNum ?? server?.collectNum ?? baseCollects ?? 0;

  // 详情接口的计数和 /interaction 读的是同一列。记下这条内容第一次读到的服务端值当基线,
  // likeDelta = 当前 - 基线:页面沿用「详情基数 + 增量」显示,结果始终等于库里的真值。
  const baseline = useRef<{ key: string; agree: number; collect: number } | null>(null);
  const keyStr = queryKey[1];
  if (server && (baseline.current === null || baseline.current.key !== keyStr)) {
    baseline.current = { key: keyStr, agree: server.agreeNum, collect: server.collectNum };
  }
  const likeBase = baseLikes ?? (baseline.current?.key === keyStr ? baseline.current.agree : likeCount);
  const collectBase = baseCollects ?? (baseline.current?.key === keyStr ? baseline.current.collect : collectCount);

  const run = async (kind: Kind, next: Partial<Interaction>, call: () => Promise<unknown>, okMsg: string) => {
    if (id === null) {
      notify?.('内容 ID 缺失', 'error');
      return;
    }
    if (server && !server.loggedIn) {
      notify?.('请先登录后再操作', 'error');
      return;
    }
    if (pending) return;
    setPending(kind);
    setOptimistic(next);
    try {
      await call();
      notify?.(okMsg, 'success');
    } catch (err) {
      notify?.(formatApiError(err), 'error');
    } finally {
      // 以服务端为准:成功时拿到最新计数,失败时回到操作前的真实状态。
      await queryClient.invalidateQueries({ queryKey });
      setOptimistic(null);
      setPending(null);
    }
  };

  const toggleLike = () => {
    const on = !liked;
    return run(
      'like',
      { liked: on, disliked: on ? false : disliked, agreeNum: Math.max(0, likeCount + (on ? 1 : -1)) },
      () => setLike(id!, on),
      on ? '已点赞' : '已取消点赞',
    );
  };

  const toggleDislike = () => {
    const on = !disliked;
    return run(
      'dislike',
      // 赞与踩互斥,服务端也会撤掉另一个;这里同步把赞和计数一起回退
      { disliked: on, liked: on ? false : liked, agreeNum: on && liked ? Math.max(0, likeCount - 1) : likeCount },
      () => setDislike(id!, on),
      on ? '已点踩,将减少此类推荐' : '已取消点踩',
    );
  };

  const toggleCollect = () => {
    const on = !collected;
    return run(
      'collect',
      { collected: on, collectNum: Math.max(0, collectCount + (on ? 1 : -1)) },
      () => setCollect(id!, on),
      on ? '已收藏,可在「我的收藏」查看' : '已取消收藏',
    );
  };

  return {
    ready: query.isSuccess,
    loggedIn: server?.loggedIn ?? false,
    liked,
    disliked,
    collected,
    likeCount,
    collectCount,
    /** 相对页面基数的增量:页面继续用「(data.likeCount || 0) + likeDelta」显示即可 */
    likeDelta: likeCount - likeBase,
    collectDelta: collectCount - collectBase,
    pending,
    likeBusy: pending === 'like' || pending === 'dislike',
    collectBusy: pending === 'collect',
    toggleLike,
    toggleDislike,
    toggleCollect,
  };
}

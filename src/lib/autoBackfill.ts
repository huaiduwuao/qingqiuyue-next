/**
 * 详情页自动补全(后端 internal/autobackfill)的状态。
 *
 * 详情接口判定"站内不能读 / 不能播"的那一刻就把内容投进补全队列,availability.backfill
 * 带回排队 / 运行 / 上次结果。前端要做的只有两件事:补全没结束就轮询详情(和章节列表),
 * 把"正在补"和"试过了没找到"如实说出来 —— 别再让用户对着"本站未收录"干等。
 */

export interface BackfillState {
  /** queued 排队 / running 运行中 / done 跑完(可能续排中)/ failed 没补到 / skipped 没投递 */
  status?: 'queued' | 'running' | 'done' | 'failed' | 'skipped' | string;
  /** 触发原因:availability 的 status;播放轴当场重解析时是 playcheck */
  reason?: string;
  round?: number;
  at?: string;
  taskId?: number | string;
  inserted?: number;
  updated?: number;
  failed?: number;
  error?: string;
}

export interface WithBackfill {
  availability?: { backfill?: BackfillState } | null;
  /** 音乐详情:实时解析也没有音源时投的补全(后端 attachAudioUrl) */
  audioBackfill?: BackfillState | null;
}

/** 补全还没结束(排队或运行中)。 */
export function backfillPending(detail: WithBackfill | null | undefined): boolean {
  const s = detail?.availability?.backfill?.status ?? detail?.audioBackfill?.status;
  return s === 'queued' || s === 'running';
}

/**
 * 影视详情在播放器位置该说什么:补全中说"正在找片源",试过没找到说"没找到",否则沿用原说明。
 * 返回空串表示不用换掉播放器。
 */
export function videoBackfillNotice(
  detail: (WithBackfill & { playNotice?: unknown }) | null | undefined,
  fallback: string,
): string {
  const s = detail?.availability?.backfill?.status;
  if (s === 'queued' || s === 'running') return '正在为这部作品寻找站内可播的片源,稍候片刻…';
  // 没找到:只在本来就要换成说明面板时补一句;fallback 为空表示播放器自己还能试(抖音 / 微博等走服务端解析),别拦。
  if (s === 'failed' && fallback) return `已在各平台找过站内可播的片源,暂时没有;${fallback}`;
  return fallback;
}

/** 补全间隔与上限:每 5 秒查一次,最多 4 分钟 —— 首轮几十章正文通常一两分钟内到。 */
export const BACKFILL_DETAIL_POLL_MS = 5000;
export const BACKFILL_DETAIL_MAX_POLLS = 48;

/**
 * 给 react-query 的 refetchInterval:补全未结束且没超上限时轮询。
 * dataUpdateCount 由 react-query 维护,首次加载算 1。
 */
export function backfillRefetchInterval<T>(query: { state: { data?: T; dataUpdateCount: number } }): number | false {
  const pending = backfillPending(query.state.data as WithBackfill | null | undefined);
  return pending && query.state.dataUpdateCount <= BACKFILL_DETAIL_MAX_POLLS ? BACKFILL_DETAIL_POLL_MS : false;
}

/**
 * 正文类内容"站内不能读"时的提示。补全中说"正在补",试过没找到说"没找到",
 * 其余沿用后端的 notice。unit 是"正文"/"图片"这类量词。
 */
export function backfillNotice(
  availability: { notice?: string; backfill?: BackfillState } | null | undefined,
  fallback: string,
  unit = '正文',
): string {
  const b = availability?.backfill;
  switch (b?.status) {
    case 'queued':
      return `已排队从源站补全${unit},稍候片刻…`;
    case 'running':
      return `正在从源站补全${unit},第一批很快就到…`;
    case 'failed':
      return `已尝试从各源站补全${unit},暂时没有找到;${availability?.notice || fallback}`;
    default:
      return availability?.notice || fallback;
  }
}

/**
 * 内容 / 分集 / 评论 / 收藏夹 / 爬虫源等 id 由后端 pkg/idgen 发号,是纳秒量级的
 * BIGINT(≈1.79e18),远超 JS 的 Number.MAX_SAFE_INTEGER(2^53-1 ≈ 9.0e15)。
 *
 * 后端出参把超范围的 id 转成十进制字符串(pkg/jsonfix 中间件),入参用
 * jsonfix.Int64 同时接受数字和字符串。所以前端必须原样透传,绝不能 Number():
 *   Number('1789304372516386790') === 1789304372516386800 —— 拿去查就是另一条或不存在的内容。
 */
export type EntityId = string | number;

/**
 * 规范化成可安全回传给后端的 id。
 * - 安全范围内的整数:返回 number(兼容还只收数字的旧接口)
 * - 超范围的:返回原样的十进制字符串
 * - 空 / 0 / 负数 / 非整数 / 已经丢了精度的 number:返回 null
 */
export function toEntityId(id: unknown): EntityId | null {
  if (id === null || id === undefined) return null;
  if (typeof id === 'number') {
    // 超出安全范围的 number 在到这里之前就已经被截断了,再发出去只会命中错误的行。
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }
  if (typeof id !== 'string' && typeof id !== 'bigint') return null;
  const s = String(id).trim();
  if (!/^[1-9]\d*$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : s;
}

/** 按十进制字面量比较两个 id(一边 string 一边 number 也能比)。 */
export function sameId(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  return String(a) === String(b);
}

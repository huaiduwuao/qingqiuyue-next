/**
 * 取异常对象上的 message,给 `catch (e)` / `.catch((e: unknown) => …)` 用,免得写 `e: any`。
 *
 * 与旧写法 `e?.message` 等价:有字符串 message 就返回它,否则返回 undefined
 * (所以 `errMessage(e) || '失败'`、`errMessage(e) ?? String(e)` 的回退行为都不变)。
 */
export function errMessage(e: unknown): string | undefined {
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return undefined;
}

/** 异常的 name(`e?.name === 'AbortError'` 之类的判断用) */
export function errName(e: unknown): string | undefined {
  if (e && typeof e === 'object' && 'name' in e) {
    const n = (e as { name?: unknown }).name;
    if (typeof n === 'string') return n;
  }
  return undefined;
}

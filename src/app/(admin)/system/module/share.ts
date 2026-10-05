/** 合集买断最高价(钻),与后端 moduleshare.MaxPrice 一致 */
export const MODULE_MAX_PRICE = 10000;

/**
 * 从 share_content 读出买断价(钻),规则同后端 moduleshare.ParsePrice:
 * 新格式 {"price":N};兼容 {"diamonds":N}、旧扫码标价 {"pay":元}(×10 折钻)、纯数字。
 * 解析不了或超出范围返回 0。
 */
export function modulePrice(shareContent: unknown): number {
  const s = typeof shareContent === 'string' ? shareContent.trim() : '';
  if (!s) return 0;
  let price = 0;
  if (s.startsWith('{')) {
    try {
      const o = JSON.parse(s) as Record<string, unknown>;
      const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN);
      if (num(o.price) > 0) price = num(o.price);
      else if (num(o.diamonds) > 0) price = num(o.diamonds);
      else if (num(o.pay) > 0) price = num(o.pay) * 10;
    } catch {
      return 0;
    }
  } else {
    price = Number(s);
  }
  if (!Number.isFinite(price) || price <= 0) return 0;
  const n = Math.ceil(price - 1e-9);
  return n > 0 && n <= MODULE_MAX_PRICE ? n : 0;
}

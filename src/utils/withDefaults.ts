// Merge a partial response into a full defaults object. Used by detail pages
// to keep their type-safe shape (e.g. Animation with genre/actors/rating) when
// the underlying contentDetail() API only returns a generic ContentItem. The
// placeholderData shows the full shape before fetch resolves; once the query
// resolves, select() runs this merge so a sparse API response never crashes
// the renderer (e.g. .map on undefined genre).

export function withDefaults<T extends object>(
  defaults: T,
  partial: Partial<T> | null | undefined,
): T {
  if (!partial) return defaults;
  const out: T = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const value = partial[key];
    if (value !== undefined && value !== null) {
      out[key] = value;
    }
  }
  for (const key of Object.keys(partial) as (keyof T)[]) {
    if (!(key in defaults)) {
      out[key] = partial[key] as T[typeof key];
    }
  }
  return out;
}

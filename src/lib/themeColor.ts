import { alpha, type Theme } from '@mui/material/styles';

/**
 * 把 'primary.main' / 'text.disabled' / 'divider' 这类 MUI 主题色名解析成真实颜色。
 *
 * sx 里能直接写主题色名,但 SVG 的 fill/stroke 属性、以及 `${color}1F` 这种拼透明度的写法
 * 拿到的是原样字符串 —— 浏览器不认,线条/底色就画不出来(数据中心的趋势图、粉丝画像、收益分布
 * 以前就是这样)。已经是 #hex / rgb() / 颜色关键字的原样返回。
 */
export function resolveColor(theme: Theme, color: string | undefined, fallback = 'currentColor'): string {
  if (!color) return fallback;
  if (/^(#|rgb|hsl|var\()/i.test(color) || !/^[a-zA-Z]+(\.[a-zA-Z0-9]+)*$/.test(color)) return color;
  const path = color.split('.');
  let v: unknown = theme.palette;
  for (const k of path) {
    v = v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined;
  }
  if (typeof v === 'string') return v;
  // 'primary' 这种只写到色板一级的
  if (v && typeof v === 'object' && typeof (v as { main?: unknown }).main === 'string') return (v as { main: string }).main;
  return color; // 真正的 CSS 颜色关键字(red、transparent…)
}

/** resolveColor + 透明度,替代 `${color}1F` 这种只对 #rrggbb 有效的拼法 */
export function resolveAlpha(theme: Theme, color: string | undefined, opacity: number): string {
  const c = resolveColor(theme, color, '');
  if (!c || c === 'currentColor' || c === 'transparent') return 'transparent';
  try {
    return alpha(c, opacity);
  } catch {
    return c;
  }
}

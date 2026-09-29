/**
 * vrm/world/env/timeOfDay.ts — 昼夜:给一个时刻(0–24 时),算出太阳方向和整套天光配色
 *
 * 纯函数、不依赖 three(颜色用 [r,g,b] 线性值),天空、雾、水面、灯光都从这里取同一组颜色,
 * 所以地平线、雾、水里的倒影是一个色调。几个关键时刻手调了配色,中间按时间插值。
 */

export type TimeMode = 'auto' | 'dawn' | 'day' | 'dusk' | 'night';
export type Weather = 'none' | 'petals' | 'leaves' | 'rain' | 'snow' | 'fireflies';

export const TIME_MODES: TimeMode[] = ['auto', 'dawn', 'day', 'dusk', 'night'];
export const TIME_LABELS: Record<TimeMode, string> = { auto: '跟随现在', dawn: '清晨', day: '白天', dusk: '黄昏', night: '夜晚' };
export const WEATHER_LABELS: Record<Weather, string> = { none: '无', petals: '落花', leaves: '落叶', rain: '细雨', snow: '小雪', fireflies: '萤火' };

/** 各模式对应的钟点;auto 用本地时间 */
export const MODE_HOUR: Record<Exclude<TimeMode, 'auto'>, number> = { dawn: 6.4, day: 13, dusk: 18.1, night: 22.5 };

export function modeHour(mode: TimeMode, now = new Date()): number {
  if (mode === 'auto') return now.getHours() + now.getMinutes() / 60;
  return MODE_HOUR[mode];
}

export type RGB = [number, number, number];

export interface SkyState {
  /** 太阳方向(单位向量,y 向上) */
  sunDir: [number, number, number];
  /** 太阳高度角(弧度,负 = 地平线下) */
  sunElevation: number;
  /** 夜的程度 0–1 */
  night: number;
  zenith: RGB;
  horizon: RGB;
  ground: RGB;
  sunColor: RGB;
  /** 太阳 / 月亮平行光的颜色与强度 */
  lightColor: RGB;
  lightIntensity: number;
  hemiSky: RGB;
  hemiGround: RGB;
  hemiIntensity: number;
  fog: RGB;
  fogDensity: number;
  /** 后期冷暖 -1…1 */
  warmth: number;
  /** 灯笼、路灯的亮度倍数(夜里亮) */
  lampBoost: number;
}

const hex = (h: number): RGB => {
  // sRGB 十六进制 → 线性
  const c = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return [c((h >> 16) & 255), c((h >> 8) & 255), c(h & 255)];
};

interface Key { h: number; zenith: number; horizon: number; ground: number; sun: number; light: number; li: number; hemiSky: number; hemiGround: number; hi: number; fog: number; fd: number; warmth: number; lamp: number }

// 一天里的几个关键时刻(环回:0 点 = 24 点)
const KEYS: Key[] = [
  { h: 0, zenith: 0x040a1e, horizon: 0x1c2c56, ground: 0x060912, sun: 0x9fb6ff, light: 0xa8bcf0, li: 0.65, hemiSky: 0x5068a8, hemiGround: 0x10131e, hi: 0.55, fog: 0x18264a, fd: 0.0085, warmth: -0.4, lamp: 1.6 },
  { h: 5.2, zenith: 0x0a1432, horizon: 0x44446c, ground: 0x0c0c18, sun: 0xffb08a, light: 0xa4acdc, li: 0.55, hemiSky: 0x5a60a0, hemiGround: 0x141420, hi: 0.5, fog: 0x2a2c48, fd: 0.012, warmth: -0.2, lamp: 1.3 },
  { h: 6.4, zenith: 0x2a4a8a, horizon: 0xf2a37a, ground: 0x2a2030, sun: 0xffa36a, light: 0xffb98a, li: 1.4, hemiSky: 0x9ab0e0, hemiGround: 0x3a2a2a, hi: 0.55, fog: 0xd8a68c, fd: 0.010, warmth: 0.45, lamp: 0.7 },
  { h: 9, zenith: 0x3d74c9, horizon: 0xb8d4ee, ground: 0x3a4030, sun: 0xfff2d8, light: 0xfff0dc, li: 2.2, hemiSky: 0xbcd6ff, hemiGround: 0x4a4a38, hi: 0.7, fog: 0xbcd0e4, fd: 0.006, warmth: 0.05, lamp: 0.25 },
  { h: 13, zenith: 0x2f6cc8, horizon: 0xc4dcf2, ground: 0x404a34, sun: 0xffffff, light: 0xfff8ee, li: 2.6, hemiSky: 0xc4dcff, hemiGround: 0x505038, hi: 0.75, fog: 0xc8dae8, fd: 0.005, warmth: 0, lamp: 0.2 },
  { h: 16.5, zenith: 0x3a66b4, horizon: 0xe6cfa6, ground: 0x3a3a2c, sun: 0xffe2b0, light: 0xffe6c0, li: 2.0, hemiSky: 0xc0ccef, hemiGround: 0x4a4030, hi: 0.65, fog: 0xdccbb0, fd: 0.007, warmth: 0.25, lamp: 0.35 },
  { h: 18.1, zenith: 0x2a3070, horizon: 0xff8a5a, ground: 0x2a1a24, sun: 0xff7a3c, light: 0xff9a60, li: 1.3, hemiSky: 0x8a80c0, hemiGround: 0x3a2020, hi: 0.5, fog: 0xc07a70, fd: 0.010, warmth: 0.6, lamp: 0.9 },
  { h: 19.3, zenith: 0x0e1238, horizon: 0x5a3a6a, ground: 0x0e0a14, sun: 0xff6a5a, light: 0x8a8ad0, li: 0.5, hemiSky: 0x50508a, hemiGround: 0x16101a, hi: 0.4, fog: 0x3a2c48, fd: 0.012, warmth: 0.1, lamp: 1.4 },
  { h: 21, zenith: 0x050b20, horizon: 0x223262, ground: 0x070a14, sun: 0x9fb6ff, light: 0xa8bcf0, li: 0.65, hemiSky: 0x5068a8, hemiGround: 0x10131e, hi: 0.55, fog: 0x1a2a50, fd: 0.0085, warmth: -0.35, lamp: 1.6 },
  { h: 24, zenith: 0x040a1e, horizon: 0x1c2c56, ground: 0x060912, sun: 0x9fb6ff, light: 0xa8bcf0, li: 0.65, hemiSky: 0x5068a8, hemiGround: 0x10131e, hi: 0.55, fog: 0x18264a, fd: 0.0085, warmth: -0.4, lamp: 1.6 },
];

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerp3 = (a: RGB, b: RGB, k: number): RGB => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const smooth = (k: number) => k * k * (3 - 2 * k);

export function skyAt(hour: number): SkyState {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const k = smooth(Math.min(1, Math.max(0, (h - a.h) / (b.h - a.h || 1))));
  const c = (x: number, y: number) => lerp3(hex(x), hex(y), k);

  // 太阳:6 点东升、12 点最高(约 62°)、18 点西落;方位角从东(+x)扫到西(-x),偏南(-z,舞台后方)
  const dayPhase = ((h - 6) / 12) * Math.PI;
  const elev = Math.sin(dayPhase) * (62 * Math.PI / 180);
  const az = Math.PI * 0.5 - ((h - 6) / 12) * Math.PI; // 东 → 南 → 西
  const ce = Math.cos(elev);
  let sunDir: [number, number, number] = [Math.cos(az) * ce * 0.9, Math.sin(elev), -Math.abs(Math.sin(az)) * ce * 0.6 - 0.25];
  const len = Math.hypot(...sunDir);
  sunDir = [sunDir[0] / len, sunDir[1] / len, sunDir[2] / len];
  const night = Math.min(1, Math.max(0, (-elev + 0.02) / 0.25));

  return {
    sunDir,
    sunElevation: elev,
    night,
    zenith: c(a.zenith, b.zenith),
    horizon: c(a.horizon, b.horizon),
    ground: c(a.ground, b.ground),
    sunColor: c(a.sun, b.sun),
    lightColor: c(a.light, b.light),
    lightIntensity: lerp(a.li, b.li, k),
    hemiSky: c(a.hemiSky, b.hemiSky),
    hemiGround: c(a.hemiGround, b.hemiGround),
    hemiIntensity: lerp(a.hi, b.hi, k),
    fog: c(a.fog, b.fog),
    fogDensity: lerp(a.fd, b.fd, k),
    warmth: lerp(a.warmth, b.warmth, k),
    lampBoost: lerp(a.lamp, b.lamp, k),
  };
}

/** 平行光的方向:白天是太阳,夜里换成月亮(太阳的反方向,抬高一点) */
export function keyLightDir(s: SkyState): [number, number, number] {
  if (s.night < 0.5) return s.sunDir;
  const m: [number, number, number] = [-s.sunDir[0], Math.max(0.45, -s.sunDir[1]), -s.sunDir[2]];
  const l = Math.hypot(...m);
  return [m[0] / l, m[1] / l, m[2] / l];
}

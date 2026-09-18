// 从站内品牌标识生成各平台图标 —— 唯一的图标来源,别再手搓。
//
// 之前 src-tauri/icons/* 是 Tauri 脚手架的占位蓝底「Q」,而安卓 gen/android 里的 ic_launcher
// 在 63323cb 被第三方 logo 覆盖了,三端各长各的,跟站内的朱砂印章 + 行草字标都对不上。
// 这里一律从 src/components/brand/BrandLogo.tsx 的矢量数据出(字形取自钟齐志莽行书 /
// 马善政毛笔楷书,SIL OFL),字形只此一份,图标不会再和页面上的标识走散。
//
// 顺序要紧,两步都要跑:
//   1) node scripts/gen-icons.mjs             # 先出 1024 的源图
//   2) node node_modules/@tauri-apps/cli/tauri.js icon src-tauri/icons/icon-source.png
//   3) node scripts/gen-icons.mjs             # 再跑一次,盖掉 tauri 生成的安卓那几张
//
// 为什么要跑两次:`tauri icon` 不只写 src-tauri/icons,它也会直接改 gen/android 的 res。
// 它的自适应前景是把整张源图缩进安全区 —— 源图是铺满的朱砂底,缩完就成了「白底上浮着一个
// 红方块」。这里的前景只留印框和「月」(透明底),底色交给 @color/ic_launcher_background,
// 合成出来才是一整块朱砂印。所以最后一步必须是本脚本。
//
//   node scripts/gen-icons.mjs --check        # 只渲染到 .icon-preview/,不碰仓库
//
// 注意:安卓真正打进包里的是 src-tauri/gen/android/.../res 下面那份,
// 只改 src-tauri/icons/android 不生效。
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// sharp 是 next 的传递依赖,顶层 node_modules 没有入口,按需去 pnpm store 里找
function loadSharp() {
  try {
    return require('sharp');
  } catch {
    const store = join(ROOT, 'node_modules/.pnpm');
    const hit = readdirSync(store).find((d) => d.startsWith('sharp@'));
    if (!hit) throw new Error('找不到 sharp,先 pnpm install');
    return require(join(store, hit, 'node_modules/sharp'));
  }
}
const sharp = loadSharp();

const CHECK = process.argv.includes('--check');

// —— 颜色与字形都取自 BrandLogo.tsx ——
const SEAL_BG = '#B8262E';
const SEAL_INK = '#FBEFE6';
const WORD_W = 232.4;
const WORD_H = 88.3;

function brandPath(name) {
  const src = readFileSync(join(ROOT, 'src/components/brand/BrandLogo.tsx'), 'utf8');
  const m = src.match(new RegExp('const ' + name + " = '([^']+)'"));
  if (!m) throw new Error('BrandLogo.tsx 里找不到 ' + name);
  return m[1];
}
const MOON_PATH = brandPath('MOON_PATH');
const WORD_PATH = brandPath('WORD_PATH');

/** 印章本体。full=true 时铺满画布(应用图标,平台自己会切圆角)。 */
function sealSvg(size, { full = false } = {}) {
  const r = full ? 0 : 14;
  const inset = full ? 0 : 3;
  const side = 100 - inset * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect x="${inset}" y="${inset}" width="${side}" height="${side}" rx="${r}" fill="${SEAL_BG}"/>
  <rect x="11" y="11" width="78" height="78" rx="8" fill="none" stroke="${SEAL_INK}" stroke-width="3" opacity="0.85"/>
  <path d="${MOON_PATH}" fill="${SEAL_INK}" transform="translate(30.24 18.00) scale(0.7119)"/>
</svg>`;
}

/** 安卓自适应图标前景:安全区只有中间 66%,所以整体缩到 ~54% 居中。 */
function adaptiveForegroundSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 108 108">
  <g transform="translate(27 27) scale(0.54)">
    <rect x="11" y="11" width="78" height="78" rx="8" fill="none" stroke="${SEAL_INK}" stroke-width="3" opacity="0.85"/>
    <path d="${MOON_PATH}" fill="${SEAL_INK}" transform="translate(30.24 18.00) scale(0.7119)"/>
  </g>
</svg>`;
}

/** 安卓 TV 的 Leanback banner:左印章、右字标。 */
function tvBannerSvg(w = 320, h = 180) {
  const wordH = 46;
  const wordW = (wordH * WORD_W) / WORD_H;
  const sealSize = 64;
  const gap = 18;
  const x0 = (w - (sealSize + gap + wordW)) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#141014"/>
  <g transform="translate(${x0} ${(h - sealSize) / 2}) scale(${sealSize / 100})">
    <rect x="3" y="3" width="94" height="94" rx="14" fill="${SEAL_BG}"/>
    <rect x="11" y="11" width="78" height="78" rx="8" fill="none" stroke="${SEAL_INK}" stroke-width="3" opacity="0.85"/>
    <path d="${MOON_PATH}" fill="${SEAL_INK}" transform="translate(30.24 18.00) scale(0.7119)"/>
  </g>
  <g transform="translate(${x0 + sealSize + gap} ${(h - wordH) / 2}) scale(${wordH / WORD_H})">
    <path d="${WORD_PATH}" fill="${SEAL_INK}"/>
  </g>
</svg>`;
}

const outRoot = CHECK ? join(ROOT, '.icon-preview') : ROOT;
const made = [];

async function emit(svg, size, relPath) {
  const file = join(outRoot, relPath);
  const img = sharp(Buffer.from(svg));
  const buf = await (size ? img.resize(size, size) : img).png().toBuffer();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, buf);
  made.push([relPath, buf.length]);
}

const ANDROID_RES = 'src-tauri/gen/android/app/src/main/res';

async function main() {
  // 1) tauri icon 的输入:1024 铺满版
  await emit(sealSvg(1024, { full: true }), 1024, 'src-tauri/icons/icon-source.png');

  // 2) 自适应图标前景(API 26+)
  for (const [dpi, size] of [['mdpi', 108], ['hdpi', 162], ['xhdpi', 216], ['xxhdpi', 324], ['xxxhdpi', 432]]) {
    await emit(adaptiveForegroundSvg(size), size, `${ANDROID_RES}/mipmap-${dpi}/ic_launcher_foreground.png`);
  }
  // 3) 老机型的方图 / 圆图
  for (const [dpi, size] of [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]) {
    for (const name of ['ic_launcher.png', 'ic_launcher_round.png']) {
      await emit(sealSvg(size), size, `${ANDROID_RES}/mipmap-${dpi}/${name}`);
    }
  }
  // 4) TV banner(非正方形,不走 resize)
  await emit(tvBannerSvg(), null, `${ANDROID_RES}/drawable-xhdpi/tv_banner.png`);

  // 5) 自适应图标的底色:必须是印章的朱砂,否则前景那圈印框浮在白底上很怪
  //    (tauri icon 生成的是 #fff,每次跑完都得让这里盖回来)
  const bgXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <color name="ic_launcher_background">${SEAL_BG}</color>
</resources>
`;
  const bgFile = join(outRoot, `${ANDROID_RES}/values/ic_launcher_background.xml`);
  mkdirSync(dirname(bgFile), { recursive: true });
  writeFileSync(bgFile, bgXml);
  made.push([`${ANDROID_RES}/values/ic_launcher_background.xml`, bgXml.length]);

  // 6) 网页:Next 的 app/icon.* 文件约定优先于 metadata.icons
  await emit(sealSvg(512), 512, 'src/app/icon.png');
  await emit(sealSvg(180), 180, 'src/app/apple-icon.png');

  for (const [f, n] of made) console.log(`  ${String(n).padStart(8)}B  ${f}`);
  console.log(`\n${made.length} 个文件${CHECK ? '(仅预览,写在 .icon-preview/)' : ''}。`);
  if (!CHECK) {
    console.log('\n接着跑:node node_modules/@tauri-apps/cli/tauri.js icon src-tauri/icons/icon-source.png');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

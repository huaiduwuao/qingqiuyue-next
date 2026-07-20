// scripts/tauri-build.js - Tauri 构建前处理脚本
// 作用：在 Next.js standalone 构建后，排除 node_modules 并复制静态资源
const fs = require('fs');
const path = require('path');

const nextDir = path.join(__dirname, '..', '.next');
const standaloneDir = path.join(nextDir, 'standalone');
const outputDir = path.join(nextDir, 'tauri-dist');

// 清理并创建输出目录
if (fs.existsSync(outputDir)) {
  fs.rmSync(outputDir, { recursive: true });
}
fs.mkdirSync(outputDir, { recursive: true });

console.log('Processing standalone output for Tauri...');

// 复制 standalone 内容（不含 node_modules）
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;

  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    // 跳过 node_modules
    if (entry.name === 'node_modules') continue;

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 复制静态资源
function copyStaticDir(src, dest) {
  if (!fs.existsSync(src)) return;

  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyStaticDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir(standaloneDir, outputDir);
console.log('✓ Copied standalone files');

// 复制 .next/static
const staticSrc = path.join(nextDir, 'static');
const staticDest = path.join(outputDir, '.next', 'static');
if (fs.existsSync(staticSrc)) {
  copyStaticDir(staticSrc, staticDest);
  console.log('✓ Copied .next/static');
}

// 复制 public
const publicSrc = path.join(__dirname, '..', 'public');
const publicDest = path.join(outputDir, 'public');
if (fs.existsSync(publicSrc)) {
  copyStaticDir(publicSrc, publicDest);
  console.log('✓ Copied public/');
}

console.log('✓ Tauri build preparation complete');
console.log(`Output: ${outputDir}`);

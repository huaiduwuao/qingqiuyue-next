#!/usr/bin/env bash
# 同步 onnxruntime-web 运行时到 public/ort-wasm/
#
# 为什么需要:
#   Next.js 不会自动 bundle onnxruntime-web 的 WASM/.mjs 运行时。
#   必须手动复制到 public/ 目录并把 wasmPaths 指过去。
#   详见 src/lib/voice/wake-word.ts 的 resolveWasmPaths()
#
# 用法:
#   bash scripts/copy-ort-runtime.sh         # 用已装的版本
#   pnpm add onnxruntime-web@latest          # 升到最新版
#   bash scripts/copy-ort-runtime.sh         # 重新同步
#
# 提交 public/ort-wasm/*.wasm + *.mjs 到 git(虽然大,但 dev 模式需要)
# 生产环境建议改用 CDN(改 wake-word.ts 的 resolveWasmPaths 即可)

set -euo pipefail

cd "$(dirname "$0")/.."

# 找 onnxruntime-web dist 目录
DIST=$(ls -d node_modules/.pnpm/onnxruntime-web@*/node_modules/onnxruntime-web/dist 2>/dev/null | head -1)
if [ -z "$DIST" ]; then
    echo "✗ 找不到 onnxruntime-web dist 目录,先 pnpm install"
    exit 1
fi
echo "→ ORT dist: $DIST"

mkdir -p public/ort-wasm
rm -f public/ort-wasm/*

# 核心: 4 个 .mjs 入口 + 对应 .wasm
for f in "$DIST"/ort-wasm-simd-threaded*.{mjs,wasm}; do
    [ -f "$f" ] && cp "$f" public/ort-wasm/
done
cp "$DIST"/ort.mjs public/ort-wasm/ 2>/dev/null || true
cp "$DIST"/ort.min.mjs public/ort-wasm/ 2>/dev/null || true

echo "→ 复制完成:"
ls -la public/ort-wasm/ | tail -n +2
echo ""
echo "总大小: $(du -sh public/ort-wasm/ | cut -f1)"

# 同时检查 proxy.ts 是否有 /ort-wasm/ 白名单
if ! grep -q "'/ort-wasm'" src/proxy.ts; then
    echo ""
    echo "⚠️  src/proxy.ts 的 PUBLIC_PREFIXES 缺 '/ort-wasm',加上:"
    echo "    '/ort-wasm',  // onnxruntime-web 运行时"
fi
#!/usr/bin/env bash
# 同步 onnxruntime-web 运行时到 public/ort-wasm/
#
# 为什么需要:
#   Next.js 不会自动 bundle onnxruntime-web 的 WASM。必须复制到 public/ 并把 wasmPaths 指过去,
#   详见 src/lib/voice/wake-word.ts 的 resolveWasmPaths()。
#
# 只复制「已装版本」真正会请求的两个文件:
#   onnxruntime-web 1.18 的 JS 胶水已经打进 bundle,只按 (simd, threaded) 去拉 .wasm,
#   wake-word.ts 里 numThreads = 1 → ort-wasm-simd.wasm(threaded 版留着给以后开多线程)。
#   .wasm 必须和 node_modules 里的 JS 同一版本,版本错位时 InferenceSession 初始化失败,
#   唤醒词会静默退回备用方案。src/lib/voice/ort-wasm.test.ts 会校验两边逐字节一致。
#
# 用法(升级 onnxruntime-web 之后必须重跑,并确认新版本要的文件名;
# 1.19+ 改成 .mjs + jsep/jspi/asyncify 变体,那时要同步改这里、KEEP_WASM 和探测列表):
#   bash scripts/copy-ort-runtime.sh

set -euo pipefail

cd "$(dirname "$0")/.."

DIST=node_modules/onnxruntime-web/dist
if [ ! -d "$DIST" ]; then
    echo "✗ 找不到 $DIST,先 pnpm install"
    exit 1
fi
VERSION=$(node -p "require('./node_modules/onnxruntime-web/package.json').version")
echo "→ onnxruntime-web $VERSION: $DIST"

FILES=(ort-wasm-simd.wasm ort-wasm-simd-threaded.wasm)

mkdir -p public/ort-wasm
rm -f public/ort-wasm/*
for f in "${FILES[@]}"; do
    if [ ! -f "$DIST/$f" ]; then
        echo "✗ $DIST/$f 不存在:onnxruntime-web $VERSION 的文件名变了,按上面的说明同步调整"
        exit 1
    fi
    cp "$DIST/$f" public/ort-wasm/
done

echo "→ 复制完成:"
ls -la public/ort-wasm/ | tail -n +2


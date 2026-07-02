#!/usr/bin/env bash
# 构建脚本:把 qingqiuyue-next/out 复制到 desktop/frontend_dist,然后 wails build
# 用法:bash build.sh [platform]
#   platform: windows/amd64 (默认), darwin/universal, darwin/arm64, linux/amd64

set -euo pipefail
PLATFORM="${1:-windows/amd64}"

# 定位仓库根(假设脚本在 qingqiuyue-next/desktop/build.sh)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NEXT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$NEXT_DIR/.." && pwd)"

echo "▶ Building qingqiuyue-desktop for $PLATFORM"
echo "  next dir: $NEXT_DIR"
echo "  root dir: $ROOT_DIR"

# 1. 检查 wails CLI
if ! command -v wails3 >/dev/null 2>&1; then
    if ! command -v wails >/dev/null 2>&1; then
        echo "✗ wails CLI not found. Install:"
        echo "    go install github.com/wailsapp/wails/v3/cmd/wails3@latest"
        exit 1
    fi
fi
WAILS="${WAILS:-wails3}"

# 2. 构建 Next.js 静态导出
echo "▶ Step 1/3: building Next.js static export"
cd "$NEXT_DIR"
if [ ! -f "package.json" ]; then
    echo "✗ package.json not found at $NEXT_DIR"
    exit 1
fi

# 触发静态导出(next export)
# 注:Next.js 16 的静态导出命令请参考 AGENTS.md 指向的官方文档
# 当前 Next 16 写法(占位,可能因版本不同需调整):
pnpm install --frozen-lockfile || pnpm install
pnpm build
# 如果有 pnpm export:
# pnpm export 2>/dev/null || echo "(no export step, using .next/static)"
if [ -d "out" ]; then
    echo "  ✓ static export at $NEXT_DIR/out"
elif [ -d ".next/static" ]; then
    echo "  ⚠ no out/ dir, copying .next/static as fallback"
    mkdir -p "$NEXT_DIR/out"
    cp -r .next/static/* "$NEXT_DIR/out/"
else
    echo "✗ no static export produced (no out/ nor .next/static)"
    exit 1
fi

# 3. 复制到 desktop/frontend_dist
echo "▶ Step 2/3: copying out → desktop/frontend_dist"
cd "$SCRIPT_DIR"
rm -rf frontend_dist
mkdir -p frontend_dist
cp -r "$NEXT_DIR/out/." frontend_dist/

if [ ! -f "frontend_dist/index.html" ]; then
    echo "✗ frontend_dist/index.html missing after copy"
    exit 1
fi
echo "  ✓ frontend_dist ready ($(du -sh frontend_dist | cut -f1))"

# 4. Wails 构建
echo "▶ Step 3/3: wails build"
"$WAILS" build -platform "$PLATFORM" -clean

# 5. 输出位置
case "$PLATFORM" in
    windows/*)  BIN_EXT=".exe"; BIN_DIR="build/bin" ;;
    darwin/*)   BIN_EXT=".app"; BIN_DIR="build/bin" ;;
    linux/*)    BIN_EXT="";     BIN_DIR="build/bin" ;;
esac
echo ""
echo "✅ Build complete"
echo "   output: $SCRIPT_DIR/$BIN_DIR/qingqiuyue-desktop$BIN_EXT"
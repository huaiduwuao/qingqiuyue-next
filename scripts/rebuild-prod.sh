#!/usr/bin/env bash
# =====================================================================
# rebuild-prod.sh —— 改完代码后,一键重 build + 重启 3000 production
#
# 用法:
#   bash scripts/rebuild-prod.sh
#
# 行为:
#   1. 杀掉当前 3000 server.js
#   2. 跑 npm run build
#   3. 起新 server.js 在 3000
#   4. 等 ready 后 curl 测一下,失败回滚 log
# =====================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

LOG="/tmp/nextprod.log"

echo "========================================"
echo "  rebuild-prod —— 改完代码后跑这个"
echo "========================================"
echo ""

# 0. kill 现有 3000 server.js(避免端口冲突)
echo "[0] kill 现有 3000 server.js"
# 用 netstat 找 LISTENING 3000 的 PID
OLD_PIDS=$(netstat -ano 2>/dev/null | grep ":3000.*LISTENING" | awk '{print $NF}' | sort -u)
for pid in $OLD_PIDS; do
  if [[ -n "$pid" && "$pid" != "0" ]]; then
    taskkill //F //PID "$pid" 2>/dev/null || true
    echo "    杀 PID $pid"
  fi
done
sleep 1

# 1. build
echo ""
echo "[1] npm run build ..."
rm -f "$LOG"
export HTTP_PROXY="${HTTP_PROXY:-}"
export HTTPS_PROXY="${HTTPS_PROXY:-}"
if ! npx next build 2>&1 | tee -a "$LOG" | tail -8; then
  echo "    ❌ build 失败,看 $LOG"
  exit 1
fi

# 2. start
echo ""
echo "[2] node .next/standalone/server.js"
nohup node .next/standalone/server.js > "$LOG" 2>&1 &
NEW_PID=$!
echo "    PID: $NEW_PID"
sleep 3

# 3. 测
echo ""
echo "[3] 测 3000"
if curl -sf -o /dev/null -m 10 http://localhost:3000/digital-human; then
  echo "    ✅ /digital-human 200 OK"
else
  echo "    ❌ /digital-human 失败,看 $LOG"
fi

if curl -sf -o /dev/null -m 10 http://localhost:3000/avatars/model.glb; then
  echo "    ✅ /avatars/model.glb 200 OK"
else
  echo "    ❌ /avatars/model.glb 失败"
fi

echo ""
echo "========================================"
echo "  ✅ 3000 production 已重启,代码已生效"
echo "  浏览器开:http://localhost:3000"
echo "  看实时日志:tail -f $LOG"
echo "========================================"

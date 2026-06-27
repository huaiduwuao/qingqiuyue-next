#!/usr/bin/env bash
# =====================================================================
# xinference-setup.sh —— 一键启 xinference 容器 + 拉 LLM/TTS 模型
#
# 数字人流程的 LLM/TTS 后端(xinference 在 localhost:9997 跑)。
# chat 路由(route.ts)支持 OpenAI 兼容 endpoint,失败降级到 mock 关键词匹配。
#
# 前置:
#   - 用户机器有 docker.io/xprobe/xinference:latest 镜像(35GB)
#   - 用户机器有 HTTP 代理 127.0.0.1:7890(可选,无代理也能跑)
#
# 用法:
#   bash scripts/xinference-setup.sh
#   # 或指定代理:
#   HTTP_PROXY=http://127.0.0.1:7890 bash scripts/xinference-setup.sh
# =====================================================================
set -euo pipefail

PROXY="${HTTP_PROXY:-${1:-}}"
XINFERENCE_IMAGE="${XINFERENCE_IMAGE:-docker.io/xprobe/xinference:latest}"
CONTAINER_NAME="${CONTAINER_NAME:-xinf-test}"
LLM_MODEL="${LLM_MODEL:-Qwen2.5-0.5B-Instruct}"
TTS_MODEL="${TTS_MODEL:-CosyVoice2-0.5B}"
PORT="${PORT:-9997}"
DATA_VOL="${DATA_VOL:-xinf_data}"

echo "========================================"
echo "  xinference 启动 + 模型拉取"
echo "  代理: ${PROXY:-无(直连)}"
echo "  容器: $CONTAINER_NAME"
echo "  端口: $PORT"
echo "========================================"

# 1. 准备代理环境变量
if [[ -n "$PROXY" ]]; then
  PROXY_ENV=(
    -e "http_proxy=$PROXY"
    -e "https_proxy=$PROXY"
    -e "HTTP_PROXY=$PROXY"
    -e "HTTPS_PROXY=$PROXY"
    -e "no_proxy=localhost,127.0.0.1,10.2.1.21"
    -e "NO_PROXY=localhost,127.0.0.1,10.2.1.21"
  )
else
  PROXY_ENV=()
fi

# 2. 检查旧容器,删了重跑
if podman ps -a --format "{{.Names}}" 2>/dev/null | grep -q "^$CONTAINER_NAME$"; then
  echo "[1/5] 删旧容器 $CONTAINER_NAME"
  podman rm -f "$CONTAINER_NAME" 2>&1 | head -1
  sleep 2
fi

# 3. 启 xinference 容器
echo "[1/5] 启 xinference 容器..."
podman run -d \
  --name "$CONTAINER_NAME" \
  --network host \
  -v "$DATA_VOL:/data" \
  -e XINFERENCE_HOME=/data \
  "${PROXY_ENV[@]}" \
  "$XINFERENCE_IMAGE" \
  xinference-local -H 0.0.0.0 --port "$PORT" 2>&1 | tail -2
sleep 8

# 4. 等 9997 listen
echo "[2/5] 等 9997 listen..."
for i in $(seq 1 30); do
  if netstat -ano 2>/dev/null | grep -q ":$PORT.*LISTENING"; then
    echo "  9997 已 listen"
    break
  fi
  sleep 1
done
curl -sf --max-time 5 "http://127.0.0.1:$PORT/v1/cluster/info" 2>&1 | head -c 200 || echo "  cluster info 还没好,等更久"
echo

# 5. 拉 LLM
echo "[3/5] 启 LLM: $LLM_MODEL..."
podman exec "$CONTAINER_NAME" xinference launch -e "http://127.0.0.1:$PORT" \
  --model-name "$LLM_MODEL" \
  --model-type LLM \
  --model-engine transformers \
  --model-size-in-billions 0 2>&1 | tail -3

# 6. 拉 TTS
echo "[4/5] 启 TTS: $TTS_MODEL..."
podman exec "$CONTAINER_NAME" xinference launch -e "http://127.0.0.1:$PORT" \
  --model-name "$TTS_MODEL" \
  --model-type audio 2>&1 | tail -3

# 7. 验证
echo "[5/5] 验证..."
sleep 3
echo
echo "=== 已启的模型实例 ==="
podman exec "$CONTAINER_NAME" curl -s --max-time 5 "http://127.0.0.1:$PORT/v1/models/instances" 2>&1 | \
  python -c "
import sys, json
try:
    d = json.load(sys.stdin)
    for m in d:
        s = m.get('status', '?')
        rs = m.get('replica_statuses', [{}])[0]
        if rs.get('status') == 'ERROR':
            err = rs.get('error_message', '')[:80]
            print(f'  ❌ {m[\"model_name\"]}  status=ERROR: {err}')
        else:
            print(f'  ✓ {m[\"model_name\"]}  status=OK')
except Exception as e:
    print(f'  parse err: {e}')
" 2>&1

echo
echo "========================================"
echo "  数字人流程:"
echo "    1. 确保 xinference 跑: podman ps | grep $CONTAINER_NAME"
echo "    2. 在 .env.development.local 设:"
echo "       NEXT_PUBLIC_OPENAI_BASE_URL=http://127.0.0.1:$PORT/v1"
echo "       OPENAI_MODEL=$LLM_MODEL"
echo "    3. 数字人页面 /digital-human 输入消息即可"
echo "    4. 真模型跑通后,前端 console 看到 LLM 真实输出"
echo "    5. 模型没拉下来时,自动降级到 mock 关键词匹配"
echo "========================================"

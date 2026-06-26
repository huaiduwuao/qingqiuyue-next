#!/usr/bin/env bash
# =====================================================================
# reconstruct-colmap.sh —— COLMAP SfM + 稠密重建,产出 fused.ply
#
# 输入:$WORK/images/   (capture.sh 产出)
# 输出:$WORK/dense/fused.ply   (3DGS / clean-mesh.py 输入)
#
# 用法:
#   bash scripts/reconstruct-colmap.sh --work work/xiaoqiu
#
# COLMAP 安装指引:
#   macOS:  brew install colmap
#   Linux:  https://colmap.github.io/install.html (预编译二进制)
#   Win:    WSL2 推荐,或 https://github.com/colmap/colmap/releases
#
# 协议(STAGE/PROGRESS):
#   STAGE reconstruct 10   特征提取
#   STAGE reconstruct 35   特征匹配
#   STAGE reconstruct 60   SfM 重建
#   STAGE reconstruct 85   稠密重建
#   STAGE reconstruct 100  完成
# =====================================================================
set -euo pipefail

WORK=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --work) WORK="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$WORK" ]]; then
  echo "Usage: bash reconstruct-colmap.sh --work <dir>" >&2
  exit 1
fi
if [[ ! -d "$WORK/images" ]]; then
  echo "ERROR: $WORK/images 不存在,先跑 capture.sh" >&2
  exit 1
fi
if ! command -v colmap >/dev/null 2>&1; then
  echo "ERROR: colmap 不在 PATH。" >&2
  echo "  macOS:  brew install colmap" >&2
  echo "  Linux:  https://colmap.github.io/install.html" >&2
  echo "  Win:    WSL2 推荐" >&2
  exit 1
fi

emit() { echo "STAGE $1 $2"; }

echo "[reconstruct] 工作目录: $WORK"
mkdir -p "$WORK/database" "$WORK/sparse" "$WORK/dense"

emit reconstruct 5
echo "[reconstruct] 步骤 1/4 特征提取 (SIFT)..."
colmap feature_extractor \
    --database_path "$WORK/database.db" \
    --image_path "$WORK/images" \
    --SiftExtraction.use_gpu 1 \
    --SiftExtraction.max_image_size 2048 \
    2>&1 | tail -3

emit reconstruct 35
echo "[reconstruct] 步骤 2/4 特征匹配 (exhaustive)..."
colmap exhaustive_matcher \
    --database_path "$WORK/database.db" \
    --SiftMatching.use_gpu 1 \
    2>&1 | tail -3

emit reconstruct 60
echo "[reconstruct] 步骤 3/4 稀疏重建 (mapper)..."
mkdir -p "$WORK/sparse/0"
colmap mapper \
    --database_path "$WORK/database.db" \
    --image_path "$WORK/images" \
    --output_path "$WORK/sparse" \
    2>&1 | tail -5

# 找到 mapper 输出的最大重建(可能有多个,选 reg_images 最多的)
best_recon=""
best_count=0
for d in "$WORK/sparse"/*/; do
  [[ "$d" == */0/ ]] && continue  # mapper 已经把 0 用作占位,跳过
  cnt=$(grep -c '^' "$d/images.bin" 2>/dev/null || echo 0)
  if [[ $cnt -gt $best_count ]]; then
    best_count=$cnt
    best_recon="$d"
  fi
done
# fallback: 如果没有子目录,用 sparse/0
if [[ -z "$best_recon" ]]; then
  best_recon="$WORK/sparse/0"
fi
echo "[reconstruct] 选定的稀疏重建: $best_recon ($best_count 张注册图像)"

emit reconstruct 85
echo "[reconstruct] 步骤 4/4 图像去畸变 + 稠密重建..."
colmap image_undistorter \
    --image_path "$WORK/images" \
    --input_path "$best_recon" \
    --output_path "$WORK/dense" \
    --output_type COLMAP \
    2>&1 | tail -3

echo "[reconstruct] 稠密匹配 + 融合..."
colmap patch_match_stereo \
    --workspace_path "$WORK/dense" \
    --PatchMatchStereo.gpu_index 0 \
    2>&1 | tail -3

colmap stereo_fusion \
    --workspace_path "$WORK/dense" \
    --output_path "$WORK/dense/fused.ply" \
    --input_type geometric \
    2>&1 | tail -3

emit reconstruct 100
if [[ -f "$WORK/dense/fused.ply" ]]; then
  sz=$(du -h "$WORK/dense/fused.ply" | cut -f1)
  pts=$(grep -c '^' "$WORK/dense/fused.ply" || echo "?")
  echo "[reconstruct] 完成。fused.ply: $sz (行数粗估: $pts)"
else
  echo "ERROR: fused.ply 未生成" >&2
  exit 1
fi
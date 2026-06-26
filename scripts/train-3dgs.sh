#!/usr/bin/env bash
# =====================================================================
# train-3dgs.sh —— 3D Gaussian Splatting 训练
#
# 输入:$WORK/dense/   (reconstruct-colmap.sh 产出,COLMAP 格式)
# 输出:$WORK/gs/point_cloud/iteration_30000/point_cloud.ply
#
# 用法:
#   bash scripts/train-3dgs.sh --work work/xiaoqiu [--iterations 30000]
#
# 依赖:
#   - NVIDIA GPU + CUDA(8GB+ 显存)
#   - PyTorch with CUDA: pip install torch --index-url https://download.pytorch.org/whl/cu121
#   - pip install plyfile tqdm
#
# 协议(STAGE/PROGRESS):
#   STAGE train_3dgs 10   克隆 gaussian-splatting
#   STAGE train_3dgs 30   装环境
#   STAGE train_3dgs 100  训练完成
#
# 注意:
#   3DGS 训练非常吃显存(8GB 起步,推荐 12GB+);如果显存不够,
#   直接跳过这一步,reconstruct-colmap.sh 的 fused.ply 可以直接
#   给 clean-mesh.py 用(用 COLMAP 自己的 dense 点云就行)。
# =====================================================================
set -euo pipefail

WORK=""
ITERATIONS="30000"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --work) WORK="$2"; shift 2 ;;
    --iterations) ITERATIONS="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,40p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$WORK" ]]; then
  echo "Usage: bash train-3dgs.sh --work <dir> [--iterations N]" >&2
  exit 1
fi
if [[ ! -d "$WORK/dense" ]]; then
  echo "ERROR: $WORK/dense 不存在,先跑 reconstruct-colmap.sh" >&2
  exit 1
fi

emit() { echo "STAGE $1 $2"; }

cd "$WORK"

emit train_3dgs 5
echo "[train-3dgs] 工作目录: $WORK"
echo "[train-3dgs] 迭代数: $ITERATIONS"

# 1. 克隆 gaussian-splatting
if [[ ! -d gaussian-splatting ]]; then
  echo "[train-3dgs] 克隆 graphdeco-inria/gaussian-splatting ..."
  git clone --depth 1 https://github.com/graphdeco-inria/gaussian-splatting.git
else
  echo "[train-3dgs] gaussian-splatting 已存在,跳过 clone"
fi

emit train_3dgs 20
echo "[train-3dgs] 检查 Python 依赖..."
# 检查 torch 是否可用
python -c "import torch; assert torch.cuda.is_available()" 2>/dev/null || {
  echo "ERROR: PyTorch + CUDA 不可用。" >&2
  echo "  安装:" >&2
  echo "    pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121" >&2
  exit 1
}

# 检查 plyfile 和 tqdm
python -c "import plyfile, tqdm" 2>/dev/null || {
  echo "[train-3dgs] 装 plyfile + tqdm..."
  pip install -q plyfile tqdm
}

# 装 gaussian-splatting 自己的子模块
pip install -q submodules/diff-gaussian-rasterization submodules/simple-knn 2>/dev/null || {
  echo "WARN: submodules 安装失败,可能需要手动 cd gaussian-splatting && pip install -e submodules/diff-gaussian-rasterization submodules/simple-knn" >&2
}

emit train_3dgs 35
echo "[train-3dgs] 开始训练(可能 30~60 分钟)..."
mkdir -p "$WORK/gs"

# 启动训练;输出会被前台打,3DGS 自己的 train.py 不暴露 STAGE/PROGRESS 协议,
# 我们后台运行 + 轮询 progress。
cd "$WORK/gaussian-splatting"

# 解析进度行:[ITER X] 这种格式(gaussian-splatting 默认输出)
# 3DGS 训练通常 7000~30000 iter,iter 数字大致线性 → 我们按 iter/总进度估算
(
  python train.py \
      -s "$WORK/dense" \
      -m "$WORK/gs" \
      --iterations "$ITERATIONS" \
      --sh_degree 1 \
      2>&1 | while IFS= read -r line; do
        # 解析 "[ITER 1234]" 或 "Iteration 1234" → 进度
        if echo "$line" | grep -qE '\[ITER [0-9]+\]'; then
          cur=$(echo "$line" | grep -oE '\[[Ii][Tt][Ee][Rr] [0-9]+\]' | grep -oE '[0-9]+')
          if [[ -n "$cur" ]]; then
            pct=$(( cur * 100 / ITERATIONS ))
            emit train_3dgs "$pct"
          fi
        fi
        echo "$line"  # 透传给用户
      done
)

emit train_3dgs 100
if [[ -f "$WORK/gs/point_cloud/iteration_${ITERATIONS}/point_cloud.ply" ]]; then
  sz=$(du -h "$WORK/gs/point_cloud/iteration_${ITERATIONS}/point_cloud.ply" | cut -f1)
  echo "[train-3dgs] 完成。point_cloud.ply: $sz"
  echo "[train-3dgs] 下一步: bash scripts/clean-mesh.py --ply $WORK/gs/point_cloud/iteration_${ITERATIONS}/point_cloud.ply --out $WORK/mesh/cleaned.glb"
else
  echo "ERROR: 训练未生成 point_cloud.ply" >&2
  exit 1
fi
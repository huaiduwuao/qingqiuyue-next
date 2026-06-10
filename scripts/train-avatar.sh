#!/usr/bin/env bash
# ============================================================================
# 训练一个"可驱动高斯数字人" → 导出成前端可用的资产
# 对应项目文档:../AVATAR-TRAINING.md
#
# 用法:
#   ./scripts/train-avatar.sh <subject_id> <input_video.mp4> [method]
#   method: ExAvatar (默认, 全身+表情) | GauHuman (最快, 只身体)
#
# 前置:
#   - 1 块 NVIDIA GPU (12G+ VRAM 推荐, 24G 更好)
#   - CUDA 11.8 / 12.1
#   - FFmpeg
#   - 已注册 SMPL-X / FLAME 模型文件 (研究许可)
#
# 产物 (写到 --output 目录):
#   meta.json, smplx.json
#   gaussians.bin  skinning.bin  avatar.ply
# 把这 5 个文件拷到前端可访问目录, 配 AVATAR_ASSET_URL 即可。
# ============================================================================
set -euo pipefail

SUBJECT="${1:-}"
INPUT_VIDEO="${2:-}"
METHOD="${3:-ExAvatar}"

if [[ -z "$SUBJECT" || -z "$INPUT_VIDEO" ]]; then
  echo "用法: $0 <subject_id> <input_video.mp4> [ExAvatar|GauHuman]"
  echo "示例: $0 xiaoqiu ./capture/turn.mp4 ExAvatar"
  exit 1
fi
if [[ ! -f "$INPUT_VIDEO" ]]; then
  echo "❌ 视频不存在: $INPUT_VIDEO"
  exit 1
fi

# ─── 路径配置 ───
WORKDIR="${WORKDIR:-./avatar-train/$SUBJECT}"
DATA_DIR="$WORKDIR/data"
EXAVATAR_DIR="$WORKDIR/ExAvatar_RELEASE"
GAUHUMAN_DIR="$WORKDIR/GauHuman"
OUT_DIR="$WORKDIR/output"

echo "▶ subject=$SUBJECT method=$METHOD workdir=$WORKDIR"

# ─── 0. 环境 (一次性) ───
if [[ ! -d "$WORKDIR/env" ]]; then
  echo "▶ 创建 conda 环境 (一次性, 几分钟)"
  conda create -n avatar python=3.10 -y
  source activate avatar
  pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
  pip install ninja opencv-python numpy trimesh tqdm plyfile
  # 3DGS 光栅化 (需要 CUDA toolkit)
  pip install diff-gaussian-rasterization
  mkdir -p "$WORKDIR"
else
  echo "▶ 复用已存在的 conda 环境"
  source activate avatar
fi

# ─── 1. 抽帧 + 预处理 ───
mkdir -p "$DATA_DIR/images" "$DATA_DIR/masks" "$DATA_DIR/smplx"
echo "▶ 抽帧"
ffmpeg -i "$INPUT_VIDEO" -qscale:v 2 "$DATA_DIR/images/%05d.jpg" -y

echo "▶ 前景分割 (SAM / RVM, 由你仓库自带脚本跑)"
echo "  建议: 用 ExAvatar / GauHuman 自带的 preprocess/run_segmentation.py"
echo "  输出到 $DATA_DIR/masks/"

echo "▶ 逐帧 SMPL-X 拟合 (Hand4Whole / SMPLer-X)"
echo "  建议: 用 ExAvatar 自带的 preprocess/run_smplx_fitting.py"
echo "  输出到 $DATA_DIR/smplx/"

# ─── 2. 训练 ───
case "$METHOD" in
  ExAvatar)
    if [[ ! -d "$EXAVATAR_DIR" ]]; then
      echo "▶ clone ExAvatar"
      git clone https://github.com/mks0601/ExAvatar_RELEASE "$EXAVATAR_DIR"
    fi
    cd "$EXAVATAR_DIR"
    # 拷贝数据到 ExAvatar 期望的位置 (具体看仓库 README)
    ln -sfn "$DATA_DIR" data
    # 12G 降配: --max_gaussians 200000, 图像 resize 到 ~768 长边
    python main/train.py --subject_id "$SUBJECT" --config configs/4070_low.yaml
    ;;
  GauHuman)
    if [[ ! -d "$GAUHUMAN_DIR" ]]; then
      echo "▶ clone GauHuman"
      git clone https://github.com/skhu101/GauHuman "$GAUHUMAN_DIR"
    fi
    cd "$GAUHUMAN_DIR"
    python train.py -s "$DATA_DIR/$SUBJECT" --eval --motion_offset_flag --smpl_type smpl \
      --actor_gender neutral --iterations 1200
    ;;
  *)
    echo "❌ 未知 method: $METHOD (只支持 ExAvatar / GauHuman)"
    exit 1
    ;;
esac

# ─── 3. 导出 (转成前端 assetFormat) ───
echo "▶ 转换产物 → 前端 assetFormat"
python "$OLDPWD/scripts/convert-exavatar.py" \
  --exavatar-dir "$OUT_DIR" \
  --data-dir "$DATA_DIR" \
  --subject "$SUBJECT" \
  --out "$OUT_DIR"

echo ""
echo "✅ 训练完成, 产物在: $OUT_DIR"
ls -la "$OUT_DIR"
echo ""
echo "下一步:"
echo "  1. 把 $OUT_DIR/{meta.json,smplx.json,gaussians.bin,skinning.bin,avatar.ply}"
echo "     上传/拷贝到前端可访问目录 (例: public/avatar/xiaoqiu/)"
echo "  2. 改 src/mocks/handlers/avatar.ts 的 /api/avatar/config:"
echo "     assetUrl: '/avatar/xiaoqiu/'"
echo "  3. 浮窗会自动用 DynamicAvatarStage 渲染 3D 数字人"

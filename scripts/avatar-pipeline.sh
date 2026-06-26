#!/usr/bin/env bash
# =====================================================================
# avatar-pipeline.sh —— 端到端数字人生产管线
#
# 两种入口模式:
#
#  A. 视频管线(--input video.mp4):
#     capture → reconstruct → train_3dgs(可选)→ mesh → rig_blender → deploy
#
#  B. 预制库管线(--from-library <name>):
#     library → rig_blender → deploy
#     (跳过 capture/reconstruct/3dgs/mesh,直接用 public/avatars/library/<name>.glb)
#
# 用法 A(视频):
#   bash scripts/avatar-pipeline.sh \
#       --input input.mp4 --name xiaoqiu --out work/xiaoqiu
#
# 用法 B(预制库):
#   bash scripts/avatar-pipeline.sh \
#       --from-library aoi --name xiaoqiu --out work/xiaoqiu
#
# 通用可选参数:
#   --skip-3dgs         跳过 3DGS(没 GPU 时)
#   --mixamo <dir>      Mixamo FBX 动作目录
#   --deploy-dir <dir>  部署目标(默认 public/avatars/)
#   --height <m>        角色身高(库模式从 library.json 读)
#
# 进度协议(STAGE / PROGRESS) — 被 qingqiuyue-go/internal/avatarapp/studio.go parseTrainLine 直接消费:
#   STAGE capture 5 / PROGRESS 5
#   STAGE capture 100
#   ...
# =====================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

INPUT=""
FROM_LIBRARY=""
NAME="xiaoqiu"
OUT=""
SKIP_3DGS=0
MIXAMO_DIR=""
DEPLOY_DIR="$REPO_ROOT/public/avatars"
BLENDER="${BLENDER:-blender}"
HEIGHT="1.75"
LIBRARY_DIR="$REPO_ROOT/public/avatars/library"

usage() {
  sed -n '2,40p' "$0"
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --input) INPUT="$2"; shift 2 ;;
    --from-library) FROM_LIBRARY="$2"; shift 2 ;;
    --name) NAME="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    --skip-3dgs) SKIP_3DGS=1; shift ;;
    --mixamo) MIXAMO_DIR="$2"; shift 2 ;;
    --deploy-dir) DEPLOY_DIR="$2"; shift 2 ;;
    --blender) BLENDER="$2"; shift 2 ;;
    --height) HEIGHT="$2"; shift 2 ;;
    --library-dir) LIBRARY_DIR="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$INPUT" || -z "$OUT" ]]; then
  echo "Usage: bash avatar-pipeline.sh --input <video.mp4> --out <work-dir> [options]" >&2
  exit 1
fi
if [[ ! -f "$INPUT" ]]; then
  echo "ERROR: 输入视频不存在: $INPUT" >&2; exit 1
fi

emit() { echo "STAGE $1 $2"; echo "PROGRESS $2"; }
stage_start() { echo ""; echo "============================================"; echo "  STAGE: $1"; echo "============================================"; }

mkdir -p "$OUT"

START_TS=$(date +%s)
echo "[avatar-pipeline] $(date '+%Y-%m-%d %H:%M:%S') 开始"
if [[ -n "$FROM_LIBRARY" ]]; then
  echo "[avatar-pipeline] 模式: 预制库"
  echo "[avatar-pipeline] 角色: $FROM_LIBRARY"
  echo "[avatar-pipeline] 名称: $NAME"
  echo "[avatar-pipeline] 工作目录: $OUT"
  [[ -n "$MIXAMO_DIR" ]] && echo "[avatar-pipeline] Mixamo: $MIXAMO_DIR"
  echo "[avatar-pipeline] Deploy: $DEPLOY_DIR"
else
  echo "[avatar-pipeline] 模式: 视频 → 3DGS"
  echo "[avatar-pipeline] 输入: $INPUT"
  echo "[avatar-pipeline] 名称: $NAME"
  echo "[avatar-pipeline] 工作目录: $OUT"
  echo "[avatar-pipeline] Skip 3DGS: $SKIP_3DGS"
  [[ -n "$MIXAMO_DIR" ]] && echo "[avatar-pipeline] Mixamo: $MIXAMO_DIR"
  echo "[avatar-pipeline] Deploy: $DEPLOY_DIR"
fi

# ── Stage 0: 预制库 模式(跳过 capture/reconstruct/3dgs/mesh,直接用库 .glb) ───
if [[ -n "$FROM_LIBRARY" ]]; then
  LIB_FILE="$LIBRARY_DIR/$FROM_LIBRARY.glb"
  if [[ ! -f "$LIB_FILE" ]]; then
    echo "ERROR: 预制库角色不存在: $LIB_FILE" >&2
    echo "  跑: blender --background --python scripts/blender/build_anime_avatar.py -- --output $LIBRARY_DIR" >&2
    exit 1
  fi
  echo "[avatar-pipeline] 用预制库: $LIB_FILE"
  mkdir -p "$OUT/mesh"
  cp "$LIB_FILE" "$OUT/mesh/cleaned.glb"
  # 从 library.json 读身高(如有)
  if [[ -f "$LIBRARY_DIR/library.json" ]]; then
    LIB_HEIGHT=$(python -c "
import json, sys
try:
    with open('$LIBRARY_DIR/library.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    for c in data.get('characters', []):
        if c.get('id') == '$FROM_LIBRARY':
            print(c.get('height', 1.75))
            sys.exit(0)
    print(1.75)
except Exception as e:
    print(1.75)
")
    HEIGHT="$LIB_HEIGHT"
    echo "[avatar-pipeline] 从 library.json 读身高: $HEIGHT"
  fi
  # 占位 emit 让前端 SSE 收到阶段切到
  for s in capture reconstruct train_3dgs mesh; do
    stage_start "$s"
    emit "$s" 100
  done
  # 跳到 rig_blender 段
  goto_rig_blender=1
fi

# ── Stage 1: capture ──────────────────────────────────────
if [[ -z "${FROM_LIBRARY:-}" ]]; then
  if [[ -z "$INPUT" ]]; then
    echo "ERROR: 必须提供 --input <video> 或 --from-library <name>" >&2
    exit 1
  fi
stage_start "capture"
bash "$SCRIPT_DIR/capture.sh" --input "$INPUT" --out "$OUT/images_parent" 2>&1 | tee "$OUT/capture.log" || {
  echo "ERROR: capture 失败" >&2; exit 1
}
# capture.sh 把 images 写到 $OUT/images_parent/images/,挪到 $OUT/images/
if [[ -d "$OUT/images_parent/images" ]]; then
  rm -rf "$OUT/images"
  mv "$OUT/images_parent/images" "$OUT/images"
  rm -rf "$OUT/images_parent"
fi
emit capture 100

# ── Stage 2: reconstruct (COLMAP) ─────────────────────────
stage_start "reconstruct"
bash "$SCRIPT_DIR/reconstruct-colmap.sh" --work "$OUT" 2>&1 | tee "$OUT/reconstruct.log" || {
  echo "ERROR: reconstruct 失败" >&2; exit 1
}
emit reconstruct 100

# ── Stage 3: train_3dgs (optional) ────────────────────────
if [[ $SKIP_3DGS -eq 1 ]]; then
  echo "[avatar-pipeline] --skip-3dgs:跳过 3DGS,用 COLMAP dense fused.ply"
  PLY="$OUT/dense/fused.ply"
else
  stage_start "train_3dgs"
  bash "$SCRIPT_DIR/train-3dgs.sh" --work "$OUT" 2>&1 | tee "$OUT/train-3dgs.log" || {
    echo "WARN: train_3dgs 失败,回退到 COLMAP fused.ply"
    PLY="$OUT/dense/fused.ply"
  }
  PLY="$OUT/gs/point_cloud/iteration_30000/point_cloud.ply"
fi

# 检查 PLY 是否存在
if [[ ! -f "$PLY" ]]; then
  echo "ERROR: 点云 PLY 不存在: $PLY" >&2
  echo "  检查 $OUT/dense/ 或 $OUT/gs/ 是否生成了点云" >&2
  exit 1
fi
emit train_3dgs 100

# ── Stage 4: mesh (clean-mesh.py) ─────────────────────────
stage_start "mesh"
mkdir -p "$OUT/mesh"
python "$SCRIPT_DIR/clean-mesh.py" \
    --ply "$PLY" \
    --out "$OUT/mesh/cleaned.glb" 2>&1 | tee "$OUT/clean-mesh.log" || {
  echo "ERROR: clean-mesh 失败" >&2; exit 1
}
emit mesh 100
fi  # end if not FROM_LIBRARY

# ── Stage 5: rig_blender ──────────────────────────────────
stage_start "capture"
bash "$SCRIPT_DIR/capture.sh" --input "$INPUT" --out "$OUT/images_parent" 2>&1 | tee "$OUT/capture.log" || {
  echo "ERROR: capture 失败" >&2; exit 1
}
# capture.sh 把 images 写到 $OUT/images_parent/images/,挪到 $OUT/images/
if [[ -d "$OUT/images_parent/images" ]]; then
  rm -rf "$OUT/images"
  mv "$OUT/images_parent/images" "$OUT/images"
  rm -rf "$OUT/images_parent"
fi
emit capture 100

# ── Stage 2: reconstruct (COLMAP) ─────────────────────────
stage_start "reconstruct"
bash "$SCRIPT_DIR/reconstruct-colmap.sh" --work "$OUT" 2>&1 | tee "$OUT/reconstruct.log" || {
  echo "ERROR: reconstruct 失败" >&2; exit 1
}
emit reconstruct 100

# ── Stage 3: train_3dgs (optional) ────────────────────────
if [[ $SKIP_3DGS -eq 1 ]]; then
  echo "[avatar-pipeline] --skip-3dgs:跳过 3DGS,用 COLMAP dense fused.ply"
  PLY="$OUT/dense/fused.ply"
else
  stage_start "train_3dgs"
  bash "$SCRIPT_DIR/train-3dgs.sh" --work "$OUT" 2>&1 | tee "$OUT/train-3dgs.log" || {
    echo "WARN: train_3dgs 失败,回退到 COLMAP fused.ply"
    PLY="$OUT/dense/fused.ply"
  }
  PLY="$OUT/gs/point_cloud/iteration_30000/point_cloud.ply"
fi

# 检查 PLY 是否存在
if [[ ! -f "$PLY" ]]; then
  echo "ERROR: 点云 PLY 不存在: $PLY" >&2
  echo "  检查 $OUT/dense/ 或 $OUT/gs/ 是否生成了点云" >&2
  exit 1
fi
emit train_3dgs 100

# ── Stage 4: mesh (clean-mesh.py) ─────────────────────────
stage_start "mesh"
mkdir -p "$OUT/mesh"
python "$SCRIPT_DIR/clean-mesh.py" \
    --ply "$PLY" \
    --out "$OUT/mesh/cleaned.glb" 2>&1 | tee "$OUT/clean-mesh.log" || {
  echo "ERROR: clean-mesh 失败" >&2; exit 1
}
emit mesh 100

# ── Stage 5: rig_blender ──────────────────────────────────
stage_start "rig_blender"
RIG_OUT="$OUT/mesh/rigged.glb"
$BLENDER --background \
    --python "$SCRIPT_DIR/blender/rig_mesh.py" -- \
    --input "$OUT/mesh/cleaned.glb" \
    --output "$RIG_OUT" \
    --height "$HEIGHT" 2>&1 | tee "$OUT/rig-mesh.log" || {
  echo "ERROR: rig_mesh 失败" >&2; exit 1
}

# Stage 5b: 可选 Mixamo 动作导入
if [[ -n "$MIXAMO_DIR" && -d "$MIXAMO_DIR" ]]; then
  echo "[avatar-pipeline] 导入 Mixamo 动作: $MIXAMO_DIR"
  for fbx in "$MIXAMO_DIR"/*.fbx; do
    [[ ! -f "$fbx" ]] && continue
    action_name=$(basename "$fbx" .fbx)
    $BLENDER --background \
        --python "$SCRIPT_DIR/blender/import_mixamo.py" -- \
        --fbx "$fbx" \
        --target "$RIG_OUT" \
        --output "$RIG_OUT" \
        --action-name "$action_name" 2>&1 | tee -a "$OUT/mixamo.log" || {
      echo "WARN: Mixamo $action_name 导入失败" >&2
    }
  done
fi

emit rig_blender 100

# ── Stage 6: deploy ──────────────────────────────────────
stage_start "deploy"
mkdir -p "$DEPLOY_DIR/outfits"
cp "$RIG_OUT" "$DEPLOY_DIR/model.glb"
# 默认 outfit = 主模型
cp "$RIG_OUT" "$DEPLOY_DIR/outfits/casual.glb"
echo "[avatar-pipeline] deployed → $DEPLOY_DIR/model.glb"
emit deploy 100

END_TS=$(date +%s)
DT=$(( END_TS - START_TS ))
echo ""
echo "[avatar-pipeline] 完成!"
echo "[avatar-pipeline] 产物:"
echo "  - 主模型:    $DEPLOY_DIR/model.glb"
echo "  - 默认 outfit: $DEPLOY_DIR/outfits/casual.glb"
echo "  - 工作目录:  $OUT"
echo "  - 耗时:     $(( DT / 60 )) 分 $(( DT % 60 )) 秒"
echo ""
echo "[avatar-pipeline] 下一步:"
echo "  cd $REPO_ROOT && npm run dev"
echo "  浏览器打开 http://localhost:3000/digital-human"
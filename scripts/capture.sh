#!/usr/bin/env bash
# =====================================================================
# capture.sh —— 视频抽帧,作为 COLMAP / 3DGS 重建的输入
#
# 用法:
#   bash scripts/capture.sh --input input.mp4 --out work/
#   bash scripts/capture.sh --input input.mp4 --out work/ --fps 2 --width 1920
#
# 拍摄协议建议(打印到 stdout,人工遵守):
#   - 手机竖屏,主体在画面中央,占 60~80% 高度
#   - 慢速 360° 转一圈,匀速,~30 秒
#   - 充足漫射光(阴天 / 室内窗户光),避免顶光和逆光
#   - 主体保持静止表情,无表情 / 不说话(避免运动模糊)
#   - 不要戴帽子 / 口罩 / 墨镜(遮挡面部几何)
#   - 背景干净(白墙最佳),避免反光物体(玻璃 / 镜面)
#   - 帧率 ≥ 24 fps;分辨率 ≥ 1080p;焦距定焦(不要数码变焦)
#
# 产出:
#   $OUT/images/%05d.jpg   抽出来的帧(COLMAP 输入)
#   $OUT/manifest.json     帧元信息(分辨率 / fps / 总数)
#
# 协议(STAGE/PROGRESS):
#   emit "STAGE capture 5"
#   emit "STAGE capture 30"
#   ...
# =====================================================================
set -euo pipefail

OUT=""
INPUT=""
FPS="2"
WIDTH="1920"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --input) INPUT="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    --fps) FPS="$2"; shift 2 ;;
    --width) WIDTH="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$INPUT" || -z "$OUT" ]]; then
  echo "Usage: bash capture.sh --input <video.mp4> --out <dir> [--fps N] [--width N]" >&2
  exit 1
fi
if [[ ! -f "$INPUT" ]]; then
  echo "ERROR: 输入视频不存在: $INPUT" >&2
  exit 1
fi
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ERROR: 需要 ffmpeg。安装: brew install ffmpeg / apt-get install ffmpeg" >&2
  exit 1
fi

emit() { echo "STAGE $1 $2"; }

echo "=========================================="
echo " 拍摄协议提示"
echo "=========================================="
cat <<'EOF'
  - 手机竖屏,主体在画面中央,占 60~80% 高度
  - 慢速 360° 转一圈,匀速,~30 秒
  - 充足漫射光(阴天 / 室内窗户光),避免顶光和逆光
  - 主体保持静止表情,无表情 / 不说话(避免运动模糊)
  - 不要戴帽子 / 口罩 / 墨镜(遮挡面部几何)
  - 背景干净(白墙最佳),避免反光物体(玻璃 / 镜面)
  - 帧率 ≥ 24 fps;分辨率 ≥ 1080p;焦距定焦
EOF
echo "=========================================="
echo "输入: $INPUT"
echo "输出: $OUT"
echo "FPS: $FPS, WIDTH: $WIDTH"
echo "=========================================="

mkdir -p "$OUT/images"

emit capture 5
echo "[capture] 探测视频元信息..."
probe=$(ffprobe -v quiet -print_format json -show_streams -show_format "$INPUT" 2>/dev/null || echo "{}")
total_frames=$(echo "$probe" | grep -oP '"nb_frames":"?\K[0-9]+' | head -1 || echo "")
src_fps=$(echo "$probe" | grep -oP '"r_frame_rate":"\K[0-9]+/[0-9]+' | head -1 || echo "")
src_w=$(echo "$probe" | grep -oP '"width":\K[0-9]+' | head -1 || echo "")
src_h=$(echo "$probe" | grep -oP '"height":\K[0-9]+' | head -1 || echo "")
echo "[capture] 源: ${src_w}x${src_h} @ ${src_fps} fps,total_frames=${total_frames}"

emit capture 30
echo "[capture] 抽帧到 $OUT/images/ ..."
# scale 到指定宽度,固定 fps 抽帧,质量 q=2(高)
ffmpeg -y -i "$INPUT" \
    -vf "fps=${FPS},scale=${WIDTH}:-2" \
    -qscale:v 2 \
    "$OUT/images/%05d.jpg" \
    2>&1 | tail -5

emit capture 90
img_count=$(ls "$OUT/images"/*.jpg 2>/dev/null | wc -l | tr -d ' ')
echo "[capture] 抽出 $img_count 帧"

# 写 manifest
cat > "$OUT/manifest.json" <<EOF
{
  "input": "$INPUT",
  "fps": $FPS,
  "width": $WIDTH,
  "src_resolution": "${src_w}x${src_h}",
  "src_fps": "$src_fps",
  "image_count": $img_count
}
EOF

emit capture 100
echo "[capture] 完成。manifest: $OUT/manifest.json"
#!/usr/bin/env bash
# 下载 openWakeWord melspectrogram.onnx(标准特征提取器,所有唤醒词共用)
# 真正的唤醒词模型(xiaoyue.onnx)需要自训,见 public/wake/README.md
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f "public/wake/melspectrogram.onnx" ]; then
    echo "✓ melspectrogram.onnx 已存在 ($(du -h public/wake/melspectrogram.onnx | cut -f1))"
else
    echo "▶ 下载 melspectrogram.onnx ..."
    pip install -q openwakeword
    python -c "
import openwakeword, os, shutil
src = os.path.join(os.path.dirname(openwakeword.__file__), 'resources', 'melspectrogram.onnx')
if not os.path.exists(src):
    # 新版 openWakeWord 路径不同
    from openwakeword import download_models
    download_models(target_directory='public/wake')
else:
    os.makedirs('public/wake', exist_ok=True)
    shutil.copy(src, 'public/wake/melspectrogram.onnx')
print('✓ done')
"
fi

echo ""
echo "下一步:训练小月唤醒词模型"
echo "  python scripts/train_wake_word.py"
echo "  cp models/xiaoyue/xiaoyue.onnx public/wake/"
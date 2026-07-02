#!/usr/bin/env python3
"""
训练自定义唤醒词 (用 openWakeWord)

参考: https://github.com/dscripka/openWakeWord/blob/main/notebooks/Model_Training.ipynb

步骤:
  1. 装环境
     pip install openwakeword torch torchaudio numpy scipy matplotlib edge-tts
  2. 准备数据集 — 选一种:
     a) 录自己的声音: python scripts/record_wake_samples.py --phrase "小月" --count 60
     b) 用 TTS 合成: python scripts/synthesize_wake_samples.py --phrase "小月" --count 60
        (不需要麦克风,推荐先用这个跑通流程)
  3. 修改下面的 CONFIG
  4. 运行: python scripts/train_wake_word.py
  5. 输出: models/xiaoyue/xiaoyue.onnx (自动复制到 public/wake/)
"""

import os
import sys
from pathlib import Path

# ============== 配置 ==============
CONFIG = {
    "model_name": "xiaoyue",             # 输出文件名
    "target_phrase": ["小月", "小月啊", "嘿小月"],  # 训练的目标词
    "n_samples": 5000,                   # 总训练样本数 (含负样本)

    # 阳性样本路径 (你自己录的"小月"音频,或 TTS 合成)
    "positive_samples_dir": "data/positive",
    # 阴性样本 (openWakeWord 自带, 自动下载)
    "negative_samples_dir": "data/negative",
    # 背景噪声 (openWakeWord 自带, 自动下载)
    "background_noise_dir": "data/background",

    # 模型超参
    "layer_size": 64,                   # 网络层大小
    "epochs": 10,                       # 训练轮数
    "target_accuracy": 0.9,             # 目标验证准确率, 达到就早停
    "target_recall": 0.85,              # 目标召回率
    "target_fp_per_hour": 0.5,          # 目标误唤醒率 (每小时)
}

# 模型输出: 当前脚本在 qingqiuyue-next/scripts/, 模型输出到 models/,
# 复制到 ../public/wake/ 即可
REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = REPO_ROOT / "models" / CONFIG["model_name"]
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
PUBLIC_WAKE_DIR = REPO_ROOT / "public" / "wake"
PUBLIC_WAKE_DIR.mkdir(parents=True, exist_ok=True)


def prepare_data():
    """下载 openWakeWord 自带的负样本和背景噪声"""
    print("[1/4] 下载 openWakeWord 预训练模型 + 负样本...")
    from openwakeword import download_models
    download_models(target_directory=str(OUTPUT_DIR.parent))
    print("[1/4] ✓ 完成")


def collect_features():
    """检查阳性样本数量"""
    print("[2/4] 检查阳性样本...")
    positive_files = []
    pos_dir = REPO_ROOT / CONFIG["positive_samples_dir"]
    if pos_dir.exists():
        for ext in ("wav", "mp3", "ogg", "flac"):
            positive_files.extend(pos_dir.glob(f"**/*.{ext}"))
    print(f"  阳性样本: {len(positive_files)} 个文件 (目录: {pos_dir})")

    if len(positive_files) < 20:
        print(f"  ⚠️ 阳性样本太少 (建议 ≥ 50 条)")
        print(f"     录音:   python scripts/record_wake_samples.py --phrase \"小月\" --count 60")
        print(f"     合成:   python scripts/synthesize_wake_samples.py --phrase \"小月\" --count 60")
        sys.exit(1)

    return positive_files


def train():
    """训练"""
    print("[3/4] 开始训练 (CPU 上约 20-40 分钟, GPU 几分钟)...")
    from openwakeword import train as oww_train

    # openWakeWord 0.5+ 的 train 函数签名
    oww_train(
        model_name=CONFIG["model_name"],
        target_phrase=CONFIG["target_phrase"],
        n_samples=CONFIG["n_samples"],
        output_dir=str(OUTPUT_DIR),
        layer_size=CONFIG["layer_size"],
        epochs=CONFIG["epochs"],
        target_accuracy=CONFIG["target_accuracy"],
        target_recall=CONFIG["target_recall"],
        target_fp_per_hour=CONFIG["target_fp_per_hour"],
    )
    print(f"[3/4] ✓ 训练完成, 模型在: {OUTPUT_DIR}/{CONFIG['model_name']}.onnx")


def export_for_browser():
    """复制 ONNX 模型到前端 public 目录 + 自动拷 melspectrogram"""
    print("[4/4] 复制模型到前端 public/wake/ ...")
    import shutil

    # 1. 唤醒词模型
    src = OUTPUT_DIR / f"{CONFIG['model_name']}.onnx"
    dst = PUBLIC_WAKE_DIR / f"{CONFIG['model_name']}.onnx"
    if src.exists():
        shutil.copy(src, dst)
        print(f"  ✓ {dst.relative_to(REPO_ROOT)}")
    else:
        print(f"  ✗ 源文件不存在: {src}")
        return

    # 2. melspectrogram.onnx (从 openWakeWord pip 包拷)
    try:
        import openwakeword
        mel_src = Path(openwakeword.__file__).parent / "resources" / "melspectrogram.onnx"
        if not mel_src.exists():
            # 新版可能路径不同
            from openwakeword import utils
            mel_src = Path(utils.__file__).parent.parent / "models" / "melspectrogram.onnx"
        if mel_src.exists():
            mel_dst = PUBLIC_WAKE_DIR / "melspectrogram.onnx"
            shutil.copy(mel_src, mel_dst)
            print(f"  ✓ {mel_dst.relative_to(REPO_ROOT)}")
        else:
            print(f"  ⚠️ melspectrogram.onnx 在 {mel_src} 找不到,手动从以下地址下:")
            print(f"     https://github.com/dscripka/openWakeWord/releases/download/v0.5.1/melspectrogram.onnx")
    except ImportError:
        print(f"  ⚠️ openwakeword 未装,无法自动拷 melspectrogram.onnx")

    # 3. 列表确认
    print(f"\n  public/wake/ 当前内容:")
    for f in sorted(PUBLIC_WAKE_DIR.iterdir()):
        size = f.stat().st_size / 1024 / 1024
        print(f"    {f.name}  ({size:.2f} MB)")


if __name__ == "__main__":
    print(f"=== 训练唤醒词: {CONFIG['model_name']} ===")
    print(f"目标词: {CONFIG['target_phrase']}")
    print(f"阳性样本目录: {REPO_ROOT / CONFIG['positive_samples_dir']}")
    print()
    prepare_data()
    collect_features()
    train()
    export_for_browser()
    print()
    print("=== 完成! ===")
    print(f"刷新浏览器,点 mic,看 console 应出现:")
    print(f"  [wake] openWakeWord init success, label=小月")
    print(f"  [voice] wake word mode: openwakeword")
    print(f"说 '小月' 试试 (延迟 < 200ms)")
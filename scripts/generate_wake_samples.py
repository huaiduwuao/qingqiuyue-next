#!/usr/bin/env python3
"""
自动生成「小月」唤醒词训练样本 + 训练 openWakeWord 模型

用法:
  cd qingqiuyue-next/scripts
  pip install edge-tts numpy scipy soundfile audiomentations openwakeword torch torchaudio
  python generate_wake_samples.py

输出:
  - data/positive/xiaoyue_*.wav   (增强后的正样本)
  - data/negative/*.wav           (负样本, 从开源数据集下载)
  - models/xiaoyue/xiaoyue.onnx   (训练好的模型)
  - ../public/wake/xiaoyue.onnx   (复制到前端目录)
"""

import os
import sys
import random
import asyncio
import subprocess
from pathlib import Path
from typing import List

import numpy as np
import soundfile as sf
from scipy import signal

# 配置
PHRASE = "小月"
POSITIVE_DIR = Path("data/positive")
NEGATIVE_DIR = Path("data/negative")
BACKGROUND_DIR = Path("data/background")
MODEL_DIR = Path("models/xiaoyue")
FRONTEND_WAKE_DIR = Path("../public/wake")
SAMPLE_RATE = 16000

POSITIVE_BASE_COUNT = 30      # 基础合成样本数
POSITIVE_AUG_COUNT = 120      # 增强后总样本数
NEGATIVE_COUNT = 1000         # 负样本数
BACKGROUND_COUNT = 50         # 背景噪声数


def ensure_dirs():
    for d in [POSITIVE_DIR, NEGATIVE_DIR, BACKGROUND_DIR, MODEL_DIR, FRONTEND_WAKE_DIR]:
        d.mkdir(parents=True, exist_ok=True)


async def synthesize_with_edge_tts(text: str, output_path: Path, voice: str = "zh-CN-XiaoxiaoNeural"):
    """用 Edge-TTS 生成 16kHz 单声道 wav"""
    import edge_tts
    tmp_mp3 = output_path.with_suffix(".mp3")
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(str(tmp_mp3))

    # 用 ffmpeg 转成 16kHz mono wav
    cmd = [
        "ffmpeg", "-y", "-i", str(tmp_mp3),
        "-ar", str(SAMPLE_RATE), "-ac", "1", "-sample_fmt", "s16",
        str(output_path)
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    tmp_mp3.unlink(missing_ok=True)


async def generate_base_samples():
    """生成基础「小月」样本, 使用不同语速/音调/音色"""
    print(f"[1/5] 生成 {POSITIVE_BASE_COUNT} 条基础合成样本...")

    voices = [
        "zh-CN-XiaoxiaoNeural",   # 女声
        "zh-CN-XiaoyiNeural",     # 女声(温柔)
        "zh-CN-YunxiNeural",      # 男声
        "zh-CN-YunjianNeural",    # 男声(新闻)
        "zh-CN-XiaochenNeural",   # 童声
    ]

    variants = [
        "小月",
        "小月，",
        "小月啊",
        "嘿小月",
        "小月小月",
    ]

    tasks = []
    for i in range(POSITIVE_BASE_COUNT):
        voice = voices[i % len(voices)]
        text = variants[i % len(variants)]
        out = POSITIVE_DIR / f"xiaoyue_base_{i:03d}.wav"
        tasks.append(synthesize_with_edge_tts(text, out, voice))

    await asyncio.gather(*tasks)
    print(f"[1/5] ✓ 基础样本已保存到 {POSITIVE_DIR}")


def load_audio(path: Path) -> np.ndarray:
    data, sr = sf.read(str(path), dtype="float32")
    if sr != SAMPLE_RATE:
        # 重采样
        num_samples = int(len(data) * SAMPLE_RATE / sr)
        data = signal.resample(data, num_samples)
    if len(data.shape) > 1:
        data = data.mean(axis=1)
    return data


def save_audio(data: np.ndarray, path: Path):
    sf.write(str(path), data, SAMPLE_RATE, subtype="PCM_16")


def add_noise(audio: np.ndarray, noise: np.ndarray, snr_db: float = 10.0) -> np.ndarray:
    """按 SNR 叠加背景噪声"""
    audio_power = np.mean(audio ** 2)
    noise_power = np.mean(noise ** 2)
    if noise_power == 0:
        return audio
    noise_factor = np.sqrt(audio_power / (noise_power * (10 ** (snr_db / 10))))
    noise_scaled = noise[:len(audio)] * noise_factor
    return audio + noise_scaled


def time_stretch(audio: np.ndarray, rate: float) -> np.ndarray:
    """变速不变调"""
    return signal.resample(audio, int(len(audio) / rate))


def pitch_shift(audio: np.ndarray, n_steps: float) -> np.ndarray:
    """简单的变调(基于重采样 + 时长恢复)"""
    factor = 2 ** (n_steps / 12)
    stretched = signal.resample(audio, int(len(audio) * factor))
    return signal.resample(stretched, len(audio))


def generate_background_noise():
    """生成简单背景噪声(白噪声/粉噪声/低嗡嗡声)"""
    print("[2/5] 生成背景噪声...")
    for i in range(BACKGROUND_COUNT):
        duration = random.uniform(3.0, 6.0)
        samples = int(SAMPLE_RATE * duration)

        noise_type = random.choice(["white", "pink", "hum"])
        if noise_type == "white":
            noise = np.random.normal(0, 0.1, samples).astype(np.float32)
        elif noise_type == "pink":
            white = np.random.normal(0, 1.0, samples)
            b, a = signal.butter(1, 0.1, btype="low")
            noise = signal.filtfilt(b, a, white).astype(np.float32) * 0.15
        else:  # hum
            t = np.linspace(0, duration, samples)
            hum = 0.05 * np.sin(2 * np.pi * 50 * t) + 0.03 * np.sin(2 * np.pi * 100 * t)
            noise = hum.astype(np.float32)

        save_audio(noise, BACKGROUND_DIR / f"noise_{i:03d}.wav")
    print("[2/5] ✓ 背景噪声已生成")


def augment_positive_samples():
    """对基础样本做数据增强, 生成更多训练样本"""
    print("[3/5] 数据增强, 生成更多正样本...")

    base_files = sorted(POSITIVE_DIR.glob("xiaoyue_base_*.wav"))
    if not base_files:
        print("⚠️ 没有基础样本, 请先运行 generate_base_samples")
        return

    background_files = sorted(BACKGROUND_DIR.glob("noise_*.wav"))
    if not background_files:
        print("⚠️ 没有背景噪声, 将生成无噪声样本")

    target_count = POSITIVE_AUG_COUNT
    generated = 0
    while generated < target_count:
        base = load_audio(random.choice(base_files))

        # 随机变速 0.85 ~ 1.15
        if random.random() < 0.7:
            base = time_stretch(base, random.uniform(0.85, 1.15))

        # 随机变调 -3 ~ +3 半音
        if random.random() < 0.5:
            base = pitch_shift(base, random.uniform(-3.0, 3.0))

        # 随机音量缩放
        base = base * random.uniform(0.6, 1.4)

        # 随机裁剪/填充到 1~2 秒
        target_len = int(SAMPLE_RATE * random.uniform(1.0, 2.0))
        if len(base) < target_len:
            pad_before = random.randint(0, target_len - len(base))
            pad_after = target_len - len(base) - pad_before
            base = np.pad(base, (pad_before, pad_after), mode="constant")
        else:
            start = random.randint(0, len(base) - target_len)
            base = base[start:start + target_len]

        # 叠加背景噪声
        if background_files and random.random() < 0.7:
            bg = load_audio(random.choice(background_files))
            if len(bg) < len(base):
                bg = np.tile(bg, int(np.ceil(len(base) / len(bg))))
            start = random.randint(0, len(bg) - len(base))
            bg = bg[start:start + len(base)]
            base = add_noise(base, bg, snr_db=random.uniform(5.0, 20.0))

        # 防止削波
        base = np.clip(base, -1.0, 1.0)

        out_path = POSITIVE_DIR / f"xiaoyue_aug_{generated:03d}.wav"
        save_audio(base, out_path)
        generated += 1

    print(f"[3/5] ✓ 增强后正样本共 {generated} 条")


def download_openwakeword_assets():
    """下载 openWakeWord 负样本和背景噪声"""
    print("[4/5] 下载 openWakeWord 训练依赖...")
    try:
        from openwakeword import download_models
        download_models(target_directory=str(MODEL_DIR.parent))
        print("[4/5] ✓ 依赖下载完成")
    except Exception as e:
        print(f"[4/5] ⚠️ 下载依赖失败(可继续训练): {e}")


def train_model():
    """调用 openWakeWord 训练模型"""
    print("[5/5] 训练 openWakeWord 模型...")
    try:
        from openwakeword import train as oww_train

        oww_train(
            model_name="xiaoyue",
            target_phrase=[PHRASE, f"{PHRASE}啊", f"嘿{PHRASE}"],
            custom_negative_phrases=["清秋月", "晓月", "小约", "小悦", "小岳"],
            n_samples=5000,
            output_dir=str(MODEL_DIR),
            layer_size=64,
            epochs=10,
            target_accuracy=0.9,
            target_recall=0.85,
            target_fp_per_hour=0.5,
        )

        # 复制到前端目录
        src = MODEL_DIR / "xiaoyue.onnx"
        dst = FRONTEND_WAKE_DIR / "xiaoyue.onnx"
        if src.exists():
            import shutil
            shutil.copy(src, dst)
            print(f"[5/5] ✓ 模型已训练并复制到: {dst}")
        else:
            print(f"[5/5] ⚠️ 模型文件未找到: {src}")

    except Exception as e:
        print(f"[5/5] ✗ 训练失败: {e}")
        raise


async def main():
    ensure_dirs()

    # 如果还没安装 ffmpeg, 友好提示
    if subprocess.run(["ffmpeg", "-version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode != 0:
        print("⚠️ 请先安装 ffmpeg 并加入 PATH: https://ffmpeg.org/download.html")
        sys.exit(1)

    await generate_base_samples()
    generate_background_noise()
    augment_positive_samples()
    download_openwakeword_assets()
    train_model()

    print("\n=== 完成 ===")
    print(f"模型位置: {MODEL_DIR}/xiaoyue.onnx")
    print(f"前端模型位置: {FRONTEND_WAKE_DIR}/xiaoyue.onnx")
    print("别忘了下载 melspectrogram.onnx 到 public/wake/:")
    print("  curl -L https://github.com/dscripka/openWakeWord/releases/download/v0.5.1/melspectrogram.onnx -o ../public/wake/melspectrogram.onnx")


if __name__ == "__main__":
    asyncio.run(main())

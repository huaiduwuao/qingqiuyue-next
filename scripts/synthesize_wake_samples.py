#!/usr/bin/env python3
"""
用 edge-tts 合成唤醒词训练样本 (不需要麦克风)

适用场景:
  - 没有录音设备
  - 想快速跑通流程
  - 模型精度 < 真录音,但足以验证 pipeline

用法:
  pip install edge-tts
  python scripts/synthesize_wake_samples.py --phrase "小月" --count 60

输出:
  data/positive/小月_001.wav ~ 小月_060.wav  (16kHz mono, 1-2 秒/条)

变体策略 (自动生成不同节奏 + 语调 + 助词):
  - 句式: "小月" / "小月啊" / "嘿小月" / "小月?" / "嗨小月"
  - 语速: -30% / -10% / 0 / +15% / +30%
  - 音调: -5% / 0 / +5% (从不同 voice 选)
  - 背景音: 30% 概率混轻微底噪 (提高鲁棒性)
"""

import argparse
import asyncio
import random
import sys
from pathlib import Path

import edge_tts
import numpy as np
from scipy.io import wavfile
from scipy.signal import resample


# Microsoft Edge TTS 中文 voices (免费,无需 token)
# 完整列表: https://learn.microsoft.com/azure/ai-services/speech-service/language-support
VOICES = [
    "zh-CN-XiaoxiaoNeural",   # 女声 晓晓 (推荐,自然)
    "zh-CN-YunxiNeural",     # 男声 云希
    "zh-CN-YunyangNeural",   # 男声 云南
    "zh-CN-XiaoyiNeural",    # 女声 晓伊
    "zh-CN-liaoning-XiaobeiNeural",  # 东北口音 (增加多样性)
]


# 不同变体: 句式 + 语速 + 音调
VARIANTS = [
    {"text": "{P}", "rate": "+0%",   "pitch": "+0Hz"},
    {"text": "{P}", "rate": "+15%",  "pitch": "+0Hz"},
    {"text": "{P}", "rate": "-15%",  "pitch": "+0Hz"},
    {"text": "{P}啊", "rate": "+0%",  "pitch": "+0Hz"},
    {"text": "嘿{P}", "rate": "+10%", "pitch": "+2Hz"},
    {"text": "嗨{P}", "rate": "+5%",  "pitch": "+1Hz"},
    {"text": "{P}?", "rate": "-5%",   "pitch": "+3Hz"},  # 上扬语调
    {"text": "{P}", "rate": "+30%",  "pitch": "-2Hz"},  # 紧凑
]


async def synth_one(text: str, voice: str, rate: str, pitch: str, out_path: Path) -> bool:
    """合成一条 wav 文件,失败返回 False"""
    try:
        communicate = edge_tts.Communicate(
            text,
            voice=voice,
            rate=rate,
            pitch=pitch,
        )
        # edge-tts 默认输出 24kHz, 我们要 16kHz, 下载后用 scipy 重采样
        mp3_path = out_path.with_suffix(".mp3")
        await communicate.save(str(mp3_path))

        # 用 pydub/soundfile 读 mp3 太重, 改用 ffprobe + ffmpeg 转 wav 16kHz mono
        import subprocess
        wav_tmp = out_path.with_suffix(".wav.tmp")
        r = subprocess.run(
            ["ffmpeg", "-y", "-i", str(mp3_path), "-ar", "16000", "-ac", "1", str(wav_tmp)],
            capture_output=True, timeout=30,
        )
        if r.returncode != 0:
            return False

        # 重命名 + 删 mp3
        wav_tmp.rename(out_path)
        mp3_path.unlink(missing_ok=True)
        return True
    except Exception as e:
        print(f"  ⚠️ {text} ({voice}): {e}")
        return False


def add_background_noise(wav_path: Path, snr_db: float = 20.0):
    """给 wav 加轻微底噪 (SNR=20dB), 增加训练样本多样性"""
    try:
        import subprocess
        # 用 ffmpeg 生成 1.5s 粉噪
        noise_tmp = wav_path.with_suffix(".noise.wav")
        r = subprocess.run(
            ["ffmpeg", "-y", "-f", "lavfi", "-i", "color=color=black:size=1:duration=2:rate=16000",
             "-af", f"anoisesrc=color=pink:amplitude=0.02", str(noise_tmp)],
            capture_output=True, timeout=10,
        )
        if r.returncode != 0:
            return

        # 混合
        rate, audio = wavfile.read(wav_path)
        _, noise = wavfile.read(noise_tmp)
        # 截取到等长
        n = min(len(audio), len(noise))
        if n == 0:
            noise_tmp.unlink(missing_ok=True)
            return
        # 简单线性混合 (按 SNR 缩放噪声)
        if audio.dtype == np.int16:
            audio_f = audio.astype(np.float32) / 32768.0
        else:
            audio_f = audio.astype(np.float32)
        if noise.dtype == np.int16:
            noise_f = noise[:n].astype(np.float32) / 32768.0
        else:
            noise_f = noise[:n].astype(np.float32)
        # 计算当前 SNR, 缩放噪声
        sig_power = np.mean(audio_f ** 2)
        noise_power = np.mean(noise_f ** 2) + 1e-10
        target_noise_power = sig_power / (10 ** (snr_db / 10))
        scale = np.sqrt(target_noise_power / noise_power)
        mixed = audio_f[:n] + noise_f * scale
        # 限幅
        mixed = np.clip(mixed, -1, 1)
        wavfile.write(wav_path, 16000, (mixed * 32767).astype(np.int16))
        noise_tmp.unlink(missing_ok=True)
    except Exception as e:
        print(f"  ⚠️ 加噪失败 (忽略): {e}")


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--phrase", default="小月", help="唤醒词")
    parser.add_argument("--count", type=int, default=60, help="合成几条")
    parser.add_argument("--out", default="data/positive", help="输出目录(相对 repo 根)")
    parser.add_argument("--with-noise", action="store_true", help="30%% 概率加底噪(更鲁棒)")
    parser.add_argument("--no-ffmpeg-fallback", action="store_true",
                        help="如果 ffmpeg 不可用,直接保存 24kHz wav(模型可能拒)")
    args = parser.parse_args()

    # 路径: scripts/ → repo 根
    REPO_ROOT = Path(__file__).resolve().parent.parent
    out_dir = REPO_ROOT / args.out
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"=== 合成 '{args.phrase}' 唤醒词样本 ===")
    print(f"目标: {out_dir}")
    print(f"数量: {args.count}")
    print(f"voices: {len(VOICES)} 种 (Edge TTS 免费中文)")
    print(f"变体: {len(VARIANTS)} 种 (语速/语调/句式)")
    print()

    # 检查 ffmpeg
    import shutil
    has_ffmpeg = shutil.which("ffmpeg") is not None
    if not has_ffmpeg and not args.no_ffmpeg_fallback:
        print("⚠️ 找不到 ffmpeg — 16kHz 转换会失败")
        print("   安装: choco install ffmpeg  (Windows)  /  brew install ffmpeg  (mac)  /  apt install ffmpeg  (Linux)")
        print("   或加 --no-ffmpeg-fallback 保存原始 24kHz wav(不推荐)")
        sys.exit(1)

    success = 0
    for i in range(args.count):
        # 随机选 voice + 变体
        voice = random.choice(VOICES)
        variant = random.choice(VARIANTS)
        text = variant["text"].format(P=args.phrase)

        filename = f"{args.phrase}_{i+1:03d}.wav"
        out_path = out_dir / filename

        print(f"[{i+1}/{args.count}] {voice} | {variant['rate']} {variant['pitch']} | '{text}'")
        ok = await synth_one(text, voice, variant["rate"], variant["pitch"], out_path)
        if ok:
            if args.with_noise and random.random() < 0.3:
                add_background_noise(out_path, snr_db=random.uniform(15, 25))
            success += 1
        else:
            print(f"  ⚠️ 失败, 跳过")

    print()
    print(f"=== 完成! 成功 {success}/{args.count} 条 ===")
    print(f"下一步:")
    print(f"  python scripts/train_wake_word.py")


if __name__ == "__main__":
    asyncio.run(main())
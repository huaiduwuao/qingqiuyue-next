#!/usr/bin/env python3
"""
录制自定义唤醒词样本 (配合 train_wake_word.py 使用)

用法:
  python scripts/record_wake_samples.py --phrase "小月" --count 60 --out data/positive

需要: pip install sounddevice numpy scipy
"""

import argparse
import time
import sys
from pathlib import Path
import numpy as np
import sounddevice as sd
from scipy.io import wavfile


def record_one(phrase: str, sample_rate: int = 16000, duration: float = 2.0) -> np.ndarray:
    """录一条音频, 自动 trim 静音"""
    print(f"  准备... (录 {duration}s)")
    time.sleep(0.5)
    print(f"  🎤 念 '{phrase}'")
    audio = sd.rec(int(duration * sample_rate), samplerate=sample_rate, channels=1, dtype='int16')
    sd.wait()
    print(f"  ✓ 完成")
    return audio.flatten()


def trim_silence(audio: np.ndarray, sample_rate: int, threshold: int = 500) -> np.ndarray:
    """去掉首尾静音"""
    abs_audio = np.abs(audio.astype(np.int32))
    # 找第一个超过 threshold 的位置
    start = 0
    for i in range(len(abs_audio)):
        if abs_audio[i] > threshold:
            start = max(0, i - int(0.05 * sample_rate))  # 留 50ms 缓冲
            break
    # 找最后一个
    end = len(audio)
    for i in range(len(abs_audio) - 1, -1, -1):
        if abs_audio[i] > threshold:
            end = min(len(audio), i + int(0.1 * sample_rate))
            break
    return audio[start:end]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--phrase", default="小月", help="要录制的唤醒词")
    parser.add_argument("--count", type=int, default=50, help="录几条")
    parser.add_argument("--out", default="data/positive", help="输出目录")
    parser.add_argument("--duration", type=float, default=2.0, help="每条时长(秒)")
    parser.add_argument("--rate", type=int, default=16000, help="采样率 (openWakeWord 需要 16kHz)")
    parser.add_argument("--variants", action="store_true", help="每条用不同语调 (语速/重音变化)")
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"=== 录音 '{args.phrase}' ===")
    print(f"输出: {out_dir}")
    print(f"数量: {args.count}")
    print(f"采样率: {args.rate} Hz, 时长: {args.duration}s")
    print(f"提示: 录的时候建议用不同语调/语速/距离, 让模型更鲁棒")
    print()

    for i in range(args.count):
        print(f"\n[{i+1}/{args.count}]")
        if args.variants:
            print("  (建议尝试: 正常/慢/快/小声/大声/远/近)")
        try:
            audio = record_one(args.phrase, args.rate, args.duration)
        except KeyboardInterrupt:
            print("\n中断")
            sys.exit(0)

        # trim 静音
        trimmed = trim_silence(audio, args.rate)
        if len(trimmed) < int(0.3 * args.rate):
            print(f"  ⚠️ 录得太短 ({len(trimmed)/args.rate:.2f}s), 跳过")
            continue
        if len(trimmed) > int(args.duration * args.rate * 0.9):
            # 没 trim 多少, 用原始
            trimmed = audio

        # 保存
        filename = f"{args.phrase}_{i+1:03d}.wav"
        filepath = out_dir / filename
        wavfile.write(filepath, args.rate, trimmed.astype(np.int16))
        print(f"  💾 {filepath} ({len(trimmed)/args.rate:.2f}s)")

    print(f"\n=== 完成! 共 {args.count} 个样本 ===")
    print(f"下一步: python scripts/train_wake_word.py")


if __name__ == "__main__":
    main()
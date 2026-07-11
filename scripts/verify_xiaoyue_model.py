"""
验证训练好的小月模型在各种音频上的实际表现
- 不只看单帧 max,看连续 5+ 帧 > 0.5 的"触发"次数(模拟浏览器实际唤醒逻辑)
- 跑正样本 + 多类负样本,看误唤醒率
"""

import sys
import os
import wave
from pathlib import Path

REPO_ROOT = Path(r"D:\git\really\qingqiuyue-next")
MODEL = REPO_ROOT / "public" / "wake" / "xiaoyue.onnx"
POS_DIR = REPO_ROOT / "data" / "positive"
NEG_DIR = REPO_ROOT / "data" / "negative"

# 模拟浏览器触发逻辑: 连续 N 帧 > threshold 才算"唤醒"
TRIGGER_THRESHOLD = 0.5
TRIGGER_FRAMES = 3  # 连续 3 帧 (3 * 80ms = 240ms) > 0.5 才算触发


def load_wav(path: Path) -> tuple[int, "np.ndarray"]:
    import numpy as np
    with wave.open(str(path), mode="rb") as f:
        sr = f.getframerate()
        data = np.frombuffer(f.readframes(f.getnframes()), dtype=np.int16)
    return sr, data


def predict_long(model, audio: "np.ndarray", chunk_size: int = 1280) -> list[float]:
    """跟 openwakeword.model.predict_clip 一样的 80ms 滑窗, 但只返回 xiaoyue 那一列"""
    import numpy as np
    out = []
    for i in range(0, len(audio) - chunk_size, chunk_size):
        # padding: 1s before + 1s after, 跟 openwakeword.Model.predict_clip padding=1 一致
        start = max(0, i - 16000)
        end = min(len(audio), i + chunk_size + 16000)
        frame = audio[start:end]
        if len(frame) < chunk_size + 32000:
            # 不够, 前后补 1s 静音
            pad_left = max(0, 16000 - i)
            pad_right = max(0, (i + chunk_size + 16000) - len(audio))
            frame = np.concatenate([
                np.zeros(pad_left, dtype=np.int16),
                frame,
                np.zeros(pad_right, dtype=np.int16),
            ])
        pred = model.predict(frame)
        out.append(float(pred.get("xiaoyue", 0)))
    return out


def count_triggers(scores: list[float]) -> int:
    """连续 TRIGGER_FRAMES 帧 > threshold 算一次触发"""
    triggers = 0
    run = 0
    for s in scores:
        if s >= TRIGGER_THRESHOLD:
            run += 1
            if run >= TRIGGER_FRAMES:
                triggers += 1
                run = 0  # 重置避免一次长段算多次
        else:
            run = 0
    return triggers


def main():
    import numpy as np
    import openwakeword

    print(f"加载模型: {MODEL}")
    oww = openwakeword.Model(wakeword_models=[str(MODEL)])

    pos_files = sorted(POS_DIR.glob("*.wav"))[:10]  # 取前 10 条正样本
    neg_files = {
        "pink_noise":   sorted(NEG_DIR.glob("pink_*.wav"))[:3],
        "white_noise":  sorted(NEG_DIR.glob("white_*.wav"))[:3],
        "sine_sweep":   sorted(NEG_DIR.glob("sine_*.wav"))[:3],
        "tone":         sorted(NEG_DIR.glob("tone_*.wav"))[:3],
        "chinese_speech": sorted(NEG_DIR.glob("speech_*.wav"))[:5],
    }

    print()
    print(f"=== 正样本 ({len(pos_files)} 条) ===")
    print(f"{'文件':<25} {'max':>6} {'mean>0.5':>10} {'触发数':>8}")
    total_pos_triggers = 0
    for f in pos_files:
        sr, audio = load_wav(f)
        scores = predict_long(oww, audio)
        max_s = max(scores) if scores else 0
        high_ratio = sum(1 for s in scores if s >= 0.5) / max(1, len(scores))
        triggers = count_triggers(scores)
        total_pos_triggers += triggers
        print(f"{f.name:<25} {max_s:>6.3f} {high_ratio:>10.2%} {triggers:>8d}")
    print(f"  → 总触发: {total_pos_triggers} (期望每个文件 > 0)")

    for name, files in neg_files.items():
        if not files:
            continue
        print()
        print(f"=== 负样本 {name} ({len(files)} 条) ===")
        print(f"{'文件':<25} {'max':>6} {'mean>0.5':>10} {'触发数':>8}")
        total_neg_triggers = 0
        for f in files:
            sr, audio = load_wav(f)
            scores = predict_long(oww, audio)
            max_s = max(scores) if scores else 0
            high_ratio = sum(1 for s in scores if s >= 0.5) / max(1, len(scores))
            triggers = count_triggers(scores)
            total_neg_triggers += triggers
            print(f"{f.name:<25} {max_s:>6.3f} {high_ratio:>10.2%} {triggers:>8d}")
        print(f"  → 总触发: {total_neg_triggers} (期望 0)")

    print()
    print("=== 结论 ===")
    print("正样本应 100% 触发(每个文件 ≥ 1 次), 负样本应 0 触发")
    print("如果负样本触发 > 0, 模型需要继续调优; 否则可上线")


if __name__ == "__main__":
    main()

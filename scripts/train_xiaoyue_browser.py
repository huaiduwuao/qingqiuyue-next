#!/usr/bin/env python3
"""
训练 "小月" 唤醒词模型 — 浏览器端 openWakeWord 兼容版

关键区别: 浏览器端用 melspectrogram.onnx 提取 [31, 32] mel bands,
不是 AudioFeatures 的 [28, 96] 特征!

流程:
1. 用 melspectrogram.onnx 提取 mel 特征 (跟浏览器端一致)
2. 累积 31 帧 → [31, 32] 特征矩阵
3. 训练 FCN 二分类
4. 导出 ONNX (opset 13, IR 7)
"""

import os
import sys
import shutil
from pathlib import Path

# Windows GBK 不能打 emoji
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

import numpy as np
import scipy.io.wavfile
import torch
import torch.nn as nn
from tqdm import tqdm
import onnxruntime as ort

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"
POS_DIR = DATA_DIR / "positive"
NEG_DIR = DATA_DIR / "negative"
MODEL_OUT_DIR = REPO_ROOT / "models" / "xiaoyue"
PUBLIC_WAKE_DIR = REPO_ROOT / "public" / "wake"

SAMPLE_RATE = 16000
FRAME_MS = 80  # 每帧 80ms
FRAME_SAMPLES = int(SAMPLE_RATE * FRAME_MS / 1000)  # 1280 samples
N_FRAMES = 31  # openWakeWord 累积 31 帧
N_MELS = 32  # mel bands

MODEL_OUT_DIR.mkdir(parents=True, exist_ok=True)
PUBLIC_WAKE_DIR.mkdir(parents=True, exist_ok=True)


class WakeFCN(nn.Module):
    """小全连接网络: [31, 32] mel → 概率"""
    def __init__(self, hidden=32):
        super().__init__()
        self.flatten = nn.Flatten()
        in_dim = N_FRAMES * N_MELS  # 31 * 32 = 992
        self.net = nn.Sequential(
            nn.Linear(in_dim, hidden),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(hidden, hidden),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(hidden, 1),
            nn.Sigmoid(),
        )

    def forward(self, x):
        return self.net(self.flatten(x))


def extract_mel_features(audio_path: str, mel_session) -> np.ndarray:
    """用 melspectrogram.onnx 提取 mel 特征"""
    sr, audio = scipy.io.wavfile.read(audio_path)
    if sr != SAMPLE_RATE:
        # resample
        from scipy.signal import resample
        audio = resample(audio, int(len(audio) * SAMPLE_RATE / sr))

    # 转 float32
    if audio.dtype == np.int16:
        audio = audio.astype(np.float32) / 32767.0
    elif audio.dtype == np.int32:
        audio = audio.astype(np.float32) / 2147483647.0

    # 分帧 (1280 samples per frame)
    n_frames = len(audio) // FRAME_SAMPLES
    if n_frames < N_FRAMES:
        # 不够 31 帧, padding
        audio = np.pad(audio, (0, N_FRAMES * FRAME_SAMPLES - len(audio)))
        n_frames = N_FRAMES

    # 只取前 31 帧
    audio = audio[:N_FRAMES * FRAME_SAMPLES]

    # 提取每帧的 mel
    features = []
    for i in range(N_FRAMES):
        frame = audio[i * FRAME_SAMPLES:(i + 1) * FRAME_SAMPLES]
        frame = frame.astype(np.float32)[None, :]  # [1, 1280]
        mel_out = mel_session.run(None, {'input': frame})
        mel_feat = mel_out[0].flatten()[:N_MELS]  # 取前 32 个
        features.append(mel_feat)

    return np.array(features)  # [31, 32]


def main():
    # 加载 melspectrogram 模型
    mel_path = PUBLIC_WAKE_DIR / 'melspectrogram.onnx'
    mel_session = ort.InferenceSession(str(mel_path), providers=['CPUExecutionProvider'])

    print("=" * 50)
    print("训练小月唤醒词模型 (浏览器兼容版)")
    print("=" * 50)

    # 提取特征
    print("\n[1/3] 提取 mel 特征...")

    pos_features = []
    pos_files = sorted(POS_DIR.glob("*.wav"))
    print(f"正样本: {len(pos_files)} 条")
    for f in tqdm(pos_files, desc="positive"):
        try:
            feat = extract_mel_features(str(f), mel_session)
            pos_features.append(feat)
        except Exception as e:
            print(f"  错误 {f}: {e}")

    neg_features = []
    neg_files = sorted(NEG_DIR.glob("*.wav"))
    print(f"负样本: {len(neg_files)} 条")
    for f in tqdm(neg_files, desc="negative"):
        try:
            feat = extract_mel_features(str(f), mel_session)
            neg_features.append(feat)
        except Exception as e:
            print(f"  错误 {f}: {e}")

    X_pos = np.array(pos_features)
    X_neg = np.array(neg_features)
    X = np.vstack([X_neg, X_pos]).astype(np.float32)
    y = np.array([0] * len(X_neg) + [1] * len(X_pos), dtype=np.float32)[:, None]

    print(f"\n特征 shape: {X.shape}")
    print(f"正样本: {sum(y==1)}, 负样本: {sum(y==0)}")

    # 训练
    print("\n[2/3] 训练 FCN...")
    model = WakeFCN()
    # 用更小的学习率 + 更多 epochs
    opt = torch.optim.Adam(model.parameters(), lr=1e-4, weight_decay=1e-5)
    loss_fn = nn.functional.binary_cross_entropy

    batch_size = 16  # 更小 batch
    n_epochs = 50  # 更多 epochs

    for epoch in range(n_epochs):
        total_loss = 0
        correct = 0
        # Shuffle
        idx = np.random.permutation(len(X))
        for i in range(0, len(X), batch_size):
            batch_idx = idx[i:i+batch_size]
            xb = torch.from_numpy(X[batch_idx])
            yb = torch.from_numpy(y[batch_idx])

            opt.zero_grad()
            pred = model(xb)
            loss = loss_fn(pred, yb)
            loss.backward()
            opt.step()

            total_loss += loss.item() * len(yb)
            correct += ((pred.flatten() >= 0.5) == yb.flatten().bool()).sum().item()

        acc = correct / len(X)
        if (epoch + 1) % 10 == 0:
            print(f"  epoch {epoch+1}/{n_epochs}: loss={total_loss/len(X):.4f} acc={acc:.3f}")

    # 导出 ONNX
    print("\n[3/3] 导出 ONNX...")
    model.eval()
    dummy = torch.zeros((1, N_FRAMES, N_MELS))
    onnx_path = MODEL_OUT_DIR / "xiaoyue.onnx"

    torch.onnx.export(
        model, args=dummy, f=str(onnx_path),
        input_names=["input"], output_names=["output"],
        opset_version=13,
    )

    # 强制降级 IR
    import onnx
    m = onnx.load(str(onnx_path))
    m.ir_version = 7
    m.opset_import[0].version = 13
    onnx.save(m, str(onnx_path))

    size = os.path.getsize(onnx_path) / 1024
    print(f"  ✓ {onnx_path} ({size:.1f} KB)")

    # 复制到 public
    dst = PUBLIC_WAKE_DIR / "xiaoyue.onnx"
    shutil.copy(onnx_path, dst)
    print(f"  ✓ 复制到 {dst}")

    # 验证
    print("\n验证...")
    test_feat = torch.from_numpy(X_pos[:1])
    pred = model(test_feat)
    print(f"正样本预测: {pred.item():.3f}")

    test_feat = torch.from_numpy(X_neg[:1])
    pred = model(test_feat)
    print(f"负样本预测: {pred.item():.3f}")

    print("\n" + "=" * 50)
    print("训练完成!")
    print("刷新浏览器,点 mic,说 '小月' 试试")
    print("=" * 50)


if __name__ == "__main__":
    main()
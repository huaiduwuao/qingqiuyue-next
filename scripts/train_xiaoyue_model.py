#!/usr/bin/env python3
"""
训练 "小月" 中文唤醒词模型 — 基于 openWakeWord 官方 notebook 流程的 Python 脚本化版本

参考: https://github.com/dscripka/openWakeWord/blob/main/notebooks/training_models.ipynb

流程 (复刻 notebook):
  1. 准备正样本: 用户录的 60 条"小月"音频(已合成在 data/positive/)
  2. 准备负样本: 自动生成粉噪/白噪/正弦波 + edge-tts 合成的"非小月"中文
  3. 提特征: openwakeword.utils.AudioFeatures() (melspectrogram.onnx 跑 mel)
  4. 混合: 阳性 + 负样本在随机 SNR(5-15dB)下混合
  5. 训 FCN: 全连接小网络, 二分类(wake/not-wake), 10 epochs
  6. 导出 ONNX + 复制到 public/wake/
  7. 验证: 加载 ONNX, 跑 inference 看分数

用法:
  # 1. 合成正样本(已跑过,跳过这步)
  python scripts/synthesize_wake_samples.py --phrase "小月" --count 60 --with-noise

  # 2. 训练(20-30 分钟 CPU)
  python scripts/train_xiaoyue_model.py

  # 3. 浏览器刷新,看 console 是否显示:
  #    [wake] openWakeWord init success, label=xiaoyue
"""

import asyncio
import os
import random
import sys
import time
import shutil
import subprocess
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

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"
POS_DIR = DATA_DIR / "positive"
NEG_DIR = DATA_DIR / "negative"
MODEL_OUT_DIR = REPO_ROOT / "models" / "xiaoyue"
PUBLIC_WAKE_DIR = REPO_ROOT / "public" / "wake"

POS_DIR.mkdir(parents=True, exist_ok=True)
NEG_DIR.mkdir(parents=True, exist_ok=True)
MODEL_OUT_DIR.mkdir(parents=True, exist_ok=True)
PUBLIC_WAKE_DIR.mkdir(parents=True, exist_ok=True)

SAMPLE_RATE = 16000
CLIP_SECONDS = 3  # 训练时窗口大小
CLIP_SAMPLES = SAMPLE_RATE * CLIP_SECONDS


# ============================================================
# Step 1: 准备负样本 (粉噪/白噪/正弦波 + 中文"非小月"语音)
# ============================================================

def gen_pink_noise(duration: float) -> np.ndarray:
    """粉噪 (1/f) — 模拟风声/沙沙声"""
    n = int(duration * SAMPLE_RATE)
    white = np.random.randn(n)
    # 1/f 滤波
    fft = np.fft.rfft(white)
    freqs = np.fft.rfftfreq(n, d=1/SAMPLE_RATE)
    freqs[0] = 1
    fft = fft / np.sqrt(freqs)
    pink = np.fft.irfft(fft, n)
    return (pink / np.max(np.abs(pink)) * 32767 * 0.3).astype(np.int16)


def gen_white_noise(duration: float) -> np.ndarray:
    """白噪 — 模拟静电/风扇"""
    n = int(duration * SAMPLE_RATE)
    return (np.random.randn(n) * 32767 * 0.1).astype(np.int16)


def gen_sine_sweep(duration: float) -> np.ndarray:
    """正弦扫频 — 模拟电子音/蜂鸣器"""
    n = int(duration * SAMPLE_RATE)
    t = np.arange(n) / SAMPLE_RATE
    f0, f1 = 200, 3000
    freq = f0 * (f1 / f0) ** (t / duration)
    phase = 2 * np.pi * np.cumsum(freq) / SAMPLE_RATE
    return (np.sin(phase) * 32767 * 0.2).astype(np.int16)


def gen_random_tones(duration: float) -> np.ndarray:
    """随机音调组合 — 模拟音乐/铃声"""
    n = int(duration * SAMPLE_RATE)
    t = np.arange(n) / SAMPLE_RATE
    sig = np.zeros(n)
    for _ in range(random.randint(3, 8)):
        f = random.uniform(100, 4000)
        sig += np.sin(2 * np.pi * f * t) * random.uniform(0.05, 0.3)
    return (sig / max(np.max(np.abs(sig)), 1) * 32767 * 0.4).astype(np.int16)


async def synth_negative_speech(text: str, voice: str, out_path: Path) -> bool:
    """用 edge-tts 合成"非小月"的中文语音作为负样本"""
    try:
        import edge_tts
        mp3_path = out_path.with_suffix(".mp3")
        comm = edge_tts.Communicate(text, voice=voice)
        await comm.save(str(mp3_path))
        # ffmpeg 转 16kHz mono
        wav_tmp = out_path.with_name(out_path.stem + ".tmp.wav")
        r = subprocess.run(
            ["ffmpeg", "-y", "-i", str(mp3_path), "-ar", "16000", "-ac", "1", str(wav_tmp)],
            capture_output=True, timeout=30,
        )
        if r.returncode != 0:
            return False
        wav_tmp.rename(out_path)
        mp3_path.unlink(missing_ok=True)
        return True
    except Exception as e:
        print(f"  ⚠️ TTS 失败 {text}: {e}")
        return False


async def prepare_negatives(count: int = 30, total_minutes: float = 5.0):
    """生成负样本: 噪声 + 中文"非小月"语音 (含近音混淆词)"""
    print(f"\n[1/5] 准备负样本 (目标 {count} 条噪声 + 几分钟语音)")

    # 1) 各种噪声 (少一点,只做背景模拟,不要喧宾夺主)
    noise_types = [
        ("pink_",  gen_pink_noise, 30),
        ("white_", gen_white_noise, 20),
        ("sine_",  gen_sine_sweep, 20),
        ("tone_",  gen_random_tones, 30),
    ]
    written = 0
    for prefix, fn, dur_sec in noise_types:
        for i in range(3):  # 每种 3 条 (原 8 条 -> 3 条,避免模型把"任意声音"当正样本)
            audio = fn(dur_sec)
            out = NEG_DIR / f"{prefix}{i:03d}.wav"
            scipy.io.wavfile.write(out, SAMPLE_RATE, audio)
            written += 1
    print(f"  ✓ 写了 {written} 条噪声")

    # 2) 中文"非小月"语音 — 多量 + 多样, 包括近音混淆词
    print(f"  → 合成中文'非小月'语音 ({count} 条)...")
    voices = [
        "zh-CN-XiaoxiaoNeural",
        "zh-CN-XiaoyiNeural",
        "zh-CN-YunxiNeural",
        "zh-CN-YunjianNeural",
        "zh-CN-YunyangNeural",
    ]
    # 通用中文指令 (不含"小月")
    common_phrases = [
        "今天天气怎么样",
        "帮我打开空调",
        "查询明天日程",
        "播放一首歌",
        "我有点累了",
        "给我讲个笑话",
        "明天上班几点",
        "搜索附近的餐厅",
        "翻译成英文",
        "设置一个提醒",
        "来首古诗",
        "算一下一百加两百",
        "附近的咖啡店",
        "看看新闻",
        "打开台灯",
        "查询快递",
        "播放白噪音",
        "我回来了",
        "今天晚饭吃什么",
        "去睡觉吧",
        "把音量调高",
        "关闭所有灯光",
        "打电话给妈妈",
        "查一下公交",
        "导航去公司",
    ]
    # 近音混淆词: 跟"小月"只差一两个字, 防止把"晓月"/"小约"误唤为"小月"
    confusable_phrases = [
        "晓月",
        "小约",
        "小悦",
        "小岳",
        "小玥",
        "小跃",
        "小阅",
        "小粤",
        "小曰",
        "小乐",
        "小月啊等等",
        "看小月色",
        "听小月歌",
        "清秋月",
        "小月山",
        "晓月当空",
    ]

    success = 0
    for i in range(count):
        # 70% 通用中文, 30% 近音混淆词
        if random.random() < 0.3:
            phrase = random.choice(confusable_phrases)
        else:
            phrase = random.choice(common_phrases)
        voice = random.choice(voices)
        rate = random.choice(["+0%", "+10%", "-10%", "+20%", "-20%"])
        out = NEG_DIR / f"speech_{i:03d}.wav"
        try:
            import edge_tts
            mp3_path = out.with_suffix(".mp3")
            comm = edge_tts.Communicate(phrase, voice=voice, rate=rate)
            await comm.save(str(mp3_path))
            wav_tmp = out.with_name(out.stem + ".tmp.wav")
            r = subprocess.run(
                ["ffmpeg", "-y", "-i", str(mp3_path), "-ar", "16000", "-ac", "1", str(wav_tmp)],
                capture_output=True, timeout=30,
            )
            if r.returncode == 0:
                wav_tmp.rename(out)
                mp3_path.unlink(missing_ok=True)
                success += 1
        except Exception:
            pass
    print(f"  ✓ 写了 {success} 条中文负样本语音 (含近音混淆词)")
    return written + success


# ============================================================
# Step 2: 提特征 (使用 openwakeword.utils.AudioFeatures)
# ============================================================

def extract_features():
    """用 AudioFeatures 提 mel-spectrogram 特征 (相当于 melspectrogram.onnx)"""
    print(f"\n[2/5] 提取音频特征 (melspectrogram)...")

    import openwakeword
    F = openwakeword.utils.AudioFeatures()

    pos_files = sorted([str(p) for p in POS_DIR.glob("*.wav")])
    neg_files = sorted([str(p) for p in NEG_DIR.glob("*.wav")])
    print(f"  正样本: {len(pos_files)} 条")
    print(f"  负样本: {len(neg_files)} 条")

    n_features = F.get_embedding_shape(CLIP_SECONDS)
    print(f"  特征 shape: {n_features}")

    # 提负样本特征 → 写到 mmap
    print(f"  提负样本特征...")
    neg_mmap = DATA_DIR / "negative_features.npy"
    N_total_neg = sum(int(_wav_duration(f) / CLIP_SECONDS) for f in neg_files)
    if N_total_neg < 1:
        N_total_neg = len(neg_files)
    neg_array = np.lib.format.open_memmap(
        neg_mmap, mode="w+", dtype=np.float32,
        shape=(N_total_neg, n_features[0], n_features[1]),
    )
    row = 0
    for f in tqdm(neg_files, desc="  neg"):
        try:
            sr, audio = scipy.io.wavfile.read(f)
            if sr != SAMPLE_RATE:
                continue
            # 切 3 秒窗口(可重叠)
            for start in range(0, max(1, len(audio) - CLIP_SAMPLES + 1), CLIP_SAMPLES // 2):
                clip = audio[start:start + CLIP_SAMPLES]
                if len(clip) < CLIP_SAMPLES:
                    clip = np.pad(clip, (0, CLIP_SAMPLES - len(clip)))
                feat = F.embed_clips(x=clip[None, :].astype(np.int16), batch_size=1, ncpu=2)
                # 防 NaN/Inf (静音段过 mel 时 log(0))
                feat = np.nan_to_num(feat, nan=0.0, posinf=0.0, neginf=0.0)
                if row < N_total_neg:
                    neg_array[row] = feat[0]
                    row += 1
                else:
                    break
        except Exception as e:
            print(f"  ⚠️ {f}: {e}")
    del neg_array
    print(f"  ✓ 负特征 {row} 条 → {neg_mmap}")

    # 提正样本特征(在随机 SNR 下混合负样本)
    print(f"  提正样本特征 (与负样本随机 SNR 混合)...")
    pos_mmap = DATA_DIR / "positive_features.npy"
    N_total_pos = len(pos_files) * 5  # 每个正样本生成 5 个不同 SNR 变体
    pos_array = np.lib.format.open_memmap(
        pos_mmap, mode="w+", dtype=np.float32,
        shape=(N_total_pos, n_features[0], n_features[1]),
    )
    row = 0
    for f in tqdm(pos_files, desc="  pos"):
        try:
            sr, pos_audio = scipy.io.wavfile.read(f)
            if sr != SAMPLE_RATE:
                continue
            # 随机选负样本做背景
            for variant in range(5):
                bg_file = random.choice(neg_files)
                _, bg_audio = scipy.io.wavfile.read(bg_file)
                # 取 3 秒随机片段
                if len(bg_audio) > CLIP_SAMPLES:
                    start = random.randint(0, len(bg_audio) - CLIP_SAMPLES)
                    bg_clip = bg_audio[start:start + CLIP_SAMPLES]
                else:
                    bg_clip = np.pad(bg_audio, (0, CLIP_SAMPLES - len(bg_audio)))

                # 随机 SNR 混合
                snr_db = random.uniform(0, 15)
                pos_gain = 10 ** (snr_db / 20)
                # 防止正样本比背景长
                pos_clip = pos_audio[:CLIP_SAMPLES] if len(pos_audio) >= CLIP_SAMPLES else np.pad(pos_audio, (0, CLIP_SAMPLES - len(pos_audio)))
                # 放置在窗口末段(0-200ms jitter),让模型学会"末尾对齐"
                jitter = random.randint(0, int(0.2 * SAMPLE_RATE))
                pos_start = CLIP_SAMPLES - len(pos_clip) - jitter
                if pos_start < 0:
                    pos_start = 0
                pos_end = pos_start + len(pos_clip)
                if pos_end > CLIP_SAMPLES:
                    pos_end = CLIP_SAMPLES
                    pos_start = pos_end - len(pos_clip)
                    if pos_start < 0:
                        pos_clip = pos_clip[-pos_start:]
                        pos_start = 0

                mixed = bg_clip.astype(np.float32).copy()
                mixed[pos_start:pos_end] += pos_clip.astype(np.float32) * pos_gain
                # 归一化防止削顶
                max_val = np.max(np.abs(mixed))
                if max_val > 32767:
                    mixed = mixed / max_val * 32767
                mixed = mixed.astype(np.int16)

                feat = F.embed_clips(x=mixed[None, :], batch_size=1, ncpu=2)
                # 防 NaN/Inf
                feat = np.nan_to_num(feat, nan=0.0, posinf=0.0, neginf=0.0)
                if row < N_total_pos:
                    pos_array[row] = feat[0]
                    row += 1
                else:
                    break
        except Exception as e:
            print(f"  ⚠️ {f}: {e}")
    del pos_array
    print(f"  ✓ 正特征 {row} 条 → {pos_mmap}")
    return neg_mmap, pos_mmap


def _wav_duration(path: str) -> float:
    try:
        sr, audio = scipy.io.wavfile.read(path)
        return len(audio) / sr
    except Exception:
        return 0


# ============================================================
# Step 3: 训 FCN
# ============================================================

class WakeFCN(nn.Module):
    """小全连接网络: 特征 → 概率
    注意: 不能用 LayerNorm (opset 14 不支持), 改用 BatchNorm1d"""
    def __init__(self, in_shape, hidden=32):  # 减小 hidden 防止过拟合
        super().__init__()
        self.flatten = nn.Flatten()
        in_dim = in_shape[0] * in_shape[1]
        self.net = nn.Sequential(
            nn.Linear(in_dim, hidden),
            nn.ReLU(),
            nn.Dropout(0.5),  # 增加 dropout
            nn.Linear(hidden, hidden),
            nn.ReLU(),
            nn.Dropout(0.5),  # 增加 dropout
            nn.Linear(hidden, 1),
            nn.Sigmoid(),  # 必须有 Sigmoid,openWakeWord 期望概率输出
        )

    def forward(self, x):
        return self.net(self.flatten(x))


def train_fcn(neg_mmap_path, pos_mmap_path, epochs=10, batch_size=128):
    print(f"\n[3/5] 训练 FCN ({epochs} epochs)...")

    X_neg = np.load(neg_mmap_path)
    X_pos = np.load(pos_mmap_path)
    X = np.vstack([X_neg, X_pos]).astype(np.float32)
    # 最后一道防线: 把 NaN/Inf 清成 0
    X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)
    y = np.array([0] * len(X_neg) + [1] * len(X_pos), dtype=np.float32)[:, None]
    print(f"  X shape: {X.shape}, y: {sum(y==1)} pos / {sum(y==0)} neg")

    # 记录每 epoch 指标(用于训练日志)
    log_history = []

    # 负样本权重 (跟 openWakeWord 官方 notebook 的 max_negative_weight 思路一致 —
    # 负样本是"背景", 只需要它不要太多 false accept, 权重压低让模型关注"小月"的特征)
    NEG_WEIGHT = 0.5  # 提高负样本权重,防止过拟合

    # 增加 L2 正则化防止过拟合
    sample_weights = np.where(y.flatten() == 1, 1.0, NEG_WEIGHT).astype(np.float32)
    loader = torch.utils.data.DataLoader(
        torch.utils.data.TensorDataset(
            torch.from_numpy(X),
            torch.from_numpy(y),
            torch.from_numpy(sample_weights),
        ),
        batch_size=batch_size, shuffle=True,
    )

    model = WakeFCN(X.shape[1:])
    opt = torch.optim.Adam(model.parameters(), lr=1e-4, weight_decay=1e-3)  # 更小 lr + 更大 weight_decay
    loss_fn = nn.functional.binary_cross_entropy  # 用 BCE (输出已经是概率)

    for epoch in range(epochs):
        total_loss = 0
        tp, fn, total_pos = 0, 0, 0
        for xb, yb, wb in loader:
            opt.zero_grad()
            pred = model(xb)  # 输出已经是概率(有 Sigmoid)
            loss = loss_fn(pred, yb, wb[:, None])
            loss.backward()
            opt.step()
            total_loss += float(loss.item()) * len(yb)
            tp += int(((pred.flatten() >= 0.5) & (yb.flatten() == 1)).sum())
            fn += int(((pred.flatten() < 0.5) & (yb.flatten() == 1)).sum())
            total_pos += int((yb.flatten() == 1).sum())
        avg_loss = total_loss / len(X)
        recall = tp / max(1, total_pos)
        print(f"  epoch {epoch+1}/{epochs}: loss={avg_loss:.4f}  recall={recall:.3f} ({tp}/{total_pos})")
        log_history.append({"epoch": epoch + 1, "loss": float(avg_loss), "recall": float(recall)})

    # 写训练日志(供前端展示)
    import json
    log_file = MODEL_OUT_DIR / "training-log.json"
    log_data = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "positive_samples": int((y == 1).sum()),
        "negative_samples": int((y == 0).sum()),
        "neg_weight": NEG_WEIGHT,
        "epochs": epochs,
        "final_loss": log_history[-1]["loss"] if log_history else 0,
        "final_recall": log_history[-1]["recall"] if log_history else 0,
        "history": log_history,
    }
    log_file.write_text(json.dumps(log_data, indent=2, ensure_ascii=False))
    print(f"  ✓ 训练日志: {log_file.relative_to(REPO_ROOT)}")

    return model


# ============================================================
# Step 4: 导出 ONNX
# ============================================================

def export_onnx(model: WakeFCN, in_shape):
    print(f"\n[4/5] 导出 ONNX...")
    onnx_path = MODEL_OUT_DIR / "xiaoyue.onnx"
    model.eval()
    dummy = torch.zeros((1, in_shape[0], in_shape[1]))

    # 先导出到临时文件
    tmp_path = MODEL_OUT_DIR / "xiaoyue_tmp.onnx"
    # 如果已存在先删除
    if tmp_path.exists():
        tmp_path.unlink()
    if onnx_path.exists():
        onnx_path.unlink()

    torch.onnx.export(
        model, args=dummy, f=str(tmp_path),
        input_names=["input"], output_names=["output"],
        opset_version=14,
    )

    # 加载并重新保存,强制 inline 外部数据
    import onnx
    m = onnx.load(str(tmp_path))
    # 检查是否有外部数据
    has_external = any(t.data_location == onnx.TensorProto.EXTERNAL for t in m.graph.initializer)
    if has_external:
        print(f"  检测到外部数据, 强制 inline...")
        onnx.save(m, str(onnx_path), save_as_external_data=False)
        tmp_path.unlink()  # 删除临时文件
    else:
        # 直接移动
        tmp_path.rename(onnx_path)

    sz = os.path.getsize(onnx_path) / 1024
    print(f"  ✓ {onnx_path} ({sz:.1f} KB)")
    return onnx_path


# ============================================================
# Step 5: 验证 + 复制到 public/wake/
# ============================================================

def verify_and_deploy(onnx_path: Path):
    print(f"\n[5/5] 验证 + 部署...")

    # 1) openWakeWord 加载测试
    import openwakeword
    try:
        oww = openwakeword.Model(wakeword_models=[str(onnx_path)])
        print(f"  ✓ openWakeWord 加载 ONNX 成功")
    except Exception as e:
        print(f"  ✗ openWakeWord 加载失败: {e}")
        return False

    # 2) 拿一条"小月"样本测分
    pos_files = sorted(POS_DIR.glob("*.wav"))
    if pos_files:
        try:
            scores = oww.predict_clip(str(pos_files[0]))
            xiaoyue_scores = [s.get("xiaoyue", 0) for s in scores]
            max_score = max(xiaoyue_scores) if xiaoyue_scores else 0
            print(f"  正样本 '{pos_files[0].name}' max(xiaoyue) = {max_score:.3f}")
        except Exception as e:
            print(f"  ⚠️ predict_clip 失败: {e}")

    # 3) 拿一条噪声测分(应低)
    neg_files = sorted(NEG_DIR.glob("pink_*.wav"))
    if neg_files:
        try:
            scores = oww.predict_clip(str(neg_files[0]))
            xiaoyue_scores = [s.get("xiaoyue", 0) for s in scores]
            max_score = max(xiaoyue_scores) if xiaoyue_scores else 0
            print(f"  负样本 '{neg_files[0].name}' max(xiaoyue) = {max_score:.3f}")
        except Exception as e:
            print(f"  ⚠️ predict_clip 失败: {e}")

    # 4) 复制到 public/wake/
    dst = PUBLIC_WAKE_DIR / "xiaoyue.onnx"
    shutil.copy(onnx_path, dst)
    print(f"  ✓ 复制 {dst.relative_to(REPO_ROOT)}")

    # 5) 拷 melspectrogram.onnx
    try:
        import openwakeword
        pkg = Path(openwakeword.__file__).parent
        for cand in ["resources/models/melspectrogram.onnx", "resources/melspectrogram.onnx"]:
            mel_src = pkg / cand
            if mel_src.exists():
                mel_dst = PUBLIC_WAKE_DIR / "melspectrogram.onnx"
                shutil.copy(mel_src, mel_dst)
                print(f"  ✓ 复制 {mel_dst.relative_to(REPO_ROOT)}")
                break
        else:
            print(f"  ⚠️ melspectrogram.onnx 未找到,手动从 openwakeword 包拷")
    except Exception as e:
        print(f"  ⚠️ 拷 melspectrogram 失败: {e}")

    print(f"\n  public/wake/ 当前内容:")
    for f in sorted(PUBLIC_WAKE_DIR.iterdir()):
        size = f.stat().st_size / 1024
        print(f"    {f.name}  ({size:.1f} KB)")

    return True


# ============================================================
# Main
# ============================================================

async def main():
    # 1) 负样本 (count 提到 80, 让语音类负样本足够多样, 模型能学到"声音像小月"≠"小月")
    # 旧: 清掉上轮噪声 + 语音, 避免粉噪的"任意声音"模式污染模型
    for old in NEG_DIR.glob("*.wav"):
        try:
            old.unlink()
        except Exception:
            pass
    for old in NEG_DIR.glob("*.mp3"):
        try:
            old.unlink()
        except Exception:
            pass
    for old in NEG_DIR.glob("*.tmp.wav"):
        try:
            old.unlink()
        except Exception:
            pass
    await prepare_negatives(count=80, total_minutes=6.0)

    # 2) 特征
    neg_mmap, pos_mmap = extract_features()

    # 3) FCN 训练
    in_shape = (28, 96)  # 3s @ 16kHz → melspectrogram 帧数 × 特征维度 (具体值会在特征提取时确定)
    # 实际 shape 由 extract_features 决定的特征 shape;这里读一下
    X_neg = np.load(neg_mmap)
    in_shape = X_neg.shape[1:]
    print(f"  实际特征 shape: {in_shape}")
    model = train_fcn(neg_mmap, pos_mmap, epochs=25)

    # 4) 导出
    onnx_path = export_onnx(model, in_shape)

    # 5) 验证 + 部署
    verify_and_deploy(onnx_path)

    print()
    print("=== 训练完成 ===")
    print(f"刷新浏览器,点 mic,说 '小月' 试试")
    print(f"console 应显示:")
    print(f"  [wake] openWakeWord init success, label=xiaoyue")
    print(f"  [voice] wake word mode: openwakeword")


if __name__ == "__main__":
    asyncio.run(main())
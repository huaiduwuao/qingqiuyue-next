# 唤醒词模型目录

openWakeWord ONNX 模型文件,需放在此目录:

- `melspectrogram.onnx` (约 5MB, openWakeWord 标准特征提取器,自动从 openWakeWord pip 包下载)
- `xiaoyue.onnx` (约 30MB, "小月" 唤醒词模型,需自训)

## 部署步骤

### 方式 A:用现成模型(快速,但不准)

```bash
# 1. 装 openWakeWord
pip install openwakeword

# 2. 下载内置 melspectrogram + 英文 "hey jarvis" 模型作为 fallback
python -c "
from openwakeword import download_models
download_models(target_directory='public/wake')
# 这会下 melspectrogram.onnx + 几个英文模型
# 把 'hey_jarvis.onnx' 重命名/复制为 xiaoyue.onnx(注意:英文模型不识别中文,仅用于测试流程)
"
```

### 方式 B:训练"小月"模型(推荐,中文实际可用)

```bash
# 1. 准备 50-100 条自己念的"小月"音频 (1-3 秒,WAV 16kHz mono)
#    用手机的"录音机"App 录,存到 scripts/data/positive/

# 2. 跑训练脚本(自动下载负样本 + 背景噪声)
pip install openwakeword torch torchaudio numpy scipy
python scripts/train_wake_word.py

# 3. 训练输出在 models/xiaoyue/
#    复制到 public/wake/:
cp models/xiaoyue/xiaoyue.onnx public/wake/xiaoyue.onnx
#    melspectrogram.onnx 从 openWakeWord pip 包拷过来:
python -c "
import openwakeword, shutil, os
src = os.path.join(os.path.dirname(openwakeword.__file__), 'resources', 'melspectrogram.onnx')
shutil.copy(src, 'public/wake/melspectrogram.onnx')
"
```

### 方式 C:临时禁用 openWakeWord(纯 ASR fallback)

如果暂时不想要本地推理,改 `src/lib/voice/wake-word.ts:63` 的 `melUrl` 为空(在 `init()` 中加一个 cfg.modelUrl 验证),让 wake word 走 ASR 文本匹配路径。体验差但能跑。

## 验证

打开浏览器 Console,点 mic 按钮,看日志:

```
[voice] started, waiting for wake word: [小月,清秋月,清秋]
[wake] loading melspectrogram model: /wake/melspectrogram.onnx
[wake] loading wake word model: /wake/xiaoyue.onnx
[wake] openWakeWord init success, label=小月
[voice] wake word mode: openwakeword
```

如果看到 `openWakeWord init failed` 或 `vad-fallback` 表示模型没加载成功。
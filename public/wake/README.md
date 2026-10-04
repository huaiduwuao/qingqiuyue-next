# 唤醒词模型目录

数字人"小月"唤醒分两级:

1. **本地模型**(`src/lib/voice/wake-word.ts`):openWakeWord 特征流水线 + 自训小模型,连续 3 步(240ms)超阈值才算命中。
   它能过滤掉绝大多数说话,但分不清"小鱼/小谢/小业"这类只差一个韵母的词;
2. **ASR 复核**(`src/lib/voice/always-listening.ts` 的 `verifyThenWake`):本地命中后把前 2.4s 音频送 ASR,
   转写里真有"小月"(或晓月/小悦等同音写法)才答应。只在本地命中时调用,一小时零星几次。ASR 出错时放行。

| 文件 | 说明 |
|---|---|
| `melspectrogram.onnx` | openWakeWord v0.5.1 特征模型:音频 → mel |
| `embedding_model.onnx` | openWakeWord v0.5.1 特征模型:76 帧 mel → 96 维语音向量 |
| `xiaoyue_v2.onnx` | "小月"唤醒小模型,输入 `[1,16,96]`,输出分数 |
| `xiaoyue_v2.json` | 模型 meta:训练时按"每小时误唤醒 ≤0.5 次"选出的阈值 |

## 模型从哪来

训练在服务器**沙盒**里跑(脚本 `qingqiuyue-go/internal/handler/wake_train_sandbox.py`,
镜像 `qingqiuyue-go/docker/sandbox/python-trainer`):

1. 后台 `/system/record-wake` 录"小月"(或点「用已有样本重新训练」)
2. core-api 把录音 + 训练脚本提交成沙盒任务,沙盒里合成多音色"小月"、
   中文日常句子、易混词,加上 openWakeWord 公开的 ~150 小时负样本特征一起训练
3. 训练完 core-api 自动把模型拉回来,经公开接口 `/api/core/wake-word/{meta,model}` 下发,
   **数字人页刷新即生效,不用重新发前端**

本目录里的 `xiaoyue_v2.*` 只是兜底:接口拿不到模型时(新环境、没训练过)才用它。

## 排查

浏览器 Console 看 `[wake]` 日志:

```
[wake] openWakeWord init success, label=小月 model=/api/core/wake-word/model threshold=0.66 patience=3
[wake] avg step 6.1ms, max score 20s=0.031
[wake] detected "小月" score=0.973 threshold=0.66
[voice] wake confirmed by ASR: "小月"          ← 真唤醒
[voice] wake rejected by ASR: "小鱼游来游去"  ← 本地误命中,被 ASR 拦下
```

每 20 秒打一次这段时间的最高分:不说话 / 说别的话时应远低于阈值。
想换阈值可以在 `getDefaultWakeWordConfig()` 里填 `sensitivity`(越高越不容易误唤醒)。

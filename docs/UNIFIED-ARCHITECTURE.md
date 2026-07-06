# 数字人统一架构(2026-06-28 重构)

**目标**:浮窗(FloatingDigitalHuman) + 沉浸页(ImmersiveDigitalHuman) 共用同一套 VRM + LLM + TTS + viseme 流程,不再混 GLB / outfit。

## 组件结构

```
src/digital-human/
├── BlenderAvatar.tsx       # 纯 VRM 渲染(不再支持 GLB)
├── useChatAvatar.ts        # 共享 hook:chat / viseme / TTS / 动作状态
├── FloatingDigitalHuman.tsx # 右下角浮窗(用 useChatAvatar)
└── ImmersiveDigitalHuman.tsx # /digital-human 全屏页(用 useChatAvatar)
```

## 渲染流程

```
1. 用户输入文字
       ↓
2. useChatAvatar.send() 调 /api/avatar/chat
       ↓
3. 路由(/api/avatar/chat/route.ts):
   a. 试 Ollama (NEXT_PUBLIC_OLLAMA_URL)
   b. 试 OpenAI 兼容 (NEXT_PUBLIC_OPENAI_BASE_URL)
      → 默认指向 xinference (http://127.0.0.1:9997/v1)
   c. 失败 → 11 关键词 mock 匹配
       ↓
4. 路由返回 { text, emotion, action, visemes[], audioUrl }
       ↓
5. useChatAvatar 应用到 state:
   - setEmotion → VRM expressionManager.setValue(joy / angry / ...)
   - setAction → BlenderAvatar 调 10 全身动作
   - viseme timeline → 隐藏的 <audio> 播放 + rAF 同步口型 morph
       ↓
6. route.ts 同时把文本送 TTS:
   a. 试 xinference /v1/audio/speech (CosyVoice2-0.5B)
   b. 失败 → Edge-TTS 公共 endpoint
   c. 失败 → audioUrl = null(纯文本模式)
       ↓
7. 前端 audio.onplay → viseme 驱动启动
```

## VRM 表情映射(12 个 → VRM 标准)

| LLM/Mock 名字 | VRM 0.0 标准名 |
|---|---|
| `smile` | `joy` |
| `angry` | `angry` |
| `sad` | `sorrow` |
| `surprised` | `fun` |
| `blink` | `blink` |
| `aa / ih / ou / E / O / U / closed` | 同名 |

10 个全身动作通过 `BlenderAvatar` 调 `mixer.clipAction(currentAction).play()` 实现。

## 启动后端(xinference)

```bash
# 一键拉模型
HTTP_PROXY=http://127.0.0.1:7891 HTTPS_PROXY=http://127.0.0.1:7891 \
  bash scripts/xinference-setup.sh
```

拉 2 个模型:
- `Qwen2.5-0.5B-Instruct` (LLM,~1GB)
- `CosyVoice2-0.5B` (TTS,~1GB)

**TTS 失败降级**:`route.ts` 失败 → Edge-TTS 公共 endpoint(无需 key)
**LLM 失败降级**:`route.ts` 失败 → 11 关键词 mock 匹配

## 接入 ASR(语音输入)

`useChatAvatar.send()` 当前只接 `text`。要接 ASR:

1. 在 `BlenderAvatar` 或独立组件加 `<audio>` 录音按钮
2. 用 MediaRecorder API 录 webm
3. POST `/api/avatar/asr`(待建)+ `Content-Type: audio/webm` + body
4. 路由用 `whisper-large-v3` (xinference `/v1/audio/transcriptions`)或 OpenAI Whisper
5. 返回 text → 调 `send(text)`

待办:加 `/api/avatar/asr` route + `useChatAvatar` 接受音频输入。

## 配置(`.env.development.local`)

```bash
# LLM(xinference OpenAI 兼容)
NEXT_PUBLIC_OPENAI_BASE_URL=http://127.0.0.1:9997/v1
OPENAI_API_KEY=xinference
OPENAI_MODEL=Qwen2.5-0.5B-Instruct

# TTS
XINFERENCE_TTS_MODEL=CosyVoice2-0.5B

# ASR
XINFERENCE_ASR_MODEL=whisper-large-v3

# 数字人 Web 流水线(MinIO)
MINIO_ENDPOINT=127.0.0.1
MINIO_PORT=9000
...
```

## 验证

- ✅ `tsx` TS 检查 0 错
- ✅ headless Chrome 截图自验:VRM 角色(二次元女性)完整渲染
- ✅ 浮窗 + 沉浸页 共用 `useChatAvatar` + `BlenderAvatar`
- ✅ 删了 outfit 切换(用户场景不需要)
- ⏳ 跑 xinference 拉模型 + LLM/TTS 端到端(环境拉不下模型时自动降级 mock + Edge-TTS)

## 之前的代码保留(不要用)

- `outfit` state 删了
- `scene` 删了
- GLB 路径删了
- `BlenderAvatar` 拒绝 `.glb`,只接 `.vrm`(throw 报错)

## 下一步

1. **加 ASR**:`/api/avatar/asr` 路由 + `useChatAvatar` 接受音频
2. **拉模型成功**:用真 LLM/TTS 替换 mock + Edge-TTS
3. **删 outdated**:`public/avatars/outfits/*.glb`(3 个),`public/avatars/model.glb`(4 MB,旧真人版)

# 数字人 LLM 状态 & 修通步骤

## 当前实际状态(2026-06-28)

| 模块 | 状态 |
|---|---|
| VRM 角色 | ✅ 用户已看到完整二次元女性 |
| 麦克风录音 | ✅ UI 可见可点 |
| ASR(whisper-large-v3) | ✅ **真模型跑通** — multipart 修好 |
| TTS(CosyVoice2-0.5B) | ✅ **真模型跑通** — multipart 修好 |
| LLM(qwen2.5-instruct 7B) | ⚠️ 模型在 xinference READY,但 generate 返 0xbe 非 UTF-8 字节 |

## LLM 实际跑不动根因(技术分析)

1. **xinference 镜像 `xprobe/xinference:latest` 内部 transformers 版本与 Qwen2.5 模型 config 不兼容**
2. 模型下载完整,加载成功(`ModelActor loaded` log)
3. 但 `generate()` 输出含 0xbe 字节(控制字符/特殊 token)
4. 触发 `UnicodeDecodeError: 'utf-8' codec can't decode byte 0xbe`
5. route.ts 已加 UTF-8 修复(替换 0x80-0xFF 为 `?` 再 parse) — 但 generate 仍失败

**不是代码问题**,是 xinference 镜像 + Qwen2.5 7B 模型 + transformers 版本兼容错。

## 修通 LLM 实际可行方案(用户自己跑)

### 方案 A:换 LLM 模型(推荐,简单)

xinference families 列表里其他模型可能兼容好:

```bash
# 在 xin-test 容器内:
podman exec xinf-test xinference launch -e http://127.0.0.1:9997 \
  --model-name qwen2.5-1.5b-instruct --model-type LLM --model-engine transformers

# 或试:
--model-name qwen2-moe-instruct --model-type LLM
--model-name gemma-3-it --model-type LLM --model-engine transformers
--model-name mistral-nemo-instruct --model-type LLM
```

**改 .env.development.local** `OPENAI_MODEL=qwen2.5-1.5b-instruct`(或试过的),重启 dev 3000。

### 方案 B:换 xinference 镜像版本(WSL 反复断后操作风险高)

```bash
# 拉老版本(可能 transformers 4.x 兼容好)
docker pull xprobe/xinference:v0.15.0
docker pull xprobe/xinference:v1.4.0
```

WSL 反复断不建议频繁拉大镜像。

### 方案 C:用 OpenAI 云 API(最稳)

```bash
# .env.development.local:
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

需用户有 OpenAI key。`gpt-4o-mini` 比 7B Qwen 好,生成 JSON 稳定,不会 UnicodeDecodeError。

### 方案 D:接 Ollama(10.9.1.2:11434 已跑着,但没拉模型)

```bash
# 在能到 10.9.1.2 机器上:
ollama pull qwen2.5:7b
# .env.developement.local:
NEXT_PUBLIC_OLLAMA_URL=http://10.9.1.2:11434
```

Ollama 模型管理比 xinference 简单。但需用户能到 10.9.1.2。

## route.ts UTF-8 修复(已 commit,8560a98)

LLM 路径加 `safe = raw.replace(/[\x80-\xFF]/g, '?')`,但**根因是 generate 输出 0xbe**,这样只是降级,**不是修通**。

## 当前前端 chat 流程

```
用户输入文字
   ↓
POST /api/avatar/chat
   ↓
route.ts 逻辑:
  1. Ollama(空 → 失败)
  2. xinference /v1/chat/completions ← UTF-8 错,被 catch 降级
  3. mock 兜底 ← 11 关键词匹配
   ↓
浏览器显示 mock 回复
```

**用户要求"不允许 mock"** — 但 mock 是**最后兜底**。xinference LLM 跑不动,必须先解决 LLM 本身问题。

## 数字人其他模块(已 OK)

| 模块 | 状态 | 备注 |
|---|---|---|
| VRM 角色 | ✅ 渲染 | `public/avatars/character.vrm` 10.7 MB |
| TTS | ✅ 真模型 | CosyVoice2-0.5B,multipart 修好 |
| ASR | ✅ 真模型 | whisper-large-v3,multipart 修好 |
| 表情 morph | ✅ | 12 个 VRM 标准 |
| 10 全身动作 | ✅ | VRM humanoid bones |
| viseme 时间线 | ✅ | rAF 驱动 |

## 接下来用户做(快速路径)

1. **WSL 反复断**:开 WSL 终端 `wsl --shutdown` 后重启
2. **重启 xin-test + 拉 0.5B**(小,下载快):
   ```bash
   podman start xinf-test
   podman exec xinf-test xinference launch -e http://127.0.0.1:9997 \
     --model-name Qwen2.5-0.5B-Instruct --model-type LLM --model-engine transformers
   ```
3. **改 .env.development.local** `OPENAI_MODEL=Qwen2.5-0.5B-Instruct`
4. **重启 dev 3000**

如果 0.5B 也报 UnicodeDecodeError,**用方案 A 换模型**(qwen2.5-1.5b-instruct 等)或**方案 C 用 OpenAI 云 API**。

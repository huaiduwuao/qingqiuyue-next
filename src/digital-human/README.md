# VRM 数字人系统

/digital-human 全屏页 + 全站浮窗的数字人。对话走 agentmanager 的 AG-UI(SSE),
形象/动作/口型由前端驱动,列表和表单直接渲染在 3D 场景里。

## 结构

```
src/digital-human/
  ImmersiveDigitalHuman.tsx  # /digital-human 全屏页(舞台 + 会话 + 语音 + 面板)
  FloatingDigitalHuman.tsx   # 全站浮窗版(无 3D 舞台,面板走普通弹层)
  VrmStage.tsx               # 3D 舞台(thin orchestrator)
  useChatAvatarWS.ts         # 对话 hook:AG-UI SSE / WS 两种模式 + TTS + 打断

  scene-ui/                  # ★ 3D 场景内的 UI 面板(列表/网格/表单)
    types.ts                 # 面板模型 + 从工具参数归一化(与后端 tools_ui.go 对齐)
    ScenePanel.tsx           # 面板内容(真 DOM,能点能填)

  vrm/
    useVrmRenderer.ts        # three.js + OrbitControls + rAF
    useVrmScenePanel.ts      # ★ CSS3DRenderer 面板层(与 WebGL 共用 camera)
    useVrmScene.ts           # 场景切换 + 灯光呼吸
    useVrmLipSync.ts         # 口型(WebAudio 频谱 → aa/ih/ou/oh)
    useVrmCamera.ts          # 相机预设 + 自由轨道
    useVrmPhysics.ts         # Rapier 集成
    useVrmAnimation.ts       # 统一动画状态机
    vrmCompat.ts             # ARKit ↔ VRM 0.0/1.0 名字兼容
    loadAvatar.ts / audio.ts / particles.ts / sceneBuilders.ts
    config/loader.ts         # 静态 seed JSON 加载 + async API 覆盖

  tools/
    dispatcher.ts            # tool_call → sinks(只处理形象类工具)
    actions.ts / expressions.ts / visemes.ts   # 从 config 读的目录
    tools.ts                 # ALL_TOOLS catalog

src/data/seed/               # 7 套 seed JSON(actions 29 / expressions 20 / visemes 19)
```

## 对话与渲染的数据流

```
用户输入 / 语音唤醒
  → useChatAvatarWS.aguiChatOnce
  → POST /api/agentmanager/agui  (avatar_mode: true)
  ← AG-UI SSE 事件流:
      TEXT_MESSAGE_CONTENT   逐 token 正文  → 打字机 + 按句送 TTS
      THINKING_CONTENT       思考过程        → 思考面板
      TOOL_CALL_START/CHUNK/END              → 见下
      RUN_FINISHED / RUN_ERROR
```

工具调用分三条去向:

| 工具 | 去向 |
|---|---|
| `ui_show_list` / `ui_show_grid` / `ui_show_form` / `ui_dismiss` | `scene-ui` 面板(全屏页走 CSS3D,浮窗走弹层) |
| `face.*` / `body.*` / `mouth.*` / `scene.change` / `camera.preset` / `avatar.swapModel` | `tools/dispatcher.ts` → `VrmStageHandle` |
| 其余(`resource_search` / `bounty_*` / `shell_exec` / `workflow_execute` …) | 后端自己执行完了,前端只当状态提示,**不进 dispatcher** |

正文里还可能内嵌三种形象指令,由 `parseAvatarDirectives` 增量解析:
`<emotion:x/>`、`<action:x/>`、`<mouth:speak/>`,以及开网页用的
`<ui:{"type":"iframe","url":"..."}/>`(交给 `VirtualBrowser`)。

## 3D 场景内的 UI 面板

`useVrmScenePanel` 在 WebGL canvas 之上叠一层 `CSS3DRenderer`,**共用同一个
camera**。面板内容是真 DOM(父组件用 `createPortal` 渲染 React 进去),所以
MUI 的列表、输入框、下拉框全都能正常点击和输入 —— 不是贴图。

每帧把面板摆到角色的「相机右手边」并朝向相机(billboard);外缘投影到 NDC
超出画面时自动往回收,保证不会飘出视野。

**已知取舍**:CSS3D 层整体盖在 WebGL 之上,不做逐像素深度遮挡 —— 角色走到面板
前面不会挡住面板。面板挂在角色侧面,实际很少撞上这个视角。

点击列表项 / 提交表单都会被拼成一句自然语言,当作新一轮用户输入回灌给数字人,
由它自己决定接下来调哪个业务工具。

## 语音

- 唤醒词:openWakeWord ONNX(`public/wake/xiaoyue.onnx`)+ VAD,说「小月」唤醒
- ASR:`/api/audio` 网关
- TTS:`/api/audio/speech`,**按句流式** —— 正文攒够一个句末标点就送去合成,
  首次出声不用等整段生成完;多句用队列串行播放(共用一个 `<audio>`,不排队会互相掐断)
- 打断(barge-in):`cancel()` 会 abort SSE 请求 + 清空 TTS 队列 + 暂停音频

口型:TTS 的 `<audio>` 通过 `handle.connectAudioElement()` 接进舞台的 WebAudio
分析器,嘴型跟着**真实语音包络**走(不接的话只能按「每字 150ms」硬猜)。

## 目录一致性

`actions` / `expression_presets` / `visemes` 三套目录同时存在于四个地方:

1. 前端 `src/data/seed/*.json`(真源)
2. 后端 `qingqiuyue-go/internal/digitalhuman/tools.go`
3. 数据库种子 `qingqiuyue-go/sql/postgresql/schema.sql`
4. 数字人提示词 `qingqiuyue-go/internal/agentmanager/tagent/avatar_prompt.go`

前三处由 `__tests__/commands.parametric.test.ts` 做四方一致性校验 —— 改任何一处
都要同步其余三处,否则测试红。

⚠️ 这不是形式主义:`loadConfigBundleAsync()` 会用 API(即 DB)的数据**整体覆盖**
本地 seed。DB 里少了的动作,线上就是真的没有了。

## 物理

Rapier 0.19(WASM)。角色 body 用 KinematicPositionBased,撞墙会被推回。
- Floor: cuboid 50×0.05×50(plane 模式)或按 floor.radius 算
- 4 边界墙:按 `scene.physics.bounds` 算位置
- `scene.physics.gravity = -9.81`

## 位置持久化

**没有**。数字人位置不跨会话保留,每次进来回到原点。
(早期 Phase 2.5 的 `vrm_sessions` 持久化已按产品决策移除。)

## 调试

`/digital-human` 页面上,开发模式下:

| 入口 | 用途 |
|---|---|
| 按 `1` / `2` / `3` / `0` | 关掉 three.js / 语音 / 唤醒词(需刷新),排查性能与报错来源 |
| `window.__vrmStageHandle` | 直接调舞台方法:`setAction('wave')`、`setCameraPreset('side')`… |
| `window.__showScenePanel({...})` | 不跑 LLM 直接弹一块 3D 面板,调样式/交互用 |

## 故障排查

| 现象 | 排查 |
|---|---|
| 角色 T-pose 不动 | 控制台看 `[VrmStage] using ConfigBundle`,确认模型加载;`loadAvatar` 有没有报错 |
| 表情/动作不响应 | 看 `[parseAvatarDirectives] found calls`;确认动作名在 seed 目录里 |
| 线上动作变少 | DB 种子与 seed JSON 不同步(见「目录一致性」) |
| 说话时嘴不动 | `connectAudioElement` 是否被调过;同一个 `<audio>` 只能接一次 |
| 面板不弹 | 看 `[agui] UI 工具参数不合法`;空 items / 空 fields 会被丢弃 |
| 打断后又自己说起来 | 确认 `cancel()` 走到了 `abortRef.abort()`(AG-UI 模式没有 WS) |
| 撞墙没挡住 | 看 `[useVrmPhysics] Rapier world ready`;`scene.physics.bounds` 配错没 |

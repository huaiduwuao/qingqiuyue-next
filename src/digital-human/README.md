# VRM 数字人系统

/digital-human 全屏页 + 全站浮窗的数字人。对话走 agentmanager 的 AG-UI(SSE),
形象/动作/口型由前端驱动,列表和表单直接渲染在 3D 场景里。

## 结构

```
src/digital-human/
  ImmersiveDigitalHuman.tsx  # /digital-human 全屏页(舞台 + 会话 + 语音 + 面板)
  # (全站浮窗版 FloatingDigitalHuman.tsx 已移除:常驻右下角会压住页面元素,数字人只留 /digital-human 一处)
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

## 星光广场(舞台外的可逛世界)

`vrm/world/` 在场景预设(只管中央舞台)外面铺一整座半径 17m 的广场,默认开,右上角树形按钮可收起
(记在 localStorage `dh_world`)。

| 文件 | 管什么 |
|---|---|
| `world/worldLayout.ts` | 纯数据/纯函数:6 个地标、边界与地标碰撞 `clampToWorld`、星光刷点、每日任务、等级 —— 全有单测 |
| `world/buildWorld.ts` | three 构建:地面 + 发光小路着色器、地标道具、路灯、星光、落点波纹、头顶飘字;配色跟场景预设走 |
| `world/useVrmWorld.ts` | 每帧:进出地标、捡星光(18s 后别处补刷);画布「点击」(位移 <8px 且 <450ms,否则是拖镜头):点角色=戳、点地标=走过去、点地面=走到那 |
| `scene-ui/useWorldGame.ts` | 页面层记账(经验/任务,localStorage `dh_world_game`,跨天清任务不清经验)+ 角色反应 + 地标互动 |
| `scene-ui/GameHud.tsx` | 等级条、任务清单、小地图(点哪走哪)、地标互动卡、提示条、首次操作说明 |

操作:WASD/方向键走(以镜头为参照),Shift 跑,Q/E 转镜头,空格跳,F 互动。角色朝前进方向转身,
停 1.6s 后转回来看镜头。镜头跟着角色平移;俯瞰(视角拉到 55°)和凑近看屏幕时不跟,镜头飞行途中角色
走动会把终点一起挪(`useVrmCamera.shift`)。

地标互动:舞池、观星台在本地做效果;点唱机/许愿池/放映亭/书亭/观星台会回灌一句话给数字人,
由模型决定放歌、开屏幕(对话进行中不回灌)。三块显示器仍在舞台原位,开屏幕时镜头会飞回舞台。
`body.move` 等位置写入在广场里都过 `clampToWorld`(原来是 ±6 的方框)。

### 和平台功能联动

| 地标 | 面板内容(`scene-ui/plazaFeeds.ts`) | 点了之后 |
|---|---|---|
| 放映亭 | `recommend/feed` 能看的影视 | 大屏打开详情 |
| 点唱机 | 本周热歌(leaderboard MUSIC) | 整张榜做成队列,走全站播放器 |
| 书亭 | 今日一悟 + 今日诗 + 热门小说 | 竖屏打开 |
| 舞池 | 正在直播(home/live/rooms) | 大屏打开直播间 |
| 观星台 | 全网今日热榜(trending) | 屏幕打开 |
| 许愿池 | 许愿墙 + 正在悬赏(demand scope=market) | 许愿/祝福;「把愿望变成悬赏」去悬赏中心 |

服务端是 core-api 的 `internal/plazaapp`(`/api/core/plaza/*`,都要登录):

- `plaza_progress` 广场进度跨设备(`useWorldGame` 进页面和本机进度合并 `mergeGameStates`,变动 2s 防抖回存;
  服务端经验只增不减、单次增量有上限)。
- `plaza_wish` / `plaza_wish_bless` 许愿墙:每人每天 3 条、过敏感词;新愿望实时推送 `plaza.wish` 给在广场的人,
  被祝福推 `plaza.bless` 给愿望主人。许愿、给别人祝福记平台每日任务 `plaza_wish`(+5)/`plaza_bless`(+2×3),
  积分只在这两个服务端看得见的动作上发 —— 捡星光、广场经验不换积分。
- 在线位置在 Redis `qq:plaza:presence`(15s 过期),`usePlazaOnline` 每 3s 心跳,回包里是附近 40 个人和自己的光环,
  场景里画成发光小人影 + 名牌 + 光环。
- 光环是商城装扮 `plaza_aura`(`growth.KindPlazaAura`),`plazaapp` 在商城里没有光环时补 4 件;兑换/佩戴走商城接口。
- 场景状态里多了 `plaza`(所在地标、在线人数、等级),`tagent.sceneStateSection` 看到它会告诉模型各地标对应的功能。

平台每日任务(签到、广场许愿、送祝福……)嵌在广场任务清单下面。广场 HUD 包在 ErrorBoundary 里,
任何一个接口回包不对只会让那块显示「连不上」,不会带崩对话。

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

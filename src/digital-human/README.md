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

### 场景与人物(后台 /system/plaza)

场景和人物存在 core-api 的 `plaza_scene` / `plaza_character`(`internal/plazaapp/scene*.go`),用户进广场时
`GET /api/core/plaza/scenes` 拉已发布的;拿不到就只有默认的星光广场。前端把它转成 `WorldDef` / `WorldCharacter`
(`scene-ui/usePlazaScenes.ts`),几何函数(`clampToWorld` / `zoneAt` / 刷星光)都按当前场景算,换场景整座广场重建,
中央舞台切到场景指定的预设。起步数据:星光广场 + 四座人生感悟庭院(心脉庭院 / 三情长廊 / 七情殿 / 六欲园,
22 个主题各一个地标:亭子、石碑、灯笼、柳树、月洞门),每个主题一位诗人,每座庭院一位引路人。

人物只有两种,都守「只做有据可查的」:

- **诗人**:台词不存库、后台也不许写。前端按 (主题, 诗人) 调 content-api `/insight/voice`,拿他自己写过的、
  正文里含主题词的原句(带诗题和作品 id,点开就是那首诗);诗人留空 = `/insight/poets` 里写这个主题最多的名家,
  同一场景里不重复。小传来自 `/poetry/poet`(语料里整段重复的小传只去重、不改字)。想听解读 = 「请她讲讲」,
  交给数字人在对话里说,和史料分开。
- **引路人**:运营写的台词;挂了感悟分组的,开口先念分组题记(原句 + 出处)。

走到人物 1.8 米内或点他,左侧弹人物面板,人物头顶冒出他说的那句。任务里多了「在感悟庭院驻足 3 处」「和 2 位人物说说话」。
感悟地标的面板 = 题记 + 编者一问 + 这个主题的诗与作品(`/insight/theme`),「从古至今」打开主题页的时间线。
场景状态里的 `plaza` 带上场景名和人物名单。

### 环境层(湖、山、天光)与人物的身体

`vrm/world/env/`:广场开着时,场景预设只剩舞台地板 / LED 环(天空球、背景墙、圈外装饰、预设灯和粒子都藏起来,
只动 `useVrmScene` 里命名为 `dh-preset` 的那个 group),外面换成一整个山谷:

| 文件 | 管什么 |
|---|---|
| `timeOfDay.ts` | 纯函数:给钟点算太阳方向和整套天光配色(天顶 / 地平线 / 雾 / 平行光 / 半球光 / 灯亮度),几个关键时刻手调、中间插值;有单测 |
| `environment.ts` | 天空着色器(渐变 + 日晕 + 流云 + 星空 + 银河 + 月亮)、山谷地形(fbm,舞台后方是山屏)、松林(实例化)、湖面着色器(四组波解析法线 + 噪声细纹、菲涅尔天空倒影、日 / 月碎光、岸边泡沫、路灯倒影、雾)、挂灯笼的船、天气粒子(落花 / 落叶 / 雨 / 雪 / 萤火,着色器里围着镜头取模,CPU 不逐个更新)、风吹的草(实例化 + 顶点摆动)、跟着角色走的日 / 月阴影光 |
| `post.ts` | 后期:MSAA 半浮点场景 → 亮部 4 级降采样模糊的泛光 → 冷暖 / 饱和 / 暗角 / 颗粒 → ACES + sRGB。**alpha 原样保留、挖洞处 rgb 清零**,三块显示器的 DOM 才透得出来(UnrealBloomPass 做不到) |
| `../npcRig.ts` | 人物的身体:有关节的小人(胯 / 腰 / 胸 / 颈 / 头 / 双臂),车床旋的长衫下摆、交领、腰带、宽袖、幞头和胡须 / 发髻和簪,布料用 sheen 物理材质;程序化动作:呼吸、换重心、走近转身、目光跟人、作揖、说话时抬手吟诵、闲时捋须 / 望天 / 负手、下摆随风 |

广场是湖心石台(`buildWorld` 的 `island` 选项:地面收到石台大小、加台边、半球光交给环境层、路灯夜里更亮 + 几盏真点光源)。
场景的时辰 / 天气 / 草地存在 `plaza_scene.palette`(`time` / `weather` / `grass`),后台可改;缺省:广场夜里 + 萤火,
庭院黄昏 + 落花 + 草。HUD 上可以轮换时辰(约 3 秒转过去)、切画质(高 = 后期 + 草 + 2048 阴影;流畅 = 都不要,手机默认)。
`useVrmRenderer.setRenderOverride` 让环境层接管每帧渲染;镜头远平面在广场里拉到 1200。

角色步态(`useVrmAnimation.applyGait`)不再用配置里的 walk / run 公式:腿按步相摆、摆动相屈膝、手臂前后摆(以前是左右扇)、
胯胸反扭、跑步前倾,淡入淡出;叠加偏移记着上一帧写的值,不会在不被重置的骨骼上越叠越歪。

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

# VRM 数字人系统

参数化 / 物理 / 持久化 全栈架构。

## 结构

```
src/digital-human/
  VrmStage.tsx               # 主组件（thin orchestrator）
  vrm/
    config/
      types.ts              # ConfigBundle + 7 套 Config 接口
      loader.ts             # 静态 seed JSON 加载 + async API fallback
    physics/
      world.ts              # Rapier 物理世界（character capsule + 场景墙）
    useVrmRenderer.ts       # three.js + OrbitControls + rAF
    useVrmScene.ts          # 场景切换 + 灯光呼吸
    useVrmLipSync.ts        # 口型（WebAudio 频谱 → aa/ih/ou）
    useVrmCamera.ts         # 相机预设 + 自由轨道
    useVrmPhysics.ts        # Rapier 集成 hook
    useVrmAnimation.ts      # 统一动画状态机（Phase 4.1）
    legacySceneBuilders.ts  # 旧硬编码 build*（Phase 1 过渡，Phase 2 删）
    sceneBuilders.ts        # buildScene(SceneConfig) config-driven
    vrmCompat.ts            # ARKit ↔ VRM 0.0/1.0 名字兼容
    loadAvatar.ts           # 加载 .vrm 模型
    audio.ts                # WebAudio + 演示歌曲合成
  api/
    digitalHumanConfig.ts   # 7 套 CRUD + sessions/me 的 fetch 封装
  store/
    session.ts              # zustand + 5s 自动 flush
  tools/
    actions.ts              # 29 个动作（formula 跑）
    expressions.ts          # 20 个表情（从 config 读）
    visemes.ts              # 18 个 viseme（从 config 读）
    dispatcher.ts           # tool_calls → sinks
    tools.ts                # ALL_TOOLS catalog
  data/seed/                # 7 套 seed JSON
    models/character.json
    scenes/concert.json + 5 个
    actions/character.json (29)
    dances/character.json (4)
    poses/character.json (6)
    expressions/character.json (20)
    visemes/character.json (18)

D:\git\really\qingqiuyue-go\internal\digitalhuman\
  entity.go                 # 7 套 Entity struct + 通用 JSONBMap / JSONBArray（UUID 主键）
  repository.go             # 7 套 Repository（含 modelRepo / actionRepo / sceneRepo / sessionRepo）
  handler.go                # 7 套 CRUD + sessions/me HTTP handlers
  service.go                # 业务逻辑
  router.go                 # Register() 挂 20+ 个路由
  dto.go                    # 请求/响应 DTO
  tools.go                  # 7 套 tool catalog
  migrations/001_vrm_seed.sql  # 初始数据（首次部署执行一次）
```

## 数据流

```
[qingqiuyue-go 启动]
  → AutoMigrateAll(7 张表)
  → 首次部署执行 migrations/001_vrm_seed.sql 灌入初始数据
  → Register 路由

[浏览器 mount /digital-human]
  → VrmStage mount
  → loadConfigBundle() (同步) — 用本地 seed JSON 兜底
  → loadConfigBundleAsync() (异步) — 覆盖 BUNDLE（DB 改了才会变）
  → 异步 getMySession → useSessionStore.setSession
  → handle.setPosition/setYOffset 恢复
  → 5s setInterval 自动 flush
  → beforeunload / unmount 立即 flush
```

## 物理集成

Rapier 0.19（WASM）。角色 body 用 KinematicPositionBased，撞墙会被推回。
- Floor: cuboid 50×0.05×50（plane 模式）或按 floor.radius 算
- 4 边界墙: 按 scene.physics.bounds 算位置

`scene.physics.gravity = -9.81`（y 方向）

## 持久化（每 5s）

```sql
vrm_sessions (
  id, user_id, model_id, scene_id,
  position_x, position_y, position_z, rotation_y, y_offset,
  current_action, current_pose, dance_style, bpm, dance_amp, camera_preset,
  custom_expression, custom_pose,
  updated_at
)
```

唯一约束：user_id。前端 `upsertMySession()` 用 FirstOrCreate。

## 适配规则（Phase 5）

`ActionAutoExpressionMap` —— 当角色跑某个动作时自动套用对应 emotion/viseme：
- dance → happy
- sing → excited + aa
- laugh → laugh
- cry → cry
- jump → surprised + oh
- sleep → sleepy_tired
- wave/greet → happy
- ...

用户手动调 setEmotion 覆盖优先级最高。

## 工具调用（Hermes 协议）

7 个 tool（+ 9 个 VrmStage 新增）：
1. face.setExpression
2. face.mouthOpen
3. mouth.setViseme
4. mouth.speak
5. body.playAction
6. body.move ← VrmStage 实现
7. camera.control
8. **scene.change** ← VrmStage 新增
9. **camera.preset** ← VrmStage 新增

所有 tool 走 `dispatchToolCall(call, sinks)` → `VrmStageHandle` 方法。

## 性能目标

- 60fps 稳定（Rapier 单 body + 几 collider < 0.1ms）
- 软阴影 + 5 套场景内存可控
- 模块加载 < 200ms（所有 seed JSON 总共 ~50KB）
- API 异步加载不阻塞首屏

## 故障排查

| 现象 | 排查 |
|---|---|
| 角色 T-pose 不动 | 控制台看 `[VrmStage] using ConfigBundle: ...`，确认 model 加载了；`loadAvatar` 有没有报错 |
| 表情不响应 | 看 `VrmStage.setEmotion` 日志；检查 `expressionMap` 有没有对应 key |
| 撞墙没挡住 | 看 `[useVrmPhysics] Rapier world ready` 日志；scene.physics.bounds 配错没 |
| Session 没保存 | 看 `[session] flushed to server` 日志；DB 里 vrm_sessions 表 |
| 切场景不重建 | 看 `setScene` 日志 + `buildSceneByName` 是否被调到 |
| WASD 不动 | `keysRef.current` 是否有值；`camApi.orbit` 调用链 |

## 后续路线

- ✅ Phase 3.1: Foot IK（脚贴着地面，自动适应斜坡）
- ✅ Phase 3.2: 表情/口型/动作 lerp 过渡（现在直接 setValue，会跳变）
- ✅ Phase 4.1: 实际用 useVrmAnimation 替换 useVrmDance 隐式逻辑
- ✅ Phase 5.1: Admin UI (`/system/digital-human-config`)：可视化编辑 model/scenes/actions
- Phase 6: 多用户 + 权限（vrm_sessions 加 tenant_id 索引已就位）

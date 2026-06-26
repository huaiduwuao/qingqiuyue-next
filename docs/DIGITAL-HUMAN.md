# 数字人管线 — Blender + COLMAP + 3DGS

本仓库的数字人**完全开源、商用干净**,不依赖任何参数化人体模型(SMPL-X / FLAME 都被绕开)。

## 流程图

```
拍摄手机视频 (30s 慢转 360°)
        │
        ▼
   ┌─────────┐
   │ capture │  bash scripts/capture.sh --input video.mp4 --out work/
   └────┬────┘  ffmpeg 抽帧到 work/images/%05d.jpg
        ▼
   ┌──────────────┐
   │ reconstruct  │  bash scripts/reconstruct-colmap.sh --work work/
   └────┬─────────┘  COLMAP: SIFT + SfM + 稠密重建 → work/dense/fused.ply
        ▼
   ┌────────────┐
   │ train_3dgs │  bash scripts/train-3dgs.sh --work work/   (可选,需 GPU)
   └────┬───────┘  3DGS 训练 → work/gs/point_cloud/.../point_cloud.ply
        ▼
   ┌──────┐
   │ mesh │  python scripts/clean-mesh.py --ply ... --out work/mesh/cleaned.glb
   └────┬─┘  Poisson + decimation + 平滑 → cleaned.glb (≤ 50k 面)
        ▼
   ┌────────────┐
   │ rig_blender│  blender --background --python scripts/blender/rig_mesh.py ...
   └────┬───────┘  导入 + Rigify 绑骨 + 雕 12 个 BlendShape + 3 个 baked action
        ▼
   ┌────────┐
   │ deploy │  cp work/mesh/rigged.glb → public/avatars/model.glb
   └────────┘
        ▼
   浏览器 three.js + WebGPU 实时驱动(LLM chat → emotion/viseme/action)
```

**一行跑完**:
```bash
bash scripts/avatar-pipeline.sh \
    --input video.mp4 \
    --name xiaoqiu \
    --out work/xiaoqiu \
    [--skip-3dgs]      # 没 GPU 时跳过 3DGS,直接用 COLMAP dense 点云
    [--mixamo dir/]    # 可选,导入 Mixamo FBX 动作目录
```

## 工具依赖

| 工具 | 用途 | 安装 |
|---|---|---|
| `ffmpeg` | 抽帧 | `brew install ffmpeg` / `apt install ffmpeg` / Win:chocolatey |
| `colmap` | SfM + 稠密重建 | `brew install colmap` / Linux:见 [colmap.github.io/install](https://colmap.github.io/install.html) / Win:WSL2 推荐 |
| `blender` 4.2 LTS+ | 绑骨 / 雕表情 / 导出 GLB | [blender.org/download](https://www.blender.org/download/) |
| `python` 3.10+ | clean-mesh + 跑 Blender 脚本 | 系统自带或 pyenv |
| `open3d` | Poisson + 简化 | `pip install open3d numpy plyfile trimesh` |
| `torch` + CUDA | 3DGS 训练(可选) | `pip install torch --index-url https://download.pytorch.org/whl/cu121` |

### GPU 要求

- **3DGS**:NVIDIA 8GB+ 显存(12GB+ 推荐)
- **没 GPU**:用 `--skip-3dgs` 跳过,直接吃 COLMAP 稠密点云,效果略弱但能用

## 12 个 BlendShape 词汇表

锁定不变 —— 前端 `BlenderAvatar.tsx` + `FloatingDigitalHuman.tsx` 直接消费这些名字。

### 表情(5)

| 名字 | 触发 |
|---|---|
| `smile` | 开心、问候 |
| `blink` | 眨眼(短促) |
| `sad` | 难过、抱歉 |
| `angry` | 生气、严肃 |
| `surprised` | 惊讶、强调 |

### 口型(7,Preston-Blair 子集)

| 名字 | 音素 |
|---|---|
| `closed` | 静默 / m/b/p |
| `aa` | a / ā / 啊 |
| `ih` | i / 一 |
| `ou` | u / 乌 |
| `E` | e / 鹅 |
| `O` | o / 哦 |
| `U` | ü / 鱼 |

## 17 关节骨架

标准骨骼名(`_rig_template.STANDARD_BONES`):

```
Root → Pelvis
       ├── Spine → Head
       │         ├── Shoulder_L → Elbow_L → Hand_L
       │         └── Shoulder_R → Elbow_R → Hand_R
       ├── Hip_L → Knee_L → Foot_L
       └── Hip_R → Knee_R → Foot_R
```

Mixamo 映射表(`_rig_template.MIXAMO_BONE_MAP`):
```
mixamorig:Hips        → Pelvis
mixamorig:Spine / Spine1 / Spine2 → Spine
mixamorig:Neck / Head → Head
mixamorig:LeftShoulder / LeftArm / LeftForeArm / LeftHand → Shoulder_L / Elbow_L / Hand_L / Hand_L
(右臂对称)
mixamorig:LeftUpLeg / LeftLeg / LeftFoot / LeftToeBase → Hip_L / Knee_L / Foot_L / Foot_L
(右腿对称)
```

## 动作库

### 3 个 baked(占位,所有 GLB 都有)

- `idle` — 呼吸 + 微晃头
- `wave` — 抬右手摇摆
- `walk` — 左右腿交替 + 手臂反相

### Mixamo 导入

到 https://www.mixamo.com:
1. 选角色(Mixamo Starter Pack 任何都行,免费)
2. 选动作
3. Download Settings:
   - Format: **FBX Binary**
   - Pose: T-Pose
   - Skin: **Without Skin**(只要骨骼 + 动画)
4. 下载后命名(如 `dance.fbx`)

导入:
```bash
blender --background --python scripts/blender/import_mixamo.py -- \
    --fbx mixamo/dance.fbx \
    --target public/avatars/model.glb \
    --output public/avatars/model.glb \
    --action-name dance
```

## 协议(给 `qingqiuyue-go/internal/avatarapp/studio.go` 用)

`avatar-pipeline.sh` 和子脚本的 stdout 输出符合:

```
STAGE capture 5
STAGE capture 30
STAGE capture 100
STAGE reconstruct 35
...
```

被 `parseTrainLine` (studio.go:268-282) 解析:
- `STAGE <key>` → 切换阶段(capture / reconstruct / train_3dgs / mesh / rig_blender / deploy)
- 其他行作为日志

将来如要把这条管线接入 Go 后端的 `/api/realtime/train`,只需 `AVATAR_TRAIN_CMD="bash /path/to/avatar-pipeline.sh ..."` 即可。

## License

本管线**完全商用合法**,无邮箱 / license 门槛:

| 组件 | License | 商用? |
|---|---|---|
| 用户拍摄的本人视频 | 无 | ✅ |
| COLMAP | BSD-3 | ✅ |
| 3DGS(gaussian-splatting) | 自带研究 license,商用前确认上游 | ⚠️ |
| Open3D | MIT | ✅ |
| Blender | GPL(软件) | ✅ .glb/.fbx 导出物是数据,不受 GPL 传染 |
| Mixamo | 免费 + 商用 license(Adobe 条款) | ✅ |
| three.js / WebGPURenderer | MIT / W3C 标准 | ✅ |
| Qwen2.5 / Edge-TTS / CosyVoice2 | Apache 2.0 / 公共 API / 开源 | ✅ |

**绝不使用**:
- ❌ SMPL-X(需 smpl-x.is.tue.mpg.de 注册学术邮箱,license 禁商用)
- ❌ FLAME(同 MPI,禁商用)
- ❌ ExAvatar / GauHuman(基于 SMPL-X,继承 license 限制)

## 失败排查

### 1. COLMAP 找不到

```bash
colmap --version  # 应输出 3.x
```

没有就装。Windows 推荐 WSL2。

### 2. 3DGS CUDA 不可用

```bash
python -c "import torch; print(torch.cuda.is_available())"
# False → 装对应 CUDA 版本的 PyTorch
```

### 3. Blender 脚本 bpy 报错

确认 Blender 版本 ≥ 4.2 LTS。5.x 也兼容(`export_armature` 参数差异已在 `_rig_template.export_glb` 处理)。

### 4. 自动权重绑骨后骨骼乱飞

3DGS / COLMAP 产出的 mesh 拓扑不一定适合自动权重。**解决方案**:
- 在 Blender GUI 里手动摆权重
- 或换用 Retarget Helper(把 Mixamo 角色绑好后再 retarget 你的 mesh)

### 5. viseme / emotion 命名不匹配

前端只认 `aa/ih/ou/E/O/U/closed` + `smile/angry/sad/surprised/blink`,其它名字会被无声丢弃。

### 6. Mixamo 动作导入后变形

确认 `--fbx` 是 Without Skin(只有骨骼 + 动画)。With Skin 会带多余 mesh,需要手动删。

## 文件清单

```
scripts/
├── capture.sh              # ffmpeg 抽帧
├── reconstruct-colmap.sh   # COLMAP SfM + dense
├── train-3dgs.sh           # 3DGS 训练
├── clean-mesh.py           # Poisson + decimation
├── avatar-pipeline.sh      # 端到端编排(用上面所有)
└── blender/
    ├── _rig_template.py    # 共享 rig + actions + export
    ├── build_avatar.py     # 程序化 primitives(无视频 fallback)
    ├── build_realistic.py  # 程序化写实版
    ├── rig_mesh.py         # 导入 cleaned.glb + 绑骨
    ├── sculpt_blendshapes.py  # 真实 12 个 BlendShape 雕刻
    └── import_mixamo.py    # Mixamo FBX → retarget → 追加

public/avatars/
├── model.glb               # 主模型(rig + 12 shapes + 3 baked actions)
├── outfits/                # 换装(暂未自动生成,手动复制 model.glb 起手)
└── scenes/                 # 背景场景
```

## 下一步扩展(本期未做)

- [ ] 自动 outfit 替换(`outfits/suit.glb` 等),目前要手动复制 model.glb 起手
- [ ] ARKit 52 blendshape 升级(从 12 扩展到 52,支持更细腻表情)
- [ ] LLM-driven 全身动作决策(目前只有 head/face 驱动,body 只在 idle/wave/walk 间切换)
- [ ] 实时 audio2face fallback(WebSocket `AVATAR_A2F_URL` 已有 hook,默认走 viseme timeline)
# 二次元角色预制库

> 5~10 个**程序化生成**的二次元角色,用户**在 web 上点选**就能用。
> 0 本地安装、0 学术邮箱、0 license 风险。

## 包含的 10 个角色

| ID | 名字 | 风格 | 发色 | 瞳色 | 服装 |
|---|---|---|---|---|---|
| `aoi` | 蒼 | 黑色长发 | 黑 | 蓝 | 学校制服 |
| `yuki` | 雪 | 银色双马尾 | 银 | 粉 | 白裙 |
| `mei` | 芽衣 | 棕色波波头 | 棕 | 绿 | 休闲 T 恤 |
| `hana` | 花 | 粉色马尾 | 粉 | 红 | 商务西装 |
| `ren` | 蓮 | 金色短发 | 金 | 金 | 运动套装 |
| `sora` | 空 | 紫色中发 | 紫 | 紫 | 休闲卫衣 |
| `akira` | 晶 | 深蓝刺猬 | 深蓝 | 橙 | 皮夹克 |
| `yuna` | 結 | 白色长发 | 白 | 天蓝 | 和服 |
| `kaito` | 海斗 | 棕色斜刘海 | 棕 | 棕 | 卫衣 |
| `rin` | 凛 | 红色中发 | 红 | 金 | 朋克风 |

每个角色:
- 程序化生成(Blender primitives,无外部素材)
- chibi 比例(头占 18% 身高,比正常二次元略大)
- 17 骨骼标准人形 rig
- 12 个 BlendShape(表情 5 + 口型 7)
- 3 个 baked action(idle / wave / walk)
- 256x256 缩略图

## 文件位置

```
public/avatars/library/
├── aoi.glb + aoi.png
├── yuki.glb + yuki.png
├── ... (10 个)
└── library.json    ← API 读这个
```

## 怎么生成 / 重新生成

**第一次部署**(需要 1 次):

```bash
blender --background --python scripts/blender/build_anime_avatar.py -- \
    --output public/avatars/library/
# 等 ~5 分钟,输出 10 个 .glb + 10 个 .png + library.json
```

**加新角色**:编辑 `scripts/blender/build_anime_avatar.py` 的 `LIBRARY` 数组,加一项,然后重跑。

**只重渲一个**:
```bash
blender --background --python scripts/blender/build_anime_avatar.py -- \
    --output public/avatars/library/ --only aoi
```

## License 清单(全部 0 风险)

| 来源 | License | 商用 |
|---|---|---|
| 程序化几何(球/柱/锥) | 你的代码,自己定 | ✅ |
| Blender 软件 | GPL,导出的 .glb 是数据 | ✅ |
| 12 个 BlendShape 名 | 你定的,无版权 | ✅ |
| 17 骨骼 + Rigify 命名 | 你的代码,无版权 | ✅ |

**绝无**:
- ❌ 不要拿 VRoid Hub 公开角色的 .vrm 直接用,逐个 license 不同
- ❌ 不要拿 Live2D 官方 sample,license 严格
- ❌ 不要拿别人的二次元模型截图当缩略图,肖像权

## 怎么扩展

1. **加更多发型/瞳色**:改 `build_anime_avatar.py` 的 `build_hair()` 函数,加新分支
2. **加 chibi 变种**:调 `head_size_factor` 让头大身小
3. **加真实比例**:传 `chibi=False`(头占 13% 身高)
4. **加服装变种**:在 `LIBRARY` 数组加项,`accent` 字段控制主色

## 在 wizard 里集成

`/avatar-pipeline` 第 1 步选"选个二次元角色" → 加载 library → 点选 → 输名字 → 直接 rig + deploy。

后端 API:`GET /api/avatar/pipeline/library` 返回 `library.json` 内容。

Pipeline 调用:
```bash
bash scripts/avatar-pipeline.sh \
    --from-library aoi \
    --name xiaoqiu \
    --out work/xiaoqiu
# 跳过 capture/reconstruct/3dgs/mesh,直接 rig_blender + deploy
```

## 已知限制

- **写实度有限**:程序化几何是 primitives 拼的,比真建模师雕的粗糙
- **纹理简单**:用单色 PBR,没做 Toon Shader(线稿风格的二次元专用)
- **动作有限**:只有 idle / wave / walk;Mixamo 可加但要自己 retarget
- **BlendShape 12 个**:口型 + 表情够用,但比 ARKit 52 少很多细腻表情

需要更高质量时,可:
- 用 Blender GUI 手动雕(美术介入)
- 引入 Toon Shader(`Material → Surface → Principled BSDF` 改 `Toon BSDF`)
- 从外部引入更高质量 VRM 资源(注意 license)

## 调试

```bash
# 查 library.json 是否被 Next.js 读到
curl http://localhost:3000/api/avatar/pipeline/library -b "auth-token=$JWT" | jq .

# 查缩略图
curl -o /tmp/aoi.png http://localhost:3000/avatars/library/aoi.png
file /tmp/aoi.png    # 应:PNG image data, 256 x 256

# 查 GLB
curl -o /tmp/aoi.glb http://localhost:3000/avatars/library/aoi.glb
xxd /tmp/aoi.glb | head -1    # 应:glTF magic
```
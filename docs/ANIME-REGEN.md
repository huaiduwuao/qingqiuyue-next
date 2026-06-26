# 重生成二次元 model.glb

> 当前 `public/avatars/model.glb` 是**真人风格**(球+圆柱 primitives 拼的),只 3 个动作。
> 要二次元形象 + 全身动作,需要装 Blender 跑 `build_anime_avatar.py` 重生成。

## 1. 装 Blender(10 分钟)

### Windows
- 下载 [Blender 4.2 LTS](https://www.blender.org/download/lts/)(选 `.msi`)
- 安装时勾 "Add Blender to PATH" 或记下安装路径如 `C:\Program Files\Blender Foundation\Blender 4.2\blender.exe`
- **不要**用 5.x(LTS 更稳)

### macOS
```bash
brew install --cask blender
```

### Linux
```bash
sudo snap install blender --classic
# 或
wget https://download.blender.org/release/Blender4.2/blender-4.2.0-linux-x64.tar.xz
tar xf blender-4.2.0-linux-x64.tar.xz
sudo cp blender-4.2.0-linux-x64/blender /usr/local/bin/
```

## 2. 验证 Blender

```bash
blender --version
# 期望输出:Blender 4.2.0
```

Windows 没加 PATH 的话,直接用绝对路径:`"C:\Program Files\Blender Foundation\Blender 4.2\blender.exe" --version`

## 3. 跑 build_anime_avatar.py

### 一次生成全部 10 个角色 + library.json

```bash
cd D:/git/really/qingqiuyue-next
blender --background --python scripts/blender/build_anime_avatar.py -- \
    --output public/avatars/library/
```

**耗时**:`~3 分钟`(10 个角色 × 30 秒 Blender 启动 + 烘焙)。

**输出**:
```
public/avatars/library/
├── aoi.glb + aoi.png
├── yuki.glb + yuki.png
├── ... (10 个)
└── library.json    ← API 读这个
```

### 选 1 个生成(快,30 秒)

```bash
blender --background --python scripts/blender/build_anime_avatar.py -- \
    --output public/avatars/library/ --only aoi
```

## 4. 覆盖主 model.glb

我们用 `aoi`(黑色长发 + 蓝色眼 + 学校制服)作为默认主角色:

```bash
# 1. 选一个角色作为主 model.glb
cp public/avatars/library/aoi.glb public/avatars/model.glb
cp public/avatars/library/aoi.glb public/avatars/outfits/casual.glb

# 2. 浏览器刷 http://localhost:3000/digital-human
#    看到的就是二次元角色(之前是真人)
```

**为什么是 aoi**:最经典的二次元形象(黑长直 + 蓝眼),辨识度高,适合做"默认角色"。

## 5. 验证新 GLB

新 GLB 应该:
- ✅ 风格:二次元(大眼 + chibi 比例)
- ✅ Morph targets:12 个(smile / blink / sad / angry / surprised + aa / ih / ou / E / O / U / closed)
- ✅ Animations:**10 个**全身动作(idle / wave / walk / run / dance / sit / point / think / talk / bow)

```bash
# 在 PowerShell 跑:
cd D:/git/really/qingqiuyue-next
python -c "
import struct, json
with open('public/avatars/model.glb', 'rb') as f:
    _, _, _ = struct.unpack('<4sII', f.read(12))
    n, _ = struct.unpack('<I4s', f.read(8))
    data = json.loads(f.read(n))
print('animations:', [a['name'] for a in data.get('animations', [])])
if data.get('meshes'):
    print('morph targets:', data['meshes'][0].get('extras', {}).get('targetNames', []))
"
```

期望输出:
```
animations: ['idle', 'wave', 'walk', 'run', 'dance', 'sit', 'point', 'think', 'talk', 'bow']
morph targets: ['smile', 'blink', 'aa', 'sad', 'angry', 'surprised', 'ih', 'ou', 'E', 'O', 'U', 'closed']
```

## 6. commit + push

```bash
cd D:/git/really/qingqiuyue-next
git add public/avatars/model.glb public/avatars/library/
git status
git commit -m "feat(avatar): 用 build_anime_avatar.py 重生成二次元 model.glb

- 10 个 baked actions(idle/wave/walk/run/dance/sit/point/think/talk/bow)
- 12 morph targets 不变
- 二次元风格(大眼 + chibi 比例)
- aoi 作为主角色"
git push
```

## 7. 后端跑完整 pipeline 也能用新 GLB

`/avatar-pipeline` 走 `bash scripts/avatar-pipeline.sh --from-library aoi` 会从 `public/avatars/library/aoi.glb` 拷,自动用上 10 个动作。

## 故障排查

| 现象 | 解决 |
|---|---|
| `blender: command not found` | 装 Blender 时没加 PATH,加绝对路径 |
| Blender 启动很慢 | 首次启动 + 装 Python 模块要 30-60 秒,正常 |
| GLB 看起来还是旧版 | 清浏览器缓存(`Ctrl+Shift+R`);或者 .next 重 build |
| `model.glb` 太大 | 删除 `outfits/casual.glb` 外的 outfits(本任务只覆盖主模型) |
| Blender 4.5 报错 | 改用 4.2 LTS(API 差异) |

# 真人 3DGS 数字人 · 云端训练指南

目标:从一段真人视频(60~120 秒,带转身/说话/摆手)→ 训练出"可驱动的高斯数字人资产" → 拷回前端项目,SparkStage 接管渲染,LBS 蒙皮 + 口型 + 表情都能驱动。

本文档不重复训练原理,只回答"我是工程师、我要把这个跑通,该怎么租卡、跑什么、产物怎么回前端"。

---

## 0. 资产格式契约(必读)

前端 `src/digital-human/gs/assetFormat.ts` 期望一个目录里有 5 个文件:

| 文件 | 内容 | 字节布局 |
|---|---|---|
| `meta.json` | `{ count, jointCount, hasFlame, up, flameDim? }` | JSON |
| `smplx.json` | `{ parents: int[55], restJoints: float[55*3] }` | JSON |
| `gaussians.bin` | `[pos3, scale3, rot4, opacity1, sh48] × n` | Float32 LE |
| `skinning.bin` | `[j0..j3:uint16 LE × 4, w0..w3:float32 LE × 4] × n` | 二进制 |
| `avatar.ply` | 可视化版 .ply(给 Spark 的 SplatMesh 直接显形) | 3DGS 标准 PLY |

坐标系:约定 up = `-y`(3DGS/ExAvatar 习惯),相机看向 +z。

---

## 1. 租卡:三家对比

| 平台 | 性价比 | 推荐卡 | 起步价 | 备注 |
|---|---|---|---|---|
| **AutoDL** | ★★★★★ | 4090 / 5090 | ~¥2/h | 国内,支付宝,镜像多,推荐首选 |
| **矩池云** | ★★★★ | 4090 / A100 | ~¥3/h | 国内,学术友好,按秒计费 |
| **RunPod** | ★★★★ | A40 / A100 | $0.4/h | 境外,信用卡,带宽好,适合从 github 拉大模型 |

**配置最低**:1× 4090(24G)够用 ExAvatar / GauHuman 训练(12G+ 推荐)。
**省时间**:A100(40G)迭代快一倍,但 4090 已能跑通完整流程。
**系统盘**:≥ 60G(数据集 + conda + 中间产物)。
**数据盘**:≥ 100G(视频抽帧 + mask 较吃磁盘)。

> ⚠️ **不要选 T4/P4**:VRAM 16G,ExAvatar 跑 batch≥2 时 OOM。

---

## 2. AutoDL 全流程(约 90 分钟首次跑通)

### 2.1 开机选镜像

- 实例市场 → "PyTorch" → 选 **PyTorch 2.1 / CUDA 12.1** 镜像(带 diff-gaussian-rasterization 预编译)
- GPU:4090 × 1
- 镜像:有 `cuda-toolkit-12-1` 的(否则后续装 diff-gaussian-rasterization 要先装 CUDA)

### 2.2 同步数据(从本机 → 云)

```bash
# AutoDL 自带 ossutil,或者用 scp
scp -P <port> ./capture/xiaoqiu.mp4 root@<host>:/root/avatar-train/input/
```

> 视频拍摄要求:1080p / 30fps / 60~120s / 主体居中 / 转一周 / 说话 / 抬手 / 坐下起立。
> 灰背景最佳,室内顶光要均匀。

### 2.3 拉代码 + 装环境

```bash
# 已有 env 跳过
cd /root
git clone https://github.com/mks0601/ExAvatar_RELEASE.git
git clone https://github.com/skhu101/GauHuman.git
git clone https://github.com/your-org/qingqiuyue-next.git   # 拉这个仓库拿 scripts/

conda create -n avatar python=3.10 -y
source activate avatar
pip install torch==2.1.0 torchvision==0.16.0 --index-url https://download.pytorch.org/whl/cu121
pip install ninja opencv-python numpy trimesh tqdm plyfile
pip install diff-gaussian-rasterization -f https://sparkes-pypi.com   # 找不到就源码装:pip install git+https://github.com/graphdeco-inria/diff-gaussian-rasterization
pip install simple-knn
```

### 2.4 抽帧 + 预处理

```bash
mkdir -p /root/data/xiaoqiu/{images,masks,smplx}
ffmpeg -i input/xiaoqiu.mp4 -qscale:v 2 -r 30 data/xiaoqiu/images/%05d.jpg

# 前景分割:ExAvatar 自带(基于 RVM)
cd ExAvatar_RELEASE
python preprocess/run_segmentation.py --root /root/data/xiaoqiu

# SMPL-X 拟合(Hand4Whole 一次,后逐帧优化)
python preprocess/run_smplx_fitting.py --root /root/data/xiaoqiu
```

### 2.5 训练(选一个)

**ExAvatar**(推荐 · 全身 + 表情):
```bash
cd ExAvatar_RELEASE
ln -sfn /root/data/xiaoqiu data
python main/train.py --subject_id xiaoqiu --config configs/4070_low.yaml
# 约 4~6 小时(4090)
```

**GauHuman**(快 · 只身体 · 无表情):
```bash
cd GauHuman
python train.py -s /root/data/xiaoqiu --eval --motion_offset_flag \
  --smpl_type smpl --actor_gender neutral --iterations 1200
# 约 1.5 小时(4090)
```

### 2.6 导出前端资产

```bash
cd /root/qingqiuyue-next
source activate avatar

python scripts/convert-exavatar.py \
  --exavatar-dir /root/ExAvatar_RELEASE/output/xiaoqiu/train \
  --data-dir /root/data/xiaoqiu \
  --subject xiaoqiu \
  --out /root/output/xiaoqiu
```

会产出 `meta.json / smplx.json / gaussians.bin / skinning.bin / avatar.ply` 5 个文件。

### 2.7 验证(在云上跑一次)

```bash
# 起个 http server,本地 curl 看产物
cd /root/output/xiaoqiu
python -m http.server 8000 &
# 另开一个 shell
curl http://localhost:8000/meta.json | head
# 本地浏览器打开 Spark 官方 viewer (sparkjs.dev/editor) 加载 avatar.ply,确认能渲染
```

### 2.8 回传产物到前端

```bash
# 方案 A:AutoDL 关机前把 5 个文件下载到本机 public/avatar/xiaoqiu/
scp -P <port> root@<host>:/root/output/xiaoqiu/* \
  ./public/avatar/xiaoqiu/

# 方案 B:推到 OSS / S3,前端读 CDN
ossutil cp /root/output/xiaoqiu/ oss://your-bucket/avatar/xiaoqiu/ -r
```

### 2.9 接入前端

`src/mocks/handlers/avatar.ts` 第 79 行的 `/api/avatar/config` 已经读 `NEXT_PUBLIC_AVATAR_ASSET_URL`:

```bash
# .env.local
NEXT_PUBLIC_AVATAR_ASSET_URL=/avatar/xiaoqiu/
# 或 CDN
NEXT_PUBLIC_AVATAR_ASSET_URL=https://cdn.example.com/avatar/xiaoqiu/
```

启动 `npm run dev`,打开任意页面 → 浮窗会按 SparkStage → DynamicAvatarStage → VideoStage 顺序自检,SparkStage 成功就走 3DGS 真模型。

---

## 3. 矩池云 / RunPod 差异

矩池云和 AutoDL 步骤几乎一样,差别只在:
- 系统盘默认 50G,要主动扩到 100G
- 没有 ossutil,用 `mas-cli` 同步

RunPod 多一步:
- 默认不带 conda,先 `apt install wget && wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh && bash`
- 镜像用 `runpod/pytorch:2.1.0-py3.10-cuda12.1.0-devel`
- 国内访问 GitHub 慢,先 `git config --global url."https://ghproxy.com/https://github.com/".insteadOf "https://github.com/"`

---

## 4. 故障排查

| 现象 | 原因 | 修法 |
|---|---|---|
| `diff-gaussian-rasterization` 装失败 | CUDA 工具链不全 | 装 `cuda-toolkit-12-1`,或换 PyTorch 镜像 |
| 训练 OOM | 图像太大 | `python main/train.py --resolution 2`(ExAvatar) |
| 抽帧 0 张 | 路径有空格 | 改名,不要用中文 |
| 前端拉 `meta.json` 404 | 路径少 `/` | `assetUrl` 必须以 `/` 结尾 |
| Spark 加载 `.ply` 黑屏 | up 坐标系反了 | `meta.json` 改 `up: 'y'`(或调相机 z) |
| LBS 摆臂不动 | 资产 `skinning.bin` 全 0 | convert 没拿到 weights,看 `convert-exavatar.py` 的 fallback 警告 |
| 口型不动 | 浏览器 TTS 没音频 | 配 `NEXT_PUBLIC_TTS_AUDIO_URL` 走 AnalyserTTS |

---

## 5. 训练时长参考(4090)

| 阶段 | ExAvatar | GauHuman |
|---|---|---|
| 抽帧 | 2 min | 2 min |
| RVM 分割 | 20 min | 20 min |
| SMPL-X 拟合 | 40 min | 30 min |
| 训练 | 4~6 h | 1.5 h |
| 导出 | 1 min | 1 min |
| **合计** | **~5.5 h** | **~2 h** |

首次练手建议先跑 GauHuman 验通管道,再上 ExAvatar 拿表情。

---

## 6. 进阶:用别人发布的现成资产试跑

不训练也能验通前端:
- World Labs 官方有 [Spark 示例资产](https://sparkjs.dev/examples),下载一个 3DGS .ply 改名 `avatar.ply`,加一份最小 `meta.json`(`{ count, jointCount: 1, hasFlame: false, up: '-y' }`)和 `skinning.bin`(全 0 / 全 root)+ `smplx.json`(`{ parents: [-1], restJoints: [0,0,0] }`),丢 `public/avatar/sample/`,设 `NEXT_PUBLIC_AVATAR_ASSET_URL=/avatar/sample/`,前端能加载但 LBS 无效(数字人保持不动)。
- ExAvatar 作者 [mks0601](https://mks0601.github.io/) 的项目页有训练好的 zju-mocap_377 子集,拷 5 个文件改 `meta.json.count` 即可。

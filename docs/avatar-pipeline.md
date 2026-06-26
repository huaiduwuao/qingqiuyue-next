# 数字人 Web 流水线 — 运维文档

> 给**部署这个服务的运维**看的:不是给开发者。
> 开发者看代码 / 跑 `npm run dev` 就行;运维要保证 MinIO 起来、桶建好、ffmpeg/colmap/blender 装好。

## 0. 一句话

Web UI 在 `/avatar-pipeline`,**所有登录用户**都能用。后端:
- 浏览器 → Next.js(`/api/avatar/pipeline/*`)→ 启动 `bash scripts/avatar-pipeline.sh` 子进程
- 视频 + 产物 → MinIO(`qingqiuyue-avatars` 桶)
- 进度推流 → SSE

## 0.1 两种模式

- **视频模式**:`--input video.mp4` → COLMAP + 3DGS + Blender 绑骨 → 真人数字人
- **预制库模式**:`--from-library <id>` → 跳过 COLMAP/3DGS,直接 Blender 绑骨 → **二次元数字人**(10 个预制角色可选)

详见 [anime-characters.md](./anime-characters.md)。

## 1. 硬件 / 系统依赖

| 依赖 | 必需? | 用途 |
|---|---|---|
| `ffmpeg` | 必需 | 抽帧 |
| `colmap` | 必需 | SfM + 稠密重建 |
| `blender` 4.2+ | 必需 | 绑骨 + 雕表情 + 导出 GLB |
| `python` 3.10+ | 必需 | 跑 `clean-mesh.py` 等 |
| `open3d` | 必需 | Poisson + decimation |
| NVIDIA GPU 8GB+ | **强烈推荐** | 3DGS 训练(没 GPU 也能用,只是质量差) |
| MinIO | 必需 | 对象存储(已在 docker-compose) |

Linux 一行装齐核心:
```bash
apt-get install -y ffmpeg colmap python3-pip
pip install open3d numpy plyfile trimesh
# blender:从 blender.org 下载 4.2 LTS 解压即用
```

## 2. MinIO 初始化

第一次部署时执行(只需一次):

```bash
mc alias set local http://minio:9000 "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY"
mc mb -p local/qingqiuyue-avatars   # 桶建好
# 桶保持 private,不要改 policy
mc anonymous get local/qingqiuyue-avatars   # 应输出 "Access permission for `local/qingqiuyue-avatars` is `private`"
```

## 3. 环境变量(复制 `.env.example` 到 `.env.local` 改)

```bash
# MinIO
MINIO_ENDPOINT=minio                    # 容器内用;同机部署改成 localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=qingqiuyue
MINIO_SECRET_KEY=qingqiuyue123
MINIO_BUCKET=qingqiuyue-avatars
MINIO_PUBLIC_ENDPOINT=your.domain.com   # 浏览器直传用的公网地址
MINIO_PUBLIC_USE_SSL=true

# Pipeline
AVATAR_WORK_ROOT=/data/avatar-work      # 注意:容器里要给大磁盘
MAX_CONCURRENT_PIPELINES=2
AVATAR_JOB_TTL_MIN=30
PATH=/usr/local/bin:/usr/bin:/bin       # 确认 ffmpeg/colmap/blender 都在
```

`AVATAR_WORK_ROOT` 容器内挂大卷:
```yaml
# docker-compose.yml
services:
  web:
    volumes:
      - avatar-work:/data/avatar-work
volumes:
  avatar-work:
```

## 4. 启动 / 验证

```bash
# 1) 编译
npm ci
npm run build

# 2) 起服务
npm run start   # 端口看 package.json scripts

# 3) 冒烟测试(任一登录账号)
curl -X POST http://localhost:3000/api/avatar/pipeline/jobs \
    -H "Content-Type: application/json" \
    -b "auth-token=$JWT" \
    -d '{"name":"smoke","skip3dgs":true}'
# 返回 { jobId, upload.url }
```

浏览器:`http://your.domain/avatar-pipeline`,登录后上传短视频,看进度。

## 5. 数据卷 + 清理

| 路径 | 内容 | 清理建议 |
|---|---|---|
| `AVATAR_WORK_ROOT/jobs/<id>/` | input.mp4 / 中间产物 | job 完成后自动删 |
| MinIO `uploads/<id>/` | 原始视频 | job 完成后自动删 |
| MinIO `events/<id>.ndjson` | 事件流(审计) | 留 30 天 |
| MinIO `artifacts/<id>/` | 最终 GLB | 留 30 天(用户可下载) |
| `public/avatars/model.glb` | 当前激活的数字人 | 手动 |

手动清理:
```bash
# 删已完成的 jobs(7 天前的)
find $AVATAR_WORK_ROOT/jobs -maxdepth 1 -mindepth 1 -mtime +7 -exec rm -rf {} \;
# MinIO artifacts 留 30 天
mc ilm add local/qingqiuyue-avatars --expire-days 30 --prefix "artifacts/"
```

## 6. 监控

主要看 3 个东西:

### 6.1 进程数(防止 GPU 撑爆)
```bash
ps aux | grep -E "avatar-pipeline|colmap|blender" | grep -v grep | wc -l
```

### 6.2 当前 job 列表
```bash
curl -sX GET http://localhost:3000/api/avatar/pipeline/jobs -b "auth-token=$JWT" | jq .
```

### 6.3 MinIO 桶大小
```bash
mc du local/qingqiuyue-avatars
```

## 7. 故障排查

### "对象存储暂不可用"
- MinIO 没起来 / `MINIO_*` 环境变量没配 / 凭证错
- `mc ls local/` 验通

### "服务器繁忙,正在跑 N 个 pipeline"
- `MAX_CONCURRENT_PIPELINES` 太低(默认 2);改大
- 或者真有 N 个老 job 卡着(浏览器关了但 job 没死)
  - 找 pgid:`ps aux | grep avatar-pipeline`
  - `kill -TERM -<pgid>`

### Pipeline 卡住不动
- 看实时日志:浏览器 → /avatar-pipeline → 选对应 job → 切到 run 步骤
- 查 ssh 到 server:`tail -f $AVATAR_WORK_ROOT/jobs/<id>/capture.log` 等
- 真死锁 → Cancel 按钮(SIGTERM 整个进程组)

### Blender 启动失败
- `blender --version` 看 PATH
- `apt-get install` 装 graphics libs:`libxi6 libxrender1 libgl1`
- 容器化部署推荐 `linuxserver/blender` 镜像作为基础

### COLMAP 找不到
- `colmap --version` 看是否安装
- 没 GPU 也能跑(慢 5-10x),但要 `colmap` CLI 配 SIFT
- 实在不行跳过 3DGS 勾选 `--skip-3dgs`

### 视频上传失败
- 检查 `MINIO_PUBLIC_ENDPOINT` 能否从浏览器访问
- `mc stat local/qingqiuyue-avatars/uploads/<jobId>/input.mp4` 应能看见
- presigned URL 1h 过期,超时重试

## 8. 升级 / 维护

更新脚本:`bash scripts/avatar-pipeline.sh` 是单一真相,改它即可。
更新前端:`npm run build && pm2 reload web`(假设你用 pm2)。
更新 MinIO bucket policy:不要改成 public,否则绕过权限控制。

## 9. 安全注意

- **不要把 MinIO 桶设成 public**:会导致任何拿到 URL 的人下载产物
- **`JWT_SECRET`** 必须随机长串,不能默认的 `please-change-me-...`
- **`MAX_CONCURRENT_PIPELINES`** 不要设太大:每跑一个 pipeline 占 1 颗 GPU + 多核 CPU
- **定时清理老 job**:工作目录会涨,MinIO 桶也会涨

## 10. 相关文档

- [DIGITAL-HUMAN.md](./DIGITAL-HUMAN.md) — pipeline 脚本 + 数据格式
- `scripts/avatar-pipeline.sh` 头部注释 — bash 实现细节
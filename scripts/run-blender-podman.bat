@echo off
REM 跑 Blender 容器生成写实女性 GLB
set HTTP_PROXY=http://127.0.0.1:7891
set HTTPS_PROXY=http://127.0.0.1:7891
podman run --rm ^
  -v D:\git\really\qingqiuyue-next:/work ^
  -w /work ^
  docker.io/linuxserver/blender:latest ^
  bash -c "blender --background --python scripts/blender/build_avatar.py -- --output public/avatars/model.glb 2>&1 | tail -20"

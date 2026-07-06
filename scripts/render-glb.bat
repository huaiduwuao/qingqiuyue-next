@echo off
set HTTP_PROXY=http://127.0.0.1:7891
set HTTPS_PROXY=http://127.0.0.1:7891
podman run --rm ^
  -v D:\git\really\qingqiuyue-next:/work ^
  -w /work ^
  docker.io/linuxserver/blender:latest ^
  bash -c "blender --background --python scripts/blender-render-glb.py 2>&1 | tail -60"

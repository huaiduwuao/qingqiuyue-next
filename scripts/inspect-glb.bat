@echo off
set HTTP_PROXY=http://127.0.0.1:7891
set HTTPS_PROXY=http://127.0.0.1:7891
podman run --rm ^
  -v D:\git\really\qingqiuyue-next:/work ^
  -w /work ^
  docker.io/linuxserver/blender:latest ^
  bash -c "blender --background --python-expr \"import bpy; bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath='/work/public/avatars/model.glb'); [print(f'  {o.name:30s} {len(o.data.vertices):5d} vertices  loc=({o.location.x:.2f},{o.location.y:.2f},{o.location.z:.2f})') for o in bpy.data.objects if o.type == 'MESH']; print('--- bones ---'); [print(f'  {b.name:20s}  head=({b.head_local.x:.2f},{b.head_local.y:.2f},{b.head_local.z:.2f})') for o in bpy.data.objects if o.type == 'ARMATURE' for b in o.data.bones]\""

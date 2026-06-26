@echo off
set HTTP_PROXY=http://127.0.0.1:7890
set HTTPS_PROXY=http://127.0.0.1:7890
podman run --rm ^
  -v D:\git\really\qingqiuyue-next:/work ^
  -w /work ^
  docker.io/linuxserver/blender:latest ^
  bash -c "blender --background --python-expr \"
import bpy, os
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='/work/public/avatars/model.glb')
# render
bpy.context.scene.camera = bpy.data.objects.get('Camera') or bpy.ops.object.camera_add(location=(0, 0, 0))
scene = bpy.context.scene
# 找或加 camera
if not bpy.data.objects.get('Camera'):
    cam_data = bpy.data.cameras.new('RenderCam')
    cam_obj = bpy.data.objects.new('RenderCam', cam_data)
    bpy.context.collection.objects.link(cam_obj)
    cam_obj.location = (0, -3.5, 1.7)
    cam_obj.rotation_euler = (1.4, 0, 0)
    scene.camera = cam_obj
else:
    scene.camera.location = (0, -3.5, 1.7)
    scene.camera.rotation_euler = (1.4, 0, 0)
# 加 light
bpy.ops.object.light_add(type='SUN', location=(3, 0, 5))
# render
scene.render.resolution_x = 1024
scene.render.resolution_y = 768
scene.render.filepath = '/work/public/avatars/render-test.png'
scene.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True)
print('rendered')
\"
"
"""
Blender 内部 render GLB 看到底长啥样(绕过 web 渲染管线,直接用 Blender 的 Cycles/EEVEE 引擎)
"""
import bpy, sys, os

# 清空场景
bpy.ops.wm.read_factory_settings(use_empty=True)

# 导入 GLB
bpy.ops.import_scene.gltf(filepath='/work/public/avatars/model.glb')

# 加 camera
scene = bpy.context.scene
cam_data = bpy.data.cameras.new('RenderCam')
cam_obj = bpy.data.objects.new('RenderCam', cam_data)
bpy.context.collection.objects.link(cam_obj)
cam_obj.location = (0, -3.5, 1.7)
cam_obj.rotation_euler = (1.4, 0, 0)
scene.camera = cam_obj

# 加 sun light
light_data = bpy.data.lights.new('Sun', type='SUN')
light_obj = bpy.data.objects.new('Sun', light_data)
bpy.context.collection.objects.link(light_obj)
light_obj.location = (3, 0, 5)
light_data.energy = 5

# render 设置
scene.render.resolution_x = 1024
scene.render.resolution_y = 768
scene.render.filepath = '/work/public/avatars/render-test.png'
scene.render.image_settings.file_format = 'PNG'
scene.render.engine = 'BLENDER_EEVEE'  # 或 'CYCLES'

# 列出 mesh 看实际几何
mesh_count = 0
vert_count = 0
print('=== Meshes in scene ===')
for o in bpy.data.objects:
    if o.type == 'MESH':
        mesh_count += 1
        v = len(o.data.vertices)
        loc = o.location
        print(f'  {o.name:30s} {v:5d} verts  loc=({loc.x:.2f},{loc.y:.2f},{loc.z:.2f})  parent={o.parent.name if o.parent else "None"}')
        vert_count += v
print(f'\nTotal: {mesh_count} meshes, {vert_count} verts')

# 渲染
bpy.ops.render.render(write_still=True)
print('\nRendered to /work/public/avatars/render-test.png')

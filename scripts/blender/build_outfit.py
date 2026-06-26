"""
build_outfit.py —— Blender 离线导出多套服装 + 多套场景资产。

完全开源,无 SMPL / 无注册。

输出:
  public/avatars/outfits/
    suit.glb       — 西装(深蓝 + 领带)
    casual.glb     — 休闲(T 恤 + 牛仔)
    sports.glb     — 运动(运动服)
  public/avatars/scenes/
    office.glb     — 办公室场景
    park.glb       — 户外公园
    home.glb       — 居家

用法:
  podman run --rm -v D:/git/really/qingqiuyue-next:/work linuxserver/blender:latest \
    blender --background --python /work/scripts/blender/build_outfit.py
"""

import bpy
import sys
import os
import argparse
from mathutils import Vector, Color


def parse_args():
    argv = sys.argv
    if '--' in argv:
        argv = argv[argv.index('--') + 1:]
    return argv


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m)
    for m in list(bpy.data.materials):
        bpy.data.materials.remove(m)


def make_material(name: str, base_color: tuple, metalness=0.0, roughness=0.6):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        # Principled BSDF input 默认是 RGBA 4 元组(Blender 5)
        bsdf.inputs['Base Color'].default_value = (base_color[0], base_color[1], base_color[2], 1.0)
        bsdf.inputs['Metallic'].default_value = metalness
        bsdf.inputs['Roughness'].default_value = roughness
    return mat


def build_outfit_suit():
    """西装:深蓝外套 + 衬衫 + 领带 + 长裤 — 包含完整 body + skeleton,BlenderAvatar 可整体加载"""
    # 先跑 build_avatar 的逻辑,生成完整身体 + 骨架
    clear_scene()
    body = _build_body_with_armature()
    _add_baseline_blendshapes(body)
    _bake_baseline_animations()

    # 现在覆盖服装 — 删除默认衣服 mesh,加西装
    # 找默认 Body 对象(整个 merged mesh),在它之上加独立的西装圆柱
    # 西装外套
    bpy.ops.mesh.primitive_cylinder_add(radius=0.24, depth=0.72, vertices=16)
    jacket = bpy.context.active_object
    jacket.name = 'Jacket'
    jacket.location = (0, 0, 0.95)
    jacket.data.materials.append(make_material('Jacket', (0.08, 0.12, 0.25, 1), 0.0, 0.4))

    # 衬衫领子
    bpy.ops.mesh.primitive_cone_add(radius1=0.10, radius2=0.06, depth=0.12, vertices=12)
    collar = bpy.context.active_object
    collar.name = 'Collar'
    collar.location = (0, 0, 1.30)
    collar.data.materials.append(make_material('Shirt', (0.95, 0.95, 0.95, 1)))

    # 领带
    bpy.ops.mesh.primitive_cone_add(radius1=0.025, radius2=0.05, depth=0.30, vertices=8)
    tie = bpy.context.active_object
    tie.name = 'Tie'
    tie.location = (0, -0.18, 1.10)
    tie.rotation_euler = (0.2, 0, 0)
    tie.data.materials.append(make_material('Tie', (0.5, 0.0, 0.0, 1)))

    # 长裤覆盖默认裤子 mesh
    bpy.ops.mesh.primitive_cylinder_add(radius=0.085, depth=0.55, vertices=12)
    pants = bpy.context.active_object
    pants.name = 'Pants'
    pants.location = (0, 0, 0.40)
    pants.data.materials.append(make_material('Pants', (0.05, 0.05, 0.10, 1)))

    # 鞋子覆盖默认
    for sign in (-1, +1):
        bpy.ops.mesh.primitive_cube_add(size=0.13)
        shoe = bpy.context.active_object
        shoe.name = f'Shoe_{sign}'
        shoe.location = (sign * 0.08, 0.06, 0.05)
        shoe.scale = (0.7, 1.5, 0.5)
        shoe.data.materials.append(make_material('Shoe', (0.05, 0.05, 0.05, 1)))
    return bpy.context.active_object


def build_outfit_casual():
    """休闲:白 T 恤 + 牛仔"""
    clear_scene()
    body = _build_body_with_armature()
    _add_baseline_blendshapes(body)
    _bake_baseline_animations()

    bpy.ops.mesh.primitive_cylinder_add(radius=0.22, depth=0.65, vertices=16)
    torso = bpy.context.active_object
    torso.name = 'TShirt'
    torso.location = (0, 0, 0.97)
    torso.data.materials.append(make_material('TShirt', (0.95, 0.95, 0.95, 1)))

    bpy.ops.mesh.primitive_cylinder_add(radius=0.085, depth=0.55, vertices=12)
    pants = bpy.context.active_object
    pants.name = 'Pants'
    pants.location = (0, 0, 0.40)
    pants.data.materials.append(make_material('Jeans', (0.15, 0.25, 0.55, 1)))

    for sign in (-1, +1):
        bpy.ops.mesh.primitive_cube_add(size=0.13)
        shoe = bpy.context.active_object
        shoe.name = f'Shoe_{sign}'
        shoe.location = (sign * 0.08, 0.06, 0.05)
        shoe.scale = (0.7, 1.5, 0.5)
        shoe.data.materials.append(make_material('Sneaker', (1, 1, 1, 1)))
    return bpy.context.active_object


def build_outfit_sports():
    """运动:运动上衣 + 短裤"""
    clear_scene()
    body = _build_body_with_armature()
    _add_baseline_blendshapes(body)
    _bake_baseline_animations()

    bpy.ops.mesh.primitive_cylinder_add(radius=0.22, depth=0.60, vertices=16)
    torso = bpy.context.active_object
    torso.name = 'SportTop'
    torso.location = (0, 0, 1.0)
    torso.data.materials.append(make_material('SportTop', (0.95, 0.30, 0.20, 1)))

    bpy.ops.mesh.primitive_cylinder_add(radius=0.08, depth=0.30, vertices=12)
    shorts = bpy.context.active_object
    shorts.name = 'Shorts'
    shorts.location = (0, 0, 0.55)
    shorts.data.materials.append(make_material('Shorts', (0.10, 0.10, 0.10, 1)))

    for sign in (-1, +1):
        bpy.ops.mesh.primitive_cube_add(size=0.13)
        shoe = bpy.context.active_object
        shoe.name = f'Shoe_{sign}'
        shoe.location = (sign * 0.08, 0.06, 0.05)
        shoe.scale = (0.7, 1.5, 0.5)
        shoe.data.materials.append(make_material('Sneaker', (1, 1, 1, 1)))
    return bpy.context.active_object


# ============ 复用 build_avatar.py 的核心 ============

def _build_body_with_armature():
    """从 build_avatar.py 复用,生成 body + skeleton 的最小子集。"""
    # Body primitives(头 + 躯干 + 四肢)
    height = 1.75
    head_h = height * 0.13
    torso_h = height * 0.40
    arm_h = height * 0.32
    leg_h = height * 0.48
    body_w = height * 0.22
    head_w = height * 0.10

    bpy.ops.mesh.primitive_uv_sphere_add(radius=head_w / 2, segments=24, ring_count=16)
    head = bpy.context.active_object
    head.name = 'Head'
    head.location = (0, 0, leg_h + torso_h + head_h / 2)

    bpy.ops.mesh.primitive_cylinder_add(radius=body_w / 2, depth=torso_h, vertices=16)
    torso = bpy.context.active_object
    torso.name = 'Torso'
    torso.location = (0, 0, leg_h + torso_h / 2)

    for sign in (-1, +1):
        bpy.ops.mesh.primitive_cylinder_add(radius=body_w / 8, depth=arm_h, vertices=12)
        arm = bpy.context.active_object
        arm.name = 'Arm_' + ('L' if sign < 0 else 'R')
        arm.location = (sign * (body_w / 2 + body_w / 16), 0, leg_h + torso_h - arm_h / 4)

    for sign in (-1, +1):
        bpy.ops.mesh.primitive_cylinder_add(radius=body_w / 6, depth=leg_h, vertices=12)
        leg = bpy.context.active_object
        leg.name = 'Leg_' + ('L' if sign < 0 else 'R')
        leg.location = (sign * body_w / 8, 0, leg_h / 2)

    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.join()
    body = bpy.context.active_object
    body.name = 'Body'

    # 骨架
    bpy.ops.object.armature_add()
    armature = bpy.context.active_object
    armature.name = 'Armature'
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.armature.select_all(action='SELECT')
    bpy.ops.armature.delete()

    bpy.ops.armature.bone_primitive_add(name='Root')
    root = armature.data.edit_bones['Root']
    root.head = (0, 0, 0)
    root.tail = (0, 0, 0.05)

    pelvis = armature.data.edit_bones.new('Pelvis')
    pelvis.parent = root
    pelvis.head = (0, 0, leg_h)
    pelvis.tail = (0, 0, leg_h + 0.05)

    spine = armature.data.edit_bones.new('Spine')
    spine.parent = pelvis
    spine.head = (0, 0, leg_h)
    spine.tail = (0, 0, leg_h + torso_h)

    head_b = armature.data.edit_bones.new('Head')
    head_b.parent = spine
    head_b.head = (0, 0, leg_h + torso_h)
    head_b.tail = (0, 0, leg_h + torso_h + head_h)

    for sign, side in ((-1, 'L'), (+1, 'R')):
        shoulder = armature.data.edit_bones.new('Shoulder_' + side)
        shoulder.parent = spine
        shoulder.head = (sign * body_w / 2, 0, leg_h + torso_h - arm_h / 8)
        shoulder.tail = (sign * (body_w / 2 + body_w / 8), 0, leg_h + torso_h - arm_h / 4)

        elbow = armature.data.edit_bones.new('Elbow_' + side)
        elbow.parent = shoulder
        elbow.head = (sign * (body_w / 2 + body_w / 8), 0, leg_h + torso_h - arm_h / 4)
        elbow.tail = (sign * (body_w / 2 + body_w / 4), 0, leg_h + arm_h / 8)

        hand = armature.data.edit_bones.new('Hand_' + side)
        hand.parent = elbow
        hand.head = (sign * (body_w / 2 + body_w / 4), 0, leg_h + arm_h / 8)
        hand.tail = (sign * (body_w / 2 + body_w / 3), 0, leg_h)

    for sign, side in ((-1, 'L'), (+1, 'R')):
        hip = armature.data.edit_bones.new('Hip_' + side)
        hip.parent = pelvis
        hip.head = (sign * body_w / 8, 0, leg_h)
        hip.tail = (sign * body_w / 8, 0, leg_h - 0.05)

        knee = armature.data.edit_bones.new('Knee_' + side)
        knee.parent = hip
        knee.head = (sign * body_w / 8, 0, leg_h - 0.05)
        knee.tail = (sign * body_w / 8, 0, leg_h / 2)

        foot = armature.data.edit_bones.new('Foot_' + side)
        foot.parent = knee
        foot.head = (sign * body_w / 8, 0, leg_h / 2)
        foot.tail = (sign * body_w / 8, 0.05, 0)

    bpy.ops.object.mode_set(mode='OBJECT')

    # 绑定
    body.select_set(True)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')

    return body


def _add_baseline_blendshapes(body):
    """基础 BlendShape(smile / blink / aa / 6 个 viseme)。"""
    mesh = body
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.shape_key_add(from_mix=False)

    def add_skshape(name, scale_z=1.0, scale_x=1.0, scale_y=1.0, dz=0.0, dy=0.0, dx=0.0):
        bpy.ops.object.shape_key_add(from_mix=False)
        kb = mesh.data.shape_keys.key_blocks[-1]
        kb.name = name
        for i, v in enumerate(mesh.data.vertices):
            if v.co.z > 1.0:
                kb.data[i].co = (
                    v.co.x * scale_x + dx,
                    v.co.y * scale_y + dy,
                    v.co.z * scale_z + dz,
                )
            else:
                kb.data[i].co = v.co

    for shape, scale_z, dy in [
        ('smile', 1.0, 0.0),
        ('blink', 0.1, -0.02),
        ('aa', 1.2, 0.03),
        ('sad', 1.0, -0.01),
        ('angry', 1.0, 0.005),
        ('surprised', 1.4, 0.05),
        ('ih', 1.1, 0.02),
        ('ou', 1.15, 0.02),
        ('E', 1.05, 0.01),
        ('O', 1.1, 0.015),
        ('U', 1.05, 0.005),
        ('closed', 0.95, 0),
    ]:
        add_skshape(shape, scale_z, dy)


def _bake_baseline_animations():
    """基础 idle / wave / walk 动画。"""
    import math as _math
    armature = bpy.data.objects.get('Armature')
    if not armature:
        return
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = 60
    scene.render.fps = 30

    def bake(name, frames_fn):
        action = bpy.data.actions.new(name)
        if not armature.animation_data:
            armature.animation_data_create()
        armature.animation_data.action = action
        if not armature.animation_data:
            return
        armature.animation_data.action = action
        bones = {b.name: b for b in armature.pose.bones}
        for f in range(1, 61):
            scene.frame_set(f)
            frames_fn(f, bones)
            for b in bones.values():
                b.keyframe_insert(data_path='rotation_euler', frame=f)

    def idle_fn(f, bones):
        phase = (f / 60.0) * 2 * _math.pi
        h = bones.get('Head')
        if h:
            h.rotation_euler = (_math.sin(phase) * 0.05, 0, _math.sin(phase * 0.5) * 0.03)
        s = bones.get('Spine')
        if s:
            s.rotation_euler = (_math.sin(phase * 0.7) * 0.02, 0, 0)

    def wave_fn(f, bones):
        phase = (f / 60.0) * 2 * _math.pi
        rs = bones.get('Shoulder_R')
        re = bones.get('Elbow_R')
        if rs:
            rs.rotation_euler = (0, -2.5 + _math.sin(phase) * 0.3, -0.3)
        if re:
            re.rotation_euler = (0, -2.0, 0)

    def walk_fn(f, bones):
        phase = (f / 60.0) * 2 * _math.pi
        for name, off in (('Knee_L', 0), ('Knee_R', _math.pi),
                          ('Shoulder_L', _math.pi), ('Shoulder_R', 0)):
            b = bones.get(name)
            if b:
                b.rotation_euler = (_math.sin(phase + off) * 0.5, 0, 0)

    bake('idle', idle_fn)
    bake('wave', wave_fn)
    bake('walk', walk_fn)


def build_scene_office():
    """办公室场景:书桌 + 椅子 + 电脑 + 书架"""
    clear_scene()
    # 地面
    bpy.ops.mesh.primitive_plane_add(size=10)
    floor = bpy.context.active_object
    floor.name = 'Floor'
    floor.data.materials.append(make_material('Floor', (0.6, 0.6, 0.6, 1), 0.0, 0.8))

    # 书桌
    bpy.ops.mesh.primitive_cube_add(size=1)
    desk = bpy.context.active_object
    desk.name = 'Desk'
    desk.location = (0, -1.5, 0.75)
    desk.scale = (1.5, 0.8, 0.05)
    desk.data.materials.append(make_material('Wood', (0.4, 0.25, 0.15, 1)))

    # 显示器
    bpy.ops.mesh.primitive_cube_add(size=0.6)
    monitor = bpy.context.active_object
    monitor.name = 'Monitor'
    monitor.location = (0, -1.5, 1.4)
    monitor.scale = (1.0, 0.05, 0.6)
    monitor.data.materials.append(make_material('Screen', (0.05, 0.05, 0.05, 1)))

    # 椅子
    bpy.ops.mesh.primitive_cube_add(size=0.5)
    chair = bpy.context.active_object
    chair.name = 'Chair'
    chair.location = (0, 0, 0.25)
    chair.scale = (0.5, 0.5, 0.5)
    chair.data.materials.append(make_material('Chair', (0.2, 0.2, 0.2, 1)))

    # 墙
    bpy.ops.mesh.primitive_plane_add(size=8)
    wall = bpy.context.active_object
    wall.name = 'Wall'
    wall.location = (0, 3, 2)
    wall.scale = (1.5, 1, 1)
    wall.data.materials.append(make_material('Wall', (0.9, 0.9, 0.85, 1)))

    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.join()
    return bpy.context.active_object


def build_scene_park():
    """户外公园:草地 + 树 + 天空盒"""
    clear_scene()
    # 草地
    bpy.ops.mesh.primitive_plane_add(size=20)
    ground = bpy.context.active_object
    ground.name = 'Ground'
    ground.data.materials.append(make_material('Grass', (0.30, 0.55, 0.20, 1)))

    # 树(用圆柱模拟)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.15, depth=3, vertices=8)
    trunk = bpy.context.active_object
    trunk.name = 'TreeTrunk'
    trunk.location = (3, 0, 1.5)
    trunk.data.materials.append(make_material('Trunk', (0.45, 0.30, 0.15, 1)))

    bpy.ops.mesh.primitive_uv_sphere_add(radius=1.2, segments=16, ring_count=12)
    leaves = bpy.context.active_object
    leaves.name = 'TreeLeaves'
    leaves.location = (3, 0, 4.0)
    leaves.data.materials.append(make_material('Leaves', (0.15, 0.50, 0.15, 1)))

    # 天空盒背景(简单 sphere 内部)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=30, segments=16, ring_count=8)
    sky = bpy.context.active_object
    sky.name = 'Sky'
    sky.data.materials.append(make_material('Sky', (0.55, 0.78, 0.92, 1)))

    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.join()
    return bpy.context.active_object


def export_glb(path, name):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        bpy.ops.export_scene.gltf(
            filepath=path, export_format='GLB', export_apply=True,
            export_animations=True, export_morph=True, export_skins=True,
        )
    except TypeError:
        bpy.ops.export_scene.gltf(
            filepath=path, export_format='GLB', export_apply=True,
            export_animations=True, export_morph=True, export_skins=True,
            export_armature=True,
        )
    sz = os.path.getsize(path) / 1024
    print(f'  ✓ {name}: {path} ({sz:.1f} KB)')


def main():
    argv = parse_args()

    out_root = argv[argv.index('--output') + 1] if '--output' in argv else '/work/public/avatars'
    print(f'输出根目录: {out_root}')

    print('--- 导出服装 ---')
    for fn, name in [
        (build_outfit_suit, 'suit'),
        (build_outfit_casual, 'casual'),
        (build_outfit_sports, 'sports'),
    ]:
        fn()
        export_glb(f'{out_root}/outfits/{name}.glb', name)

    print('--- 导出场景 ---')
    for fn, name in [
        (build_scene_office, 'office'),
        (build_scene_park, 'park'),
    ]:
        fn()
        export_glb(f'{out_root}/scenes/{name}.glb', name)

    print('完成!')


if __name__ == '__main__':
    main()
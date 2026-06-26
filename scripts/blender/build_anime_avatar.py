"""
build_anime_avatar.py —— Blender 程序化生成二次元风格角色

完全脚本化,无外部资源,无 SMPL/FLAME/license 限制。
每个角色 ~30 秒生成,直接出可驱动 GLB(rig + 12 BlendShape + 3 action)。

支持的 10 个预制角色(见 LIBRARY):
  1. aoi    - 黑色长发 / 蓝色眼 / 学校制服
  2. yuki   - 银色双马尾 / 粉色眼 / 白裙
  3. mei    - 棕色波波头 / 绿色眼 / 休闲
  4. hana   - 粉色马尾 / 红色眼 / 西装
  5. ren    - 金色短发 / 金色眼 / 运动
  6. sora   - 紫色中发 / 紫色眼 / 休闲
  7. akira  - 深蓝刺猬 / 橙色眼 / 夹克
  8. yuna   - 白色长发 / 天蓝眼 / 和服
  9. kaito  - 棕色斜刘海 / 棕色眼 / 卫衣
  10. rin   - 红色中发 / 金色眼 / 朋克

用法:
  # 生成所有 10 个 + library.json
  blender --background --python scripts/blender/build_anime_avatar.py -- \
      --output public/avatars/library/

  # 只生成单个
  blender --background --python scripts/blender/build_anime_avatar.py -- \
      --output public/avatars/library/ --only aoi
"""

import bpy
import sys
import os
import math
import json
import argparse
from mathutils import Vector, Color

# 共享 rig / 导出
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _rig_template import (
    clear_scene, build_armature, bind_mesh, add_basic_blendshapes,
    make_idle_action, make_wave_action, make_walk_action, export_glb,
)


# ── 10 个角色定义 ──────────────────────────────────────

LIBRARY = [
    {
        'id': 'aoi', 'name': 'Aoi', 'name_zh': '蒼',
        'description': '黑色长发 · 蓝色眼 · 学校制服',
        'height': 1.60, 'chibi': True,
        'hair': {'style': 'long', 'color': (0.04, 0.04, 0.06, 1)},
        'eyes': {'color': (0.20, 0.45, 0.85, 1), 'size': 'big'},
        'outfit': 'school', 'accent': (0.10, 0.20, 0.45, 1),
    },
    {
        'id': 'yuki', 'name': 'Yuki', 'name_zh': '雪',
        'description': '银色双马尾 · 粉色眼 · 白裙',
        'height': 1.55, 'chibi': True,
        'hair': {'style': 'twintail', 'color': (0.92, 0.92, 0.95, 1)},
        'eyes': {'color': (0.95, 0.70, 0.80, 1), 'size': 'big'},
        'outfit': 'dress', 'accent': (0.95, 0.85, 0.90, 1),
    },
    {
        'id': 'mei', 'name': 'Mei', 'name_zh': '芽衣',
        'description': '棕色波波头 · 绿色眼 · 休闲 T 恤',
        'height': 1.58, 'chibi': True,
        'hair': {'style': 'bob', 'color': (0.45, 0.28, 0.18, 1)},
        'eyes': {'color': (0.30, 0.65, 0.40, 1), 'size': 'big'},
        'outfit': 'casual', 'accent': (0.85, 0.45, 0.30, 1),
    },
    {
        'id': 'hana', 'name': 'Hana', 'name_zh': '花',
        'description': '粉色马尾 · 红色眼 · 商务西装',
        'height': 1.65, 'chibi': True,
        'hair': {'style': 'ponytail', 'color': (1.0, 0.65, 0.78, 1)},
        'eyes': {'color': (0.85, 0.20, 0.20, 1), 'size': 'big'},
        'outfit': 'suit', 'accent': (0.20, 0.20, 0.30, 1),
    },
    {
        'id': 'ren', 'name': 'Ren', 'name_zh': '蓮',
        'description': '金色短发 · 金色眼 · 运动套装',
        'height': 1.72, 'chibi': True,
        'hair': {'style': 'short', 'color': (1.0, 0.85, 0.30, 1)},
        'eyes': {'color': (1.0, 0.75, 0.20, 1), 'size': 'big'},
        'outfit': 'sport', 'accent': (0.20, 0.55, 0.85, 1),
    },
    {
        'id': 'sora', 'name': 'Sora', 'name_zh': '空',
        'description': '紫色中发 · 紫色眼 · 休闲卫衣',
        'height': 1.62, 'chibi': True,
        'hair': {'style': 'medium', 'color': (0.45, 0.30, 0.65, 1)},
        'eyes': {'color': (0.55, 0.30, 0.75, 1), 'size': 'big'},
        'outfit': 'casual', 'accent': (0.55, 0.40, 0.75, 1),
    },
    {
        'id': 'akira', 'name': 'Akira', 'name_zh': '晶',
        'description': '深蓝刺猬头 · 橙色眼 · 皮夹克',
        'height': 1.70, 'chibi': True,
        'hair': {'style': 'spiky', 'color': (0.10, 0.15, 0.45, 1)},
        'eyes': {'color': (1.0, 0.55, 0.15, 1), 'size': 'big'},
        'outfit': 'jacket', 'accent': (0.10, 0.10, 0.15, 1),
    },
    {
        'id': 'yuna', 'name': 'Yuna', 'name_zh': '結',
        'description': '白色长发 · 天蓝眼 · 和服',
        'height': 1.58, 'chibi': True,
        'hair': {'style': 'long', 'color': (0.95, 0.95, 0.92, 1)},
        'eyes': {'color': (0.50, 0.78, 0.95, 1), 'size': 'big'},
        'outfit': 'kimono', 'accent': (0.85, 0.30, 0.45, 1),
    },
    {
        'id': 'kaito', 'name': 'Kaito', 'name_zh': '海斗',
        'description': '棕色斜刘海 · 棕色眼 · 卫衣',
        'height': 1.68, 'chibi': True,
        'hair': {'style': 'side_swept', 'color': (0.35, 0.22, 0.15, 1)},
        'eyes': {'color': (0.40, 0.28, 0.18, 1), 'size': 'big'},
        'outfit': 'hoodie', 'accent': (0.55, 0.55, 0.60, 1),
    },
    {
        'id': 'rin', 'name': 'Rin', 'name_zh': '凛',
        'description': '红色中发 · 金色眼 · 朋克风',
        'height': 1.60, 'chibi': True,
        'hair': {'style': 'medium', 'color': (0.80, 0.15, 0.15, 1)},
        'eyes': {'color': (1.0, 0.80, 0.20, 1), 'size': 'big'},
        'outfit': 'punk', 'accent': (0.15, 0.15, 0.15, 1),
    },
]


# ── 几何体 helpers ──────────────────────────────────────

def make_skin_material(name='Skin', skin_tone=(0.96, 0.82, 0.74, 1)):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = skin_tone
    bsdf.inputs['Roughness'].default_value = 0.5
    return mat


def make_solid_material(name, color):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value = 0.6
    return mat


def make_eye_material(name='Eye', iris_color=(0.2, 0.5, 0.9, 1)):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (0.98, 0.98, 0.95, 1)
    bsdf.inputs['Roughness'].default_value = 0.05
    return mat


def make_iris_material(name='Iris', iris_color=(0.2, 0.5, 0.9, 1)):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = iris_color
    bsdf.inputs['Roughness'].default_value = 0.2
    return mat


def make_hair_material(name='Hair', hair_color=(0.05, 0.05, 0.05, 1)):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = hair_color
    bsdf.inputs['Roughness'].default_value = 0.4
    return mat


def merge_all():
    """合并所有可见 mesh 为单对象(便于绑骨)。"""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.join()
    return bpy.context.view_layer.objects.active


# ── 角色身体构建 ──────────────────────────────────────

def build_anime_body(cfg):
    """按 config 构造一个二次元风格的人体。返回单 body mesh。"""
    clear_scene()

    h = cfg['height']
    chibi = cfg.get('chibi', True)
    # chibi 比例:头大身小
    head_size_factor = 1.6 if chibi else 1.0

    head_h = h * 0.18 * head_size_factor  # 头占 18% 身高
    torso_h = h * 0.30
    arm_h = h * 0.28
    leg_h = h * 0.40
    body_w = h * 0.16
    head_w = h * 0.12 * head_size_factor  # 头宽

    # 材质
    skin = make_skin_material(f'Skin_{cfg["id"]}')
    hair = make_hair_material(f'Hair_{cfg["id"]}', cfg['hair']['color'])
    eye_white = make_eye_material(f'Eye_{cfg["id"]}')
    iris = make_iris_material(f'Iris_{cfg["id"]}', cfg['eyes']['color'])
    outfit = make_solid_material(f'Outfit_{cfg["id"]}', cfg['accent'])

    # 头部(UV 球,大二次元头)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=head_w / 2, segments=32, ring_count=24)
    head = bpy.context.active_object
    head.name = 'Head'
    head.location = (0, 0, leg_h + torso_h + head_h / 2)
    head.data.materials.append(skin)

    # 头发(根据 style)
    build_hair(cfg['hair']['style'], head_w, head_h, leg_h + torso_h, hair)

    # 大二次元眼睛(两个大球 + 虹膜)
    eye_offset_x = head_w * 0.20
    eye_z = leg_h + torso_h + head_h * 0.55
    eye_y = -head_w * 0.30
    eye_r = head_w * 0.10 if cfg['eyes']['size'] == 'big' else head_w * 0.07
    for sign in (-1, +1):
        # 眼白
        bpy.ops.mesh.primitive_uv_sphere_add(radius=eye_r, segments=16, ring_count=12)
        e = bpy.context.active_object
        e.name = f'Eye_{"L" if sign < 0 else "R"}'
        e.location = (sign * eye_offset_x, eye_y, eye_z)
        e.scale = (1.0, 0.65, 1.0)
        e.data.materials.append(eye_white)
        # 虹膜(略小,叠在前面)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=eye_r * 0.65, segments=16, ring_count=12)
        ir = bpy.context.active_object
        ir.name = f'Iris_{"L" if sign < 0 else "R"}'
        ir.location = (sign * eye_offset_x, eye_y - eye_r * 0.35, eye_z)
        ir.scale = (1.0, 0.4, 1.0)
        ir.data.materials.append(iris)

    # 嘴(小)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=head_w * 0.04, segments=12, ring_count=8)
    mouth = bpy.context.active_object
    mouth.name = 'Mouth'
    mouth.location = (0, -head_w * 0.40, leg_h + torso_h + head_h * 0.30)
    mouth.scale = (1.8, 0.3, 0.5)
    mouth.data.materials.append(skin)

    # 躯干
    bpy.ops.mesh.primitive_cylinder_add(radius=body_w / 2, depth=torso_h, vertices=16)
    torso = bpy.context.active_object
    torso.name = 'Torso'
    torso.location = (0, 0, leg_h + torso_h / 2)
    torso.data.materials.append(outfit)

    # 手臂
    for sign in (-1, +1):
        bpy.ops.mesh.primitive_cylinder_add(radius=body_w / 10, depth=arm_h, vertices=12)
        arm = bpy.context.active_object
        arm.name = f'Arm_{"L" if sign < 0 else "R"}'
        arm.location = (sign * (body_w / 2 + body_w / 12), 0, leg_h + torso_h - arm_h / 4)
        arm.data.materials.append(skin)
        # 手
        bpy.ops.mesh.primitive_uv_sphere_add(radius=body_w / 6, segments=12, ring_count=8)
        h_sphere = bpy.context.active_object
        h_sphere.name = f'Hand_{"L" if sign < 0 else "R"}'
        h_sphere.location = (sign * (body_w / 2 + body_w / 6), 0, leg_h + arm_h / 8)
        h_sphere.scale = (0.7, 1.3, 0.5)
        h_sphere.data.materials.append(skin)

    # 腿
    for sign in (-1, +1):
        bpy.ops.mesh.primitive_cylinder_add(radius=body_w / 7, depth=leg_h, vertices=12)
        leg = bpy.context.active_object
        leg.name = f'Leg_{"L" if sign < 0 else "R"}'
        leg.location = (sign * body_w / 10, 0, leg_h / 2)
        leg.data.materials.append(outfit)
        # 鞋
        bpy.ops.mesh.primitive_cube_add(size=0.10)
        shoe = bpy.context.active_object
        shoe.name = f'Shoe_{"L" if sign < 0 else "R"}'
        shoe.location = (sign * body_w / 10, 0.04, 0.04)
        shoe.scale = (0.7, 1.3, 0.5)
        shoe.data.materials.append(make_solid_material(f'Shoe_{cfg["id"]}', (0.05, 0.05, 0.05, 1)))

    body = merge_all()
    body.name = 'Body'
    return body


def build_hair(style, head_w, head_h, base_z, hair_mat):
    """按 style 加头发(若干小球/块)。"""
    if style == 'long':
        # 后部大块 + 两侧垂下
        bpy.ops.mesh.primitive_uv_sphere_add(radius=head_w * 0.55, segments=16, ring_count=12)
        h = bpy.context.active_object
        h.name = 'Hair_back'
        h.location = (0, -head_w * 0.25, base_z + head_h * 0.55)
        h.scale = (1.0, 0.5, 1.3)
        h.data.materials.append(hair_mat)
        # 顶部
        bpy.ops.mesh.primitive_uv_sphere_add(radius=head_w * 0.55, segments=16, ring_count=12)
        h = bpy.context.active_object
        h.name = 'Hair_top'
        h.location = (0, 0, base_z + head_h * 0.85)
        h.scale = (1.05, 1.0, 0.6)
        h.data.materials.append(hair_mat)
    elif style == 'twintail':
        # 两侧各一个长球
        for sign in (-1, +1):
            bpy.ops.mesh.primitive_uv_sphere_add(radius=head_w * 0.18, segments=12, ring_count=10)
            t = bpy.context.active_object
            t.name = f'Twintail_{"L" if sign < 0 else "R"}'
            t.location = (sign * head_w * 0.55, -head_w * 0.10, base_z + head_h * 0.45)
            t.scale = (0.7, 0.7, 2.5)
            t.data.materials.append(hair_mat)
        # 顶部
        bpy.ops.mesh.primitive_uv_sphere_add(radius=head_w * 0.55, segments=16, ring_count=12)
        h = bpy.context.active_object
        h.name = 'Hair_top'
        h.location = (0, 0, base_z + head_h * 0.85)
        h.scale = (1.0, 1.0, 0.6)
        h.data.materials.append(hair_mat)
    elif style == 'bob':
        bpy.ops.mesh.primitive_uv_sphere_add(radius=head_w * 0.60, segments=16, ring_count=12)
        h = bpy.context.active_object
        h.name = 'Hair_bob'
        h.location = (0, 0, base_z + head_h * 0.55)
        h.scale = (1.1, 1.0, 0.85)
        h.data.materials.append(hair_mat)
    elif style == 'ponytail':
        bpy.ops.mesh.primitive_uv_sphere_add(radius=head_w * 0.55, segments=16, ring_count=12)
        h = bpy.context.active_object
        h.name = 'Hair_top'
        h.location = (0, 0, base_z + head_h * 0.85)
        h.scale = (1.0, 1.0, 0.6)
        h.data.materials.append(hair_mat)
        # 后方长马尾
        bpy.ops.mesh.primitive_uv_sphere_add(radius=head_w * 0.18, segments=12, ring_count=10)
        t = bpy.context.active_object
        t.name = 'Ponytail'
        t.location = (0, -head_w * 0.55, base_z + head_h * 0.40)
        t.scale = (0.8, 0.8, 2.2)
        t.data.materials.append(hair_mat)
    elif style == 'short':
        bpy.ops.mesh.primitive_uv_sphere_add(radius=head_w * 0.55, segments=16, ring_count=12)
        h = bpy.context.active_object
        h.name = 'Hair_short'
        h.location = (0, 0, base_z + head_h * 0.70)
        h.scale = (1.05, 1.0, 0.7)
        h.data.materials.append(hair_mat)
    elif style == 'medium':
        bpy.ops.mesh.primitive_uv_sphere_add(radius=head_w * 0.58, segments=16, ring_count=12)
        h = bpy.context.active_object
        h.name = 'Hair_medium'
        h.location = (0, 0, base_z + head_h * 0.65)
        h.scale = (1.05, 1.0, 0.8)
        h.data.materials.append(hair_mat)
        # 后部
        bpy.ops.mesh.primitive_uv_sphere_add(radius=head_w * 0.40, segments=12, ring_count=10)
        hb = bpy.context.active_object
        hb.name = 'Hair_back'
        hb.location = (0, -head_w * 0.30, base_z + head_h * 0.40)
        hb.scale = (1.0, 0.6, 0.7)
        hb.data.materials.append(hair_mat)
    elif style == 'spiky':
        # 多个尖刺
        for i in range(7):
            angle = (i / 7) * 2 * math.pi
            bpy.ops.mesh.primitive_cone_add(radius1=0, radius2=head_w * 0.10, depth=head_w * 0.30, vertices=8)
            sp = bpy.context.active_object
            sp.name = f'Spike_{i}'
            sp.location = (
                math.cos(angle) * head_w * 0.50,
                math.sin(angle) * head_w * 0.10,
                base_z + head_h * 0.85,
            )
            sp.rotation_euler = (math.radians(-90 - 15), 0, 0)
            sp.data.materials.append(hair_mat)
    elif style == 'side_swept':
        bpy.ops.mesh.primitive_uv_sphere_add(radius=head_w * 0.55, segments=16, ring_count=12)
        h = bpy.context.active_object
        h.name = 'Hair_top'
        h.location = (head_w * 0.10, 0, base_z + head_h * 0.75)
        h.scale = (1.0, 1.0, 0.7)
        h.data.materials.append(hair_mat)
        # 斜刘海
        bpy.ops.mesh.primitive_uv_sphere_add(radius=head_w * 0.18, segments=12, ring_count=10)
        bs = bpy.context.active_object
        bs.name = 'Bang'
        bs.location = (head_w * 0.25, -head_w * 0.20, base_z + head_h * 0.75)
        bs.scale = (1.2, 0.6, 0.4)
        bs.data.materials.append(hair_mat)


# ── 缩略图 ──────────────────────────────────────

def render_thumbnail(cfg, glb_path, output_dir):
    """导完 GLB 后,导入再渲一张 256x256 缩略图。"""
    # 清空
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

    try:
        bpy.ops.import_scene.gltf(filepath=glb_path)
    except Exception as e:
        print(f'[anime] 导入 {glb_path} 失败: {e}')
        return

    # 简单相机 + 灯光
    scene = bpy.context.scene
    scene.render.resolution_x = 256
    scene.render.resolution_y = 256
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'

    # 找中心
    objs = [o for o in scene.objects if o.type == 'MESH']
    if not objs:
        return
    center = Vector((0, 0, 0))
    for o in objs:
        center += o.location
    center /= len(objs)

    # 相机
    bpy.ops.object.camera_add(location=(center.x, center.y - 2.5, center.z + 0.3))
    cam = bpy.context.active_object
    cam.rotation_euler = (math.radians(78), 0, 0)
    scene.camera = cam

    # 灯光
    bpy.ops.object.light_add(type='SUN', location=(2, 0, 5))
    bpy.context.active_object.data.energy = 2.0

    thumb_path = os.path.join(output_dir, f"{cfg['id']}.png")
    scene.render.filepath = thumb_path
    bpy.ops.render.render(write_still=True)
    print(f'[anime] 缩略图: {thumb_path}')


# ── 单个角色生成 ──────────────────────────────────────

def generate_one(cfg, output_dir):
    print(f"\n[anime] === 生成 {cfg['id']} ({cfg['name']}) ===")

    # 1. body
    body = build_anime_body(cfg)
    print(f'[anime] body 构建完成: {body.name}')

    # 2. 骨骼(身高 + 头在 1.6m 以上,正常 rig)
    armature = build_armature(cfg['height'])
    print(f'[anime] 骨架: {len(armature.data.bones)} bones')

    # 3. 自动绑骨
    bind_mesh(body, armature)
    print('[anime] 自动权重绑骨完成')

    # 4. BlendShape(12 个)
    keys = add_basic_blendshapes(body)
    print(f'[anime] BlendShape: {keys}')

    # 5. 3 个 baked action
    make_idle_action(armature)
    make_wave_action(armature)
    make_walk_action(armature)
    print('[anime] 3 个 baked action 完成')

    # 6. 导出 GLB
    os.makedirs(output_dir, exist_ok=True)
    glb_path = os.path.join(output_dir, f"{cfg['id']}.glb")
    export_glb(glb_path, cfg['id'])
    print(f'[anime] GLB: {glb_path}')

    # 7. 缩略图
    render_thumbnail(cfg, glb_path, output_dir)

    return glb_path


# ── 批量入口 ──────────────────────────────────────

def main():
    argv = sys.argv
    if '--' in argv:
        argv = argv[argv.index('--') + 1:]
    else:
        argv = []
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default='public/avatars/library/',
                        help='输出目录(每个角色一个 .glb + .png)')
    parser.add_argument('--only', default=None,
                        help='只生成指定 id(如 aoi)')
    args = parser.parse_args(argv)

    targets = LIBRARY
    if args.only:
        targets = [c for c in LIBRARY if c['id'] == args.only]
        if not targets:
            print(f'[anime] 找不到 id: {args.only}')
            sys.exit(1)

    # 跑
    os.makedirs(args.output, exist_ok=True)
    for cfg in targets:
        try:
            generate_one(cfg, args.output)
        except Exception as e:
            import traceback
            print(f'[anime] {cfg["id"]} 生成失败: {e}')
            traceback.print_exc()

    # 写 library.json
    lib = {
        'version': 1,
        'characters': [
            {
                'id': c['id'],
                'name': c['name'],
                'name_zh': c['name_zh'],
                'description': c['description'],
                'height': c['height'],
                'hair_style': c['hair']['style'],
                'hair_color': list(c['hair']['color']),
                'eye_color': list(c['eyes']['color']),
                'outfit': c['outfit'],
                'thumbnail': f"/avatars/library/{c['id']}.png",
                'model': f"/avatars/library/{c['id']}.glb",
            }
            for c in targets
        ],
    }
    lib_path = os.path.join(args.output, 'library.json')
    with open(lib_path, 'w', encoding='utf-8') as f:
        json.dump(lib, f, ensure_ascii=False, indent=2)
    print(f'\n[anime] library.json: {lib_path}')
    print(f'[anime] 完成 {len(targets)} 个角色')


if __name__ == '__main__':
    main()

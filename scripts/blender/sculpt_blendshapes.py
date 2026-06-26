"""
sculpt_blendshapes.py —— 真实 BlendShape 雕刻(适用于任意 mesh)

12 个 BlendShape:
  表情:smile / blink / sad / angry / surprised
  口型:aa / ih / ou / E / O / U / closed

不依赖 z > 1.0 的启发式 —— 直接按 bbox 顶部 30% 找头部区域。

每个 shape 用"对称顶点位移模板":
  - smile: 嘴角上扬(嘴巴周围顶点沿 Y 上移 + 沿 Z 微外扩)
  - blink: 眼皮下合(眼睛周围顶点沿 Z 压低)
  - sad: 嘴角下垂 + 眉心下沉
  - angry: 眉头皱紧(眉心顶点沿 Y 内移)
  - surprised: 眼睛睁大 + 嘴张开
  - aa/ih/ou/E/O/U/closed: 嘴部 7 个 viseme(基于 Preston-Blair 子集)

用法:
  import 这个模块,调 sculpt(mesh) 返回 shape key 列表。
  或独立跑:
    blender --background --python scripts/blender/sculpt_blendshapes.py -- \
        --glb work/mesh/cleaned.glb --out work/mesh/with-shapes.glb
"""

import bpy
import sys
import os
import math
import argparse
from mathutils import Vector


# 标准 12 个 shape 名字
SHAPE_NAMES = [
    'smile', 'blink', 'sad', 'angry', 'surprised',
    'aa', 'ih', 'ou', 'E', 'O', 'U', 'closed',
]


def detect_head_bbox(mesh):
    """
    找 mesh 的 head bbox:取 Z 方向上 30% 的顶部。
    返回 (head_min_z, head_max_z)。
    """
    z_coords = [v.co.z for v in mesh.data.vertices]
    z_max = max(z_coords)
    z_min = z_max - (z_max - min(z_coords)) * 0.30  # 顶部 30%
    return z_min, z_max


def detect_face_center(mesh, head_z_min, head_z_max):
    """
    估算脸部中心(眼睛位置):head bbox 的上 40% 中点。
    返回 Vector(face_center)。
    """
    head_verts = [v.co for v in mesh.data.vertices
                  if head_z_min <= v.co.z <= head_z_max]
    if not head_verts:
        return Vector((0, 0, (head_z_min + head_z_max) / 2))
    cx = sum(v.x for v in head_verts) / len(head_verts)
    cy = sum(v.y for v in head_verts) / len(head_verts)
    cz = sum(v.z for v in head_verts) / len(head_verts)
    return Vector((cx, cy, cz))


def detect_mouth_area(mesh, face_center):
    """
    嘴部区域:脸部中心下方 5cm、Z 方向略低。
    返回 (mouth_min_z, mouth_max_z, mouth_center)。
    """
    mouth_z_top = face_center.z - 0.04  # 嘴在眼睛下方约 4cm
    mouth_z_bot = face_center.z - 0.10
    return mouth_z_bot, mouth_z_top, Vector((face_center.x, face_center.y, (mouth_z_top + mouth_z_bot) / 2))


def add_shape_key(mesh, name):
    """新建 shape key 并返回 key block(自动创建 Basis)。"""
    if not mesh.data.shape_keys:
        # 第一个 key 必须是 Basis
        mesh.select_set(True)
        bpy.context.view_layer.objects.active = mesh
        bpy.ops.object.shape_key_add(from_mix=False)
        mesh.data.shape_keys.key_blocks[-1].name = 'Basis'
    bpy.ops.object.shape_key_add(from_mix=False)
    kb = mesh.data.shape_keys.key_blocks[-1]
    kb.name = name
    return kb


def sculpt(mesh, head_z_min=None, head_z_max=None):
    """
    给 mesh 加 12 个 BlendShape。
    返回 shape key 名字列表。
    """
    if head_z_min is None or head_z_max is None:
        head_z_min, head_z_max = detect_head_bbox(mesh)
    face_center = detect_face_center(mesh, head_z_min, head_z_max)
    mouth_z_bot, mouth_z_top, mouth_center = detect_mouth_area(mesh, face_center)

    # 找嘴部左右两侧的顶点(用于左右对称的 viseme)
    mouth_verts = [v for v in mesh.data.vertices
                   if mouth_z_bot <= v.co.z <= mouth_z_top
                   and abs(v.co.x - mouth_center.x) < 0.05]
    mouth_left = [v for v in mouth_verts if v.co.x < mouth_center.x]
    mouth_right = [v for v in mouth_verts if v.co.x > mouth_center.x]

    # 眼睛区域(脸部中心上方 3cm,Z 略高)
    eye_z_top = face_center.z + 0.03
    eye_z_bot = face_center.z - 0.01
    eye_verts = [v for v in mesh.data.vertices
                 if eye_z_bot <= v.co.z <= eye_z_top
                 and abs(v.co.x - face_center.x) < 0.04]

    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh

    # ───── 表情 ─────

    # smile:嘴部顶点向上外侧(Y+ / X 外扩)
    kb = add_shape_key(mesh, 'smile')
    for i, v in enumerate(mesh.data.vertices):
        if mouth_z_bot <= v.co.z <= mouth_z_top:
            # 嘴部:朝 Y+ 上移,X 外扩(模拟嘴角上扬)
            side = 1 if v.co.x > face_center.x else (-1 if v.co.x < face_center.x else 0)
            kb.data[i].co = (
                v.co.x + side * 0.008,
                v.co.y + 0.005,
                v.co.z + 0.002,
            )
        else:
            kb.data[i].co = v.co

    # blink:眼部顶点 Z 压低(眼皮下合)
    kb = add_shape_key(mesh, 'blink')
    for i, v in enumerate(mesh.data.vertices):
        if any(abs(v.co - e.co) < 0.01 for e in eye_verts):
            # 接近眼部的顶点:Z 压低 0.5cm(眼皮盖住一半)
            kb.data[i].co = (v.co.x, v.co.y, v.co.z - 0.005)
        else:
            kb.data[i].co = v.co

    # sad:嘴角下垂 + 眉心 Y 略低
    kb = add_shape_key(mesh, 'sad')
    for i, v in enumerate(mesh.data.vertices):
        if mouth_z_bot <= v.co.z <= mouth_z_top:
            # 嘴角下垂(Y-)
            kb.data[i].co = (v.co.x, v.co.y - 0.005, v.co.z - 0.002)
        elif abs(v.co.z - face_center.z) < 0.02:
            # 眉心:Y- 略低(愁眉)
            kb.data[i].co = (v.co.x, v.co.y - 0.003, v.co.z)
        else:
            kb.data[i].co = v.co

    # angry:眉头皱紧(眉心 X 内移 + Y 上抬)
    kb = add_shape_key(mesh, 'angry')
    for i, v in enumerate(mesh.data.vertices):
        if abs(v.co.z - face_center.z) < 0.015:
            # 眉心区域
            side = 1 if v.co.x > face_center.x else (-1 if v.co.x < face_center.x else 0)
            kb.data[i].co = (
                v.co.x - side * 0.005,  # 朝中线内移
                v.co.y + 0.003,         # 略上抬
                v.co.z,
            )
        else:
            kb.data[i].co = v.co

    # surprised:眼睛睁大 + 嘴张开
    kb = add_shape_key(mesh, 'surprised')
    for i, v in enumerate(mesh.data.vertices):
        if any(abs(v.co - e.co) < 0.012 for e in eye_verts):
            # 眼睛周围外扩(睁大)
            kb.data[i].co = (
                v.co.x + (v.co.x - face_center.x) * 0.2,
                v.co.y,
                v.co.z + 0.003,
            )
        elif mouth_z_bot <= v.co.z <= mouth_z_top:
            # 嘴部张开(Y- 拉长 + X 外扩)
            kb.data[i].co = (v.co.x * 1.1, v.co.y - 0.015, v.co.z)
        else:
            kb.data[i].co = v.co

    # ───── 口型(viseme) ─────

    # aa:大张嘴,Y 方向大拉低,X 外扩
    kb = add_shape_key(mesh, 'aa')
    for i, v in enumerate(mesh.data.vertices):
        if mouth_z_bot <= v.co.z <= mouth_z_top:
            kb.data[i].co = (v.co.x * 1.15, v.co.y - 0.012, v.co.z)
        else:
            kb.data[i].co = v.co

    # ih:嘴微张,X 略外扩,Y 略拉低(比 aa 小)
    kb = add_shape_key(mesh, 'ih')
    for i, v in enumerate(mesh.data.vertices):
        if mouth_z_bot <= v.co.z <= mouth_z_top:
            kb.data[i].co = (v.co.x * 1.05, v.co.y - 0.006, v.co.z)
        else:
            kb.data[i].co = v.co

    # ou:嘴圆(嘟嘴),X 内缩,Y 略前
    kb = add_shape_key(mesh, 'ou')
    for i, v in enumerate(mesh.data.vertices):
        if mouth_z_bot <= v.co.z <= mouth_z_top:
            kb.data[i].co = (v.co.x * 0.85, v.co.y - 0.005, v.co.z + 0.005)
        else:
            kb.data[i].co = v.co

    # E:嘴横向(咧嘴),X 大外扩,Y 拉低
    kb = add_shape_key(mesh, 'E')
    for i, v in enumerate(mesh.data.vertices):
        if mouth_z_bot <= v.co.z <= mouth_z_top:
            kb.data[i].co = (v.co.x * 1.2, v.co.y - 0.008, v.co.z)
        else:
            kb.data[i].co = v.co

    # O:嘴圆(中度),X 内缩,Y 略前
    kb = add_shape_key(mesh, 'O')
    for i, v in enumerate(mesh.data.vertices):
        if mouth_z_bot <= v.co.z <= mouth_z_top:
            kb.data[i].co = (v.co.x * 0.9, v.co.y - 0.008, v.co.z + 0.003)
        else:
            kb.data[i].co = v.co

    # U:嘴小圆,X 内缩,Y 略前(比 O 小)
    kb = add_shape_key(mesh, 'U')
    for i, v in enumerate(mesh.data.vertices):
        if mouth_z_bot <= v.co.z <= mouth_z_top:
            kb.data[i].co = (v.co.x * 0.85, v.co.y - 0.005, v.co.z + 0.004)
        else:
            kb.data[i].co = v.co

    # closed:闭嘴,X 内缩,Y 上抬
    kb = add_shape_key(mesh, 'closed')
    for i, v in enumerate(mesh.data.vertices):
        if mouth_z_bot <= v.co.z <= mouth_z_top:
            kb.data[i].co = (v.co.x * 0.85, v.co.y + 0.003, v.co.z + 0.002)
        else:
            kb.data[i].co = v.co

    return SHAPE_NAMES


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--glb', required=True, help='Input GLB')
    parser.add_argument('--out', required=True, help='Output GLB')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])

    if not os.path.isfile(args.glb):
        print(f'ERROR: {args.glb} 不存在', file=sys.stderr)
        sys.exit(1)

    # 清空场景,导入 GLB
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=args.glb)

    mesh = bpy.context.view_layer.objects.active
    if not mesh or mesh.type != 'MESH':
        print('ERROR: 导入后没有 mesh', file=sys.stderr)
        sys.exit(1)
    mesh.name = 'Body'

    print(f'[sculpt_blendshapes] mesh: {mesh.name}, {len(mesh.data.vertices):,} 顶点')
    keys = sculpt(mesh)
    print(f'[sculpt_blendshapes] 加了 {len(keys)} 个 BlendShape: {keys}')

    # 导出
    os.makedirs(os.path.dirname(args.out) or '.', exist_ok=True)
    try:
        bpy.ops.export_scene.gltf(
            filepath=args.out, export_format='GLB',
            export_morph=True, export_apply=True,
        )
    except TypeError:
        bpy.ops.export_scene.gltf(
            filepath=args.out, export_format='GLB',
            export_morph=True, export_apply=True, export_armature=True,
        )
    print(f'[sculpt_blendshapes] 完成 → {args.out}')


if __name__ == '__main__':
    main()
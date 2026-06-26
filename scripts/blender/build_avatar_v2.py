"""
build_avatar_v2.py —— 写实风格女性 + 手动 KNN 绑骨

之前 bpy.ops.object.parent_set(type='ARMATURE_AUTO') 在 background mode 下
不工作(silent 失败,vertex 全绑到 Root bone,渲染堆在原点)。

这个版本:
- 不合并 mesh(每个部位独立 mesh)
- 手动 KNN 算 vertex group weights(每个 vertex 找最近的 bone,weight=1.0)
- 加 Armature modifier 引用 armature
- export GLB 时 Blender 直接用 vertex group
- 12 morph 加到 head + bust mesh(其他部位没 morph 字典,BlenderAvatar 跳过)
"""

import bpy
import sys
import os
import math
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _rig_template import (
    clear_scene, build_armature, add_basic_blendshapes,
    make_all_builtin_actions, export_glb,
)


def make_skin_material(name='Skin', skin_tone=(0.95, 0.80, 0.72, 1)):
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


def make_eye_material(name='Eye'):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (0.98, 0.98, 0.95, 1)
    bsdf.inputs['Roughness'].default_value = 0.1
    return mat


def make_iris_material(name='Iris', iris_color=(0.30, 0.55, 0.35, 1)):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = iris_color
    bsdf.inputs['Roughness'].default_value = 0.2
    return mat


def make_hair_material(name='Hair', hair_color=(0.15, 0.10, 0.07, 1)):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = hair_color
    bsdf.inputs['Roughness'].default_value = 0.4
    return mat


def cfg_id():
    return 'x'


# 创建一个 primitive mesh,绑骨,返回 object
def add_prim(type_fn, name, location, scale=(1, 1, 1), mat=None, armature=None):
    type_fn()
    obj = bpy.context.active_object
    obj.name = name
    obj.location = location
    if scale != (1, 1, 1):
        obj.scale = scale
    if mat:
        obj.data.materials.append(mat)
    if armature:
        # KNN 手动算 vertex group + Armature modifier
        # Blender 内部 render 测试对(headless swiftshader 错是真 GPU 浏览器才对)
        bind_knn(obj, armature)
    return obj


def bind_knn(mesh, armature, max_influence=4):
    """手动 KNN 绑骨:每个 vertex 找最近的 K 个 bone,weight 与距离成反比

    为什么不用 bpy.ops.object.parent_set(type='ARMATURE_AUTO'):
    - background mode 下不工作(silent 失败,vertex 全绑 Root)
    - KNN 自己算稳,不用依赖 Blender 的内部自动权重

    用 armature local space 算距离(不依赖 mesh.matrix_world):
    - vertex local pos: v.co(相对于 mesh local)
    - vertex in armature space: armature.matrix_world.inverted() @ mesh.matrix_world @ v.co
    - bone pos: bone.head_local(已经是 armature local)
    """
    # 强制更新 scene 矩阵
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    mesh_eval = mesh.evaluated_get(depsgraph)
    arm_eval = armature.evaluated_get(depsgraph)

    mesh.parent = armature
    mod = mesh.modifiers.new('Armature', 'ARMATURE')
    mod.object = armature
    mod.use_bone_envelopes = False
    mod.use_vertex_groups = True

    # 清空旧 vertex group
    for vg in list(mesh.vertex_groups):
        mesh.vertex_groups.remove(vg)

    # 算 mesh → armature 的世界变换矩阵
    # 如果 mesh.parent = armature,arm_world_inv @ mesh_world 给 vertex 在 armature local space 的位置
    arm_world_inv = arm_eval.matrix_world.inverted()
    mesh_to_arm = arm_world_inv @ mesh_eval.matrix_world

    # vertex 位置在 mesh local 空间
    mesh_verts = list(mesh.data.vertices)
    n_verts = len(mesh_verts)

    # bone head 位置在 armature local 空间(bone.head_local 已经是 armature local)
    bones = list(arm_eval.data.bones)
    bone_local_pos = [bone.head_local.copy() for bone in bones]
    n_bones = len(bones)

    # 一次性算所有 vertex → armature local 位置
    verts_arm_local = []
    for v in mesh_verts:
        v_arm = mesh_to_arm @ v.co
        verts_arm_local.append(v_arm)

    # 给每个 vertex 找最近的 K 个 bone
    k = min(max_influence, n_bones)
    eps = 1e-4
    for v_idx, v_arm_pos in enumerate(verts_arm_local):
        dists = []
        for bone_idx, bone_pos in enumerate(bone_local_pos):
            d = (v_arm_pos - bone_pos).length
            dists.append((d, bone_idx))
        dists.sort(key=lambda x: x[0])
        top_k = dists[:k]
        # weight ∝ 1 / distance
        weights = [1.0 / (d + eps) for d, _ in top_k]
        total = sum(weights)
        weights = [w / total for w in weights]
        for (d, b_idx), w in zip(top_k, weights):
            bone = bones[b_idx]
            vg = mesh.vertex_groups.get(bone.name)
            if vg is None:
                vg = mesh.vertex_groups.new(name=bone.name)
            vg.add([v_idx], w, 'REPLACE')

    print(f'  [bind_knn] {mesh.name}: {n_verts} verts → {k} bones each')


def build_body_v2(armature, height=1.65):
    """不合并,每个部位独立 mesh,各自绑骨"""
    head_w = 0.085
    head_h = 0.21
    neck_h = 0.10
    shoulder_w = 0.36
    chest_w = 0.30
    waist_w = 0.22
    hip_w = 0.30
    bust_w = 0.085
    bust_dz = 0.10
    arm_w = 0.045
    leg_w = 0.07
    calf_w = 0.05
    foot_h = 0.05
    foot_l = 0.22
    leg_h = height * 0.48
    torso_h = height * 0.34
    arm_h = height * 0.30
    foot_w = 0.08

    skin = make_skin_material('Skin', skin_tone=(0.95, 0.80, 0.72, 1))
    hair_mat = make_hair_material('Hair', hair_color=(0.15, 0.10, 0.07, 1))
    eye_white = make_eye_material('Eye')
    iris = make_iris_material('Iris', iris_color=(0.30, 0.55, 0.35, 1))
    lip = make_solid_material('Lip', color=(0.78, 0.32, 0.30, 1))
    shirt = make_solid_material('Shirt', color=(0.30, 0.50, 0.85, 1))
    pants = make_solid_material('Pants', color=(0.18, 0.20, 0.28, 1))
    shoe = make_solid_material('Shoe', color=(0.15, 0.10, 0.08, 1))

    base_z = leg_h + torso_h + neck_h  # 头底

    # === 头(绑到 Head bone) ===
    add_prim(
        lambda: bpy.ops.mesh.primitive_uv_sphere_add(radius=head_w / 2, segments=32, ring_count=24),
        'Head', (0, 0, base_z + head_h / 2), scale=(1.0, 0.9, 1.1), mat=skin, armature=armature,
    )

    # === 头发(各部分独立) ===
    add_prim(
        lambda: bpy.ops.mesh.primitive_uv_sphere_add(radius=head_w * 0.7, segments=16, ring_count=16),
        'Hair_back', (0, -0.04, base_z + head_h * 0.6), scale=(1.05, 0.7, 1.6), mat=hair_mat, armature=armature,
    )
    for sign in (-1, +1):
        add_prim(
            lambda: bpy.ops.mesh.primitive_uv_sphere_add(radius=0.06, segments=12, ring_count=12),
            f'Hair_side_{"L" if sign < 0 else "R"}',
            (sign * 0.10, -0.04, base_z + head_h * 0.2), scale=(0.5, 0.5, 3.0), mat=hair_mat, armature=armature,
        )
    add_prim(
        lambda: bpy.ops.mesh.primitive_uv_sphere_add(radius=head_w * 0.5, segments=16, ring_count=12),
        'Hair_bangs', (0, 0.02, base_z + head_h * 0.92), scale=(1.05, 0.4, 0.3), mat=hair_mat, armature=armature,
    )

    # === 眼睛 + 嘴 + 鼻 ===
    for sign in (-1, +1):
        add_prim(
            lambda: bpy.ops.mesh.primitive_uv_sphere_add(radius=0.018, segments=16, ring_count=12),
            f'Eye_{"L" if sign < 0 else "R"}',
            (sign * 0.035, -0.04, base_z + head_h * 0.65), scale=(1.0, 0.5, 1.1), mat=eye_white, armature=armature,
        )
        add_prim(
            lambda: bpy.ops.mesh.primitive_uv_sphere_add(radius=0.012, segments=16, ring_count=12),
            f'Iris_{"L" if sign < 0 else "R"}',
            (sign * 0.035, -0.055, base_z + head_h * 0.65), scale=(1.0, 0.4, 1.0), mat=iris, armature=armature,
        )
    add_prim(
        lambda: bpy.ops.mesh.primitive_uv_sphere_add(radius=0.014, segments=12, ring_count=8),
        'Mouth', (0, -0.07, base_z + head_h * 0.45), scale=(1.5, 0.4, 0.5), mat=lip, armature=armature,
    )
    add_prim(
        lambda: bpy.ops.mesh.primitive_cone_add(radius1=0.003, radius2=0.011, depth=0.03, vertices=12),
        'Nose', (0, -0.06, base_z + head_h * 0.55), mat=skin, armature=armature,
    )

    # === 脖(绑到 Spine) ===
    add_prim(
        lambda: bpy.ops.mesh.primitive_cylinder_add(radius=0.045, depth=neck_h, vertices=12),
        'NeckMesh', (0, 0, leg_h + torso_h + neck_h / 2), mat=skin, armature=armature,
    )

    # === 上身 + 腰 + 髋(各绑到自己骨头) ===
    add_prim(
        lambda: bpy.ops.mesh.primitive_cylinder_add(radius=chest_w / 2, depth=torso_h * 0.45, vertices=24),
        'UpperTorso', (0, 0, leg_h + torso_h - torso_h * 0.45 / 2), scale=(1.0, 0.85, 1.0), mat=shirt, armature=armature,
    )
    add_prim(
        lambda: bpy.ops.mesh.primitive_cylinder_add(radius=waist_w / 2, depth=torso_h * 0.40, vertices=24),
        'Waist', (0, 0, leg_h + torso_h * 0.6 - torso_h * 0.40 / 2), scale=(1.0, 0.85, 1.0), mat=shirt, armature=armature,
    )
    add_prim(
        lambda: bpy.ops.mesh.primitive_cylinder_add(radius=hip_w / 2, depth=torso_h * 0.15, vertices=24),
        'Hip', (0, 0, leg_h + torso_h * 0.20 - torso_h * 0.15 / 2), scale=(1.0, 0.85, 1.0), mat=pants, armature=armature,
    )

    # === 胸(2 个半球,绑到 Spine) ===
    for sign in (-1, +1):
        add_prim(
            lambda: bpy.ops.mesh.primitive_uv_sphere_add(radius=bust_w, segments=20, ring_count=16),
            f'Bust_{"L" if sign < 0 else "R"}',
            (sign * bust_dz, -0.04, leg_h + torso_h * 0.85), scale=(0.85, 0.65, 1.1), mat=shirt, armature=armature,
        )
        add_prim(
            lambda: bpy.ops.mesh.primitive_uv_sphere_add(radius=0.012, segments=12, ring_count=8),
            f'Nipple_{"L" if sign < 0 else "R"}',
            (sign * 0.10, -0.07, leg_h + torso_h * 0.80), scale=(0.8, 0.8, 0.5), mat=lip, armature=armature,
        )

    # === 肩(球) ===
    for sign in (-1, +1):
        add_prim(
            lambda: bpy.ops.mesh.primitive_uv_sphere_add(radius=0.07, segments=16, ring_count=12),
            f'Shoulder_{"L" if sign < 0 else "R"}',
            (sign * shoulder_w / 2, 0, leg_h + torso_h + neck_h - 0.02), mat=shirt, armature=armature,
        )

    # === 手臂(各部分独立) ===
    for sign in (-1, +1):
        add_prim(
            lambda: bpy.ops.mesh.primitive_cylinder_add(radius=arm_w, depth=arm_h * 0.6, vertices=12),
            f'UpperArm_{"L" if sign < 0 else "R"}',
            (sign * (shoulder_w / 2 + 0.02), 0, leg_h + torso_h + neck_h - arm_h * 0.3),
            mat=skin, armature=armature,
        )
        add_prim(
            lambda: bpy.ops.mesh.primitive_cylinder_add(radius=arm_w * 0.85, depth=arm_h * 0.4, vertices=12),
            f'ForeArm_{"L" if sign < 0 else "R"}',
            (sign * (shoulder_w / 2 + 0.02), 0, leg_h + torso_h + neck_h - arm_h * 0.7),
            mat=skin, armature=armature,
        )
        add_prim(
            lambda: bpy.ops.mesh.primitive_uv_sphere_add(radius=0.04, segments=12, ring_count=8),
            f'Hand_{"L" if sign < 0 else "R"}',
            (sign * (shoulder_w / 2 + 0.02), 0, leg_h + torso_h + neck_h - arm_h),
            scale=(0.8, 1.2, 0.5), mat=skin, armature=armature,
        )

    # === 腿 + 脚 ===
    for sign in (-1, +1):
        add_prim(
            lambda: bpy.ops.mesh.primitive_cylinder_add(radius=leg_w, depth=leg_h * 0.55, vertices=14),
            f'Thigh_{"L" if sign < 0 else "R"}',
            (sign * 0.08, 0, leg_h * 0.7), mat=pants, armature=armature,
        )
        add_prim(
            lambda: bpy.ops.mesh.primitive_cylinder_add(radius=calf_w, depth=leg_h * 0.45, vertices=14),
            f'Calf_{"L" if sign < 0 else "R"}',
            (sign * 0.08, 0, leg_h * 0.25), mat=pants, armature=armature,
        )
        add_prim(
            lambda: bpy.ops.mesh.primitive_cube_add(size=1),
            f'Foot_{"L" if sign < 0 else "R"}',
            (sign * 0.08, 0.10, 0.025), scale=(foot_w, foot_l, foot_h), mat=shoe, armature=armature,
        )

    print(f'[build_body_v2] 创建了 {len([o for o in bpy.data.objects if o.type == "MESH"])} 个 mesh')


def add_blendshapes_to_head_meshes():
    """给头/眼睛/嘴 mesh 加 12 morph targets

    其他部位(腿/胸/手)没 morph — BlenderAvatar.tsx 会跳过没 morph 的 mesh
    """
    head_meshes = ['Head', 'Mouth', 'Nose', 'Hair_back', 'Hair_bangs']
    head_meshes += [f'Hair_side_{s}' for s in ('L', 'R')]
    head_meshes += [f'Eye_{s}' for s in ('L', 'R')]
    head_meshes += [f'Iris_{s}' for s in ('L', 'R')]
    head_meshes += [f'Bust_{s}' for s in ('L', 'R')]
    head_meshes += [f'Nipple_{s}' for s in ('L', 'R')]

    # 12 个 morph + 缩放参数
    morph_specs = [
        ('smile', 1.0, 1.0, 1.0, 0.0, 0.0, 0.0),
        ('blink', 0.6, 1.0, 1.0, -0.005, 0.0, 0.0),
        ('aa', 1.2, 1.0, 1.0, 0.03, 0.0, 0.0),
        ('sad', 1.0, 1.0, 1.0, 0.0, -0.01, 0.0),
        ('angry', 1.0, 1.0, 1.0, 0.0, 0.005, 0.0),
        ('surprised', 1.4, 1.05, 1.0, 0.05, 0.0, 0.0),
        ('ih', 1.1, 1.0, 1.0, 0.02, 0.0, 0.005),
        ('ou', 1.15, 1.0, 1.0, 0.02, 0.0, 0.0),
        ('E', 1.05, 1.0, 1.0, 0.01, 0.0, 0.01),
        ('O', 1.1, 1.0, 1.0, 0.015, 0.0, 0.0),
        ('U', 1.05, 1.0, 1.0, 0.005, 0.0, 0.0),
        ('closed', 0.95, 1.0, 1.0, 0.0, 0.0, 0.0),
    ]

    for name in head_meshes:
        obj = bpy.data.objects.get(name)
        if not obj or obj.type != 'MESH':
            continue
        # Blender 5.x: 用 obj.shape_key_add() 直接建 + 命名
        # 第一个 shape key 是 Basis
        sk_basis = obj.shape_key_add(name='Basis', from_mix=False)
        for spec in morph_specs:
            morph_name, scale_z, scale_x, scale_y, dz, dy, dx = spec
            sk = obj.shape_key_add(name=morph_name, from_mix=False)
            for i, v in enumerate(obj.data.vertices):
                sk.data[i].co = (
                    v.co.x * scale_x + dx,
                    v.co.y * scale_y + dy,
                    v.co.z * scale_z + dz,
                )
        print(f'[add_blendshapes] {name}: 12 morph added')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default='public/avatars/model.glb')
    parser.add_argument('--height', type=float, default=1.65)
    parser.add_argument('--name', default='avatar')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])

    print(f'[build_avatar_v2] output={args.output} height={args.height}')

    clear_scene()
    armature = build_armature(args.height)
    print(f'[build_avatar_v2] armature: {len(armature.data.bones)} bones')

    build_body_v2(armature, args.height)
    add_blendshapes_to_head_meshes()

    make_all_builtin_actions(armature)
    print('[build_avatar_v2] 10 个 baked actions 完成')

    export_glb(args.output, args.name)
    print('[build_avatar_v2] 完成!')


if __name__ == '__main__':
    main()

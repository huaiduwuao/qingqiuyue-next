"""
build_avatar.py —— Blender headless 自动化:建模 + 绑骨 + BlendShape + 动作 → GLB。

完全开源、离线、可重复:
    Blender(GPL)+ Python 脚本,不需要 SMPL / FLAME / 任何注册。

输入(可选):
    - subjects/<name>.blend  自定义 Blender 文件(可选,缺省用程序化几何)
    - 或者用 --primitive 用 Blender 自带 cube/sphere 生成最小骨架 demo

输出:
    public/avatars/model.glb
        - mesh(头部 + 身体 + 四肢)
        - skeleton(17 关节标准人形骨架)
        - morph targets(表情 + 口型)
        - animations(idle / wave / walk)

用法:
    podman run --rm -v D:/git/really/qingqiuyue-next:/work linuxserver/blender:latest \
        bash -c "blender --background --python /work/scripts/blender/build_avatar.py -- --output /work/public/avatars/model.glb"

    或者本地:
        blender --background --python scripts/blender/build_avatar.py -- --output public/avatars/model.glb
"""

import bpy
import sys
import os
import argparse

# 把同目录加进 path,允许 import _rig_template
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _rig_template import (
    clear_scene, build_armature, bind_mesh, add_basic_blendshapes,
    make_all_builtin_actions, export_glb,
)


def parse_args():
    argv = sys.argv
    if '--' in argv:
        argv = argv[argv.index('--') + 1:]
    else:
        argv = []
    parser = argparse.ArgumentParser(description='Build a Blender avatar asset')
    parser.add_argument('--output', default='public/avatars/model.glb',
                        help='Output GLB path')
    parser.add_argument('--height', type=float, default=1.75,
                        help='Character height in meters (default 1.75)')
    parser.add_argument('--name', default='avatar',
                        help='GLTF scene name')
    return parser.parse_args(argv)


def build_body(height=1.65):
    """
    程序化构建写实风格女性人体(头部 + 长头发 + 颈 + 胸 + 腰 + 髋 + 四肢)。
    没用 MakeHuman / 外部资产,纯 Blender primitives — 完全离线可重复。
    身材参数按女性平均:身高 1.65m,胸围/腰围/髋围 ~ 0.85 / 0.65 / 0.93m(漏斗形)。

    生产环境建议替换成 MakeHuman / DAZ3D / 自己 Blender 雕刻的 .blend 文件。
    """
    # === 身材参数(女性) ===
    head_w = 0.085      # 头宽(比男性小一点)
    head_h = 0.21       # 头高(从下巴到头顶)
    neck_h = 0.10       # 脖子高
    shoulder_w = 0.36    # 肩宽
    chest_w = 0.30      # 胸围半径(漏斗形最大处)
    waist_w = 0.22       # 腰围半径(最细)
    hip_w = 0.30        # 髋围半径
    bust_w = 0.085       # 单侧胸半径
    bust_dz = 0.10       # 胸距中心偏移
    arm_w = 0.045        # 上臂半径
    leg_w = 0.07         # 大腿半径
    calf_w = 0.05        # 小腿半径
    foot_h = 0.05        # 脚高
    foot_l = 0.22        # 脚长

    # 比例:女性比男性腿更长 / 躯干比例稍短
    leg_h = height * 0.48
    torso_h = height * 0.34
    arm_h = height * 0.30
    foot_w = 0.08

    # === 材质 ===
    skin = make_skin_material('Skin', skin_tone=(0.95, 0.80, 0.72, 1))
    hair_mat = make_hair_material('Hair', hair_color=(0.15, 0.10, 0.07, 1))  # 深棕
    eye_white = make_eye_material('Eye')
    iris = make_iris_material('Iris', iris_color=(0.30, 0.55, 0.35, 1))     # 绿
    lip = make_solid_material('Lip', color=(0.78, 0.32, 0.30, 1))           # 浅红
    shirt = make_solid_material('Shirt', color=(0.30, 0.50, 0.85, 1))        # 蓝
    pants = make_solid_material('Pants', color=(0.18, 0.20, 0.28, 1))       # 深蓝

    # === 头(略椭,女性头型) ===
    bpy.ops.mesh.primitive_uv_sphere_add(radius=head_w / 2, segments=32, ring_count=24)
    head = bpy.context.active_object
    head.name = 'Head'
    head.location = (0, 0, leg_h + torso_h + neck_h + head_h / 2)
    head.scale = (1.0, 0.9, 1.1)  # 略长 Z(女性头型)
    head.data.materials.append(skin)
    # 眼睛(大二次元风)
    for sign in (-1, +1):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.018, segments=16, ring_count=12)
        e = bpy.context.active_object
        e.name = f'Eye_{"L" if sign < 0 else "R"}'
        e.location = (sign * 0.035, -0.04, leg_h + torso_h + neck_h + head_h * 0.65)
        e.scale = (1.0, 0.5, 1.1)
        e.data.materials.append(eye_white)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.012, segments=16, ring_count=12)
        ir = bpy.context.active_object
        ir.name = f'Iris_{"L" if sign < 0 else "R"}'
        ir.location = (sign * 0.035, -0.055, leg_h + torso_h + neck_h + head_h * 0.65)
        ir.scale = (1.0, 0.4, 1.0)
        ir.data.materials.append(iris)
    # 嘴(小)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.014, segments=12, ring_count=8)
    mouth = bpy.context.active_object
    mouth.name = 'Mouth'
    mouth.location = (0, -0.07, leg_h + torso_h + neck_h + head_h * 0.45)
    mouth.scale = (1.5, 0.4, 0.5)
    mouth.data.materials.append(lip)
    # 鼻子(细长)
    bpy.ops.mesh.primitive_cone_add(radius1=0.003, radius2=0.011, depth=0.03, vertices=12)
    nose = bpy.context.active_object
    nose.name = 'Nose'
    nose.location = (0, -0.06, leg_h + torso_h + neck_h + head_h * 0.55)
    nose.rotation_euler = (math.radians(90), 0, 0)
    nose.data.materials.append(skin)

    # === 长头发(4 层,从头顶延伸下来到腰部) ===
    # 后部总发片
    bpy.ops.mesh.primitive_uv_sphere_add(radius=head_w * 0.7, segments=16, ring_count=16)
    hair_back = bpy.context.active_object
    hair_back.name = 'Hair_back'
    hair_back.location = (0, -0.04, leg_h + torso_h + neck_h + head_h * 0.6)
    hair_back.scale = (1.05, 0.7, 1.6)  # 拉长(覆盖后脑 + 到肩下)
    hair_back.data.materials.append(hair_mat)
    # 两侧披发(到胸下)
    for sign in (-1, +1):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.06, segments=12, ring_count=12)
        h = bpy.context.active_object
        h.name = f'Hair_side_{"L" if sign < 0 else "R"}'
        h.location = (sign * 0.10, -0.04, leg_h + torso_h + neck_h + head_h * 0.2)
        h.scale = (0.5, 0.5, 3.0)  # 拉长到胸
        h.data.materials.append(hair_mat)
    # 刘海
    bpy.ops.mesh.primitive_uv_sphere_add(radius=head_w * 0.5, segments=16, ring_count=12)
    bangs = bpy.context.active_object
    bangs.name = 'Hair_bangs'
    bangs.location = (0, 0.02, leg_h + torso_h + neck_h + head_h * 0.92)
    bangs.scale = (1.05, 0.4, 0.3)
    bangs.data.materials.append(hair_mat)

    # === 脖子(细) ===
    bpy.ops.mesh.primitive_cylinder_add(radius=0.045, depth=neck_h, vertices=12)
    neck = bpy.context.active_object
    neck.name = 'Neck'
    neck.location = (0, 0, leg_h + torso_h + neck_h / 2)
    neck.data.materials.append(skin)

    # === 上身(胸 + 腰) — 漏斗形 ===
    # 用 Lathe / 多个圆柱组合实现曲线
    # 胸到腰:上胸半径 0.18,腰 0.11(漏斗收)
    bpy.ops.mesh.primitive_cylinder_add(
        radius=chest_w / 2, depth=torso_h * 0.45, vertices=24
    )
    upper = bpy.context.active_object
    upper.name = 'UpperTorso'
    upper.location = (0, 0, leg_h + torso_h - torso_h * 0.45 / 2)
    upper.scale = (1.0, 0.85, 1.0)  # 略扁
    upper.data.materials.append(shirt)
    # 腰
    bpy.ops.mesh.primitive_cylinder_add(
        radius=waist_w / 2, depth=torso_h * 0.40, vertices=24
    )
    waist = bpy.context.active_object
    waist.name = 'Waist'
    waist.location = (0, 0, leg_h + torso_h * 0.6 - torso_h * 0.40 / 2)
    waist.scale = (1.0, 0.85, 1.0)
    waist.data.materials.append(shirt)
    # 髋
    bpy.ops.mesh.primitive_cylinder_add(
        radius=hip_w / 2, depth=torso_h * 0.15, vertices=24
    )
    hip_t = bpy.context.active_object
    hip_t.name = 'Hip'
    hip_t.location = (0, 0, leg_h + torso_h * 0.20 - torso_h * 0.15 / 2)
    hip_t.scale = (1.0, 0.85, 1.0)
    hip_t.data.materials.append(pants)

    # === 胸部(明显的女性特征,2 个半球) ===
    for sign in (-1, +1):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=bust_w, segments=20, ring_count=16)
        bust = bpy.context.active_object
        bust.name = f'Bust_{"L" if sign < 0 else "R"}'
        bust.location = (sign * bust_dz, -0.04, leg_h + torso_h * 0.85)
        bust.scale = (0.85, 0.65, 1.1)
        bust.data.materials.append(shirt)
        # 乳头 BlendShape 位(略低 + 偏外)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.012, segments=12, ring_count=8)
        nipple = bpy.context.active_object
        nipple.name = f'Nipple_{"L" if sign < 0 else "R"}'
        nipple.location = (sign * 0.10, -0.07, leg_h + torso_h * 0.80)
        nipple.scale = (0.8, 0.8, 0.5)
        nipple.data.materials.append(lip)

    # === 肩(圆滑过渡) ===
    for sign in (-1, +1):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.07, segments=16, ring_count=12)
        shoulder = bpy.context.active_object
        shoulder.name = f'Shoulder_{"L" if sign < 0 else "R"}'
        shoulder.location = (sign * shoulder_w / 2, 0, leg_h + torso_h + neck_h - 0.02)
        shoulder.data.materials.append(shirt)

    # === 手臂(细) ===
    for sign in (-1, +1):
        # 上臂
        bpy.ops.mesh.primitive_cylinder_add(
            radius=arm_w, depth=arm_h * 0.6, vertices=12
        )
        upper_arm = bpy.context.active_object
        upper_arm.name = f'UpperArm_{"L" if sign < 0 else "R"}'
        upper_arm.location = (
            sign * (shoulder_w / 2 + 0.02), 0, leg_h + torso_h + neck_h - arm_h * 0.3
        )
        upper_arm.data.materials.append(skin)
        # 前臂
        bpy.ops.mesh.primitive_cylinder_add(
            radius=arm_w * 0.85, depth=arm_h * 0.4, vertices=12
        )
        fore_arm = bpy.context.active_object
        fore_arm.name = f'ForeArm_{"L" if sign < 0 else "R"}'
        fore_arm.location = (
            sign * (shoulder_w / 2 + 0.02), 0, leg_h + torso_h + neck_h - arm_h * 0.7
        )
        fore_arm.data.materials.append(skin)
        # 手
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.04, segments=12, ring_count=8)
        hand = bpy.context.active_object
        hand.name = f'Hand_{"L" if sign < 0 else "R"}'
        hand.location = (
            sign * (shoulder_w / 2 + 0.02), 0, leg_h + torso_h + neck_h - arm_h
        )
        hand.scale = (0.8, 1.2, 0.5)
        hand.data.materials.append(skin)

    # === 腿(修长,女性) ===
    for sign in (-1, +1):
        # 大腿
        bpy.ops.mesh.primitive_cylinder_add(radius=leg_w, depth=leg_h * 0.55, vertices=14)
        thigh = bpy.context.active_object
        thigh.name = f'Thigh_{"L" if sign < 0 else "R"}'
        thigh.location = (sign * 0.08, 0, leg_h * 0.7)
        thigh.data.materials.append(pants)
        # 小腿
        bpy.ops.mesh.primitive_cylinder_add(
            radius=calf_w, depth=leg_h * 0.45, vertices=14
        )
        calf = bpy.context.active_object
        calf.name = f'Calf_{"L" if sign < 0 else "R"}'
        calf.location = (sign * 0.08, 0, leg_h * 0.25)
        calf.data.materials.append(pants)
        # 脚
        bpy.ops.mesh.primitive_cube_add(size=1)
        foot = bpy.context.active_object
        foot.name = f'Foot_{"L" if sign < 0 else "R"}'
        foot.location = (sign * 0.08, 0.10, 0.025)
        foot.scale = (foot_w, foot_l, foot_h)
        foot.data.materials.append(make_solid_material(f'Shoe_{cfg_id()}', (0.15, 0.10, 0.08, 1)))

    # 合并所有 mesh 成单个对象(便于后续加骨架 + 自动权重)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.join()
    body = bpy.context.active_object
    body.name = 'Body'
    return body


# === 材质 helper(放在文件底部,build_body 用) ===
import math  # noqa: E402  (math 被 build_body 用了)


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
    """helper for materials, return generic 'x' suffix (共享一个 shoe material 即可)"""
    return 'x'


def main():
    args = parse_args()
    print(f'[build_avatar] 输出路径: {args.output}')
    print(f'[build_avatar] 身高: {args.height} m')

    clear_scene()

    body = build_body(args.height)
    print(f'[build_avatar] 身体 mesh 构建完成: {body.name}')

    armature = build_armature(args.height)
    print(f'[build_avatar] 骨架构建完成: {len(armature.data.bones)} bones')

    bind_mesh(body, armature)
    print('[build_avatar] 自动权重绑骨完成')

    morph_keys = add_basic_blendshapes(body)
    print(f'[build_avatar] BlendShape: {len(morph_keys)} keys ({morph_keys})')

    make_all_builtin_actions(armature)
    print('[build_avatar] 10 个 baked actions 烘焙完成(idle/wave/walk/run/dance/sit/point/think/talk/bow)')

    export_glb(args.output, args.name)
    print('[build_avatar] 完成!')


if __name__ == '__main__':
    main()
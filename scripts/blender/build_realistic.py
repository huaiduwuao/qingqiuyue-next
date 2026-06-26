"""
build_realistic.py —— Blender 程序化生成写实风格人偶。

无 SMPL / 无 MakeHuman GUI 依赖,完全脚本化:
  - 皮肤:Voronoi Worley 噪声 + ColorRamp 模拟毛孔/血管
  - 头发:小球排列(短发)
  - 五官:球 + 椭球(眼/鼻/嘴)
  - 衣服:含 procedural 噪声纹理

输出:public/avatars/model-realistic.glb

用法:
  podman run --rm -v D:/git/really/qingqiuyue-next:/work linuxserver/blender:latest \
    blender --background --python /work/scripts/blender/build_realistic.py -- \
    --output /work/public/avatars/model-realistic.glb
"""

import bpy
import sys
import os
import math
import argparse

# 把同目录加进 path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _rig_template import (
    clear_scene, build_armature, bind_mesh, add_basic_blendshapes,
    make_idle_action, make_wave_action, make_walk_action, export_glb,
)


def parse_args():
    argv = sys.argv
    if '--' in argv:
        argv = argv[argv.index('--') + 1:]
    else:
        argv = []
    parser = argparse.ArgumentParser(description='Build a realistic Blender avatar')
    parser.add_argument('--output', default='public/avatars/model-realistic.glb',
                        help='Output GLB path')
    parser.add_argument('--height', type=float, default=1.78,
                        help='Character height in meters (default 1.78)')
    return parser.parse_args(argv)


def make_skin_material(name='Skin'):
    """程序化皮肤材质:Voronoi 噪声 + ColorRamp + Subsurface。"""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (0.85, 0.65, 0.55, 1.0)
    bsdf.inputs['Subsurface Weight'].default_value = 0.4
    bsdf.inputs['Subsurface Radius'].default_value = (0.8, 0.4, 0.3)
    bsdf.inputs['Subsurface Color'].default_value = (0.95, 0.30, 0.25, 1.0)
    bsdf.inputs['Roughness'].default_value = 0.6

    # 添加 Voronoi 噪声 + ColorRamp 模拟毛孔
    noise = nodes.new('ShaderNodeTexVoronoi')
    noise.location = (-400, 200)
    colorramp = nodes.new('ShaderNodeValToRGB')
    colorramp.location = (-200, 200)
    colorramp.color_ramp.elements[0].color = (0.85, 0.65, 0.55, 1)
    colorramp.color_ramp.elements[1].color = (0.75, 0.55, 0.45, 1)
    multiply = nodes.new('ShaderNodeMath')
    multiply.operation = 'MULTIPLY'
    multiply.location = (0, 200)
    multiply.inputs[1].default_value = 0.15
    mat.node_tree.links.new(noise.outputs['Distance'], colorramp.inputs['Fac'])
    mat.node_tree.links.new(colorramp.outputs['Color'], multiply.inputs[0])
    mat.node_tree.links.new(multiply.outputs['Value'], bsdf.inputs['Base Color'])
    return mat


def make_hair_material(name='Hair'):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (0.10, 0.06, 0.04, 1.0)
    bsdf.inputs['Metallic'].default_value = 0.0
    bsdf.inputs['Roughness'].default_value = 0.8
    return mat


def make_cloth_material(name='Body', base=(0.20, 0.20, 0.22, 1.0)):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = base
    bsdf.inputs['Roughness'].default_value = 0.7
    return mat


def make_eye_material():
    mat = bpy.data.materials.new('Eye')
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (0.95, 0.92, 0.88, 1.0)
    bsdf.inputs['Roughness'].default_value = 0.1
    return mat


def build_realistic_body(height=1.78):
    head_h = height * 0.13
    torso_h = height * 0.40
    arm_h = height * 0.32
    leg_h = height * 0.48
    body_w = height * 0.22
    head_w = height * 0.10

    skin = make_skin_material()
    hair = make_hair_material()
    body_cloth = make_cloth_material('Body')
    eye = make_eye_material()

    # 头部(用 UV 球,带皮肤)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=head_w / 2, segments=32, ring_count=24)
    head = bpy.context.active_object
    head.name = 'Head'
    head.location = (0, 0, leg_h + torso_h + head_h / 2)
    head.data.materials.append(skin)

    # 头发(头顶 12 个小球)
    for i in range(12):
        angle = (i / 12) * 2 * math.pi
        for j in range(3):
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.022, segments=12, ring_count=8)
            h = bpy.context.active_object
            h.name = f'Hair_{i}_{j}'
            r = 0.06
            h.location = (
                math.cos(angle) * r * (1 - j * 0.15),
                -j * 0.01,
                leg_h + torso_h + head_h + j * 0.025,
            )
            h.data.materials.append(hair)

    # 眼睛
    for sign in (-1, +1):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.012, segments=12, ring_count=8)
        e = bpy.context.active_object
        e.name = f'Eye_{"L" if sign < 0 else "R"}'
        e.location = (sign * 0.025, -0.04, leg_h + torso_h + head_h * 0.6)
        e.scale = (1, 0.5, 1)
        e.data.materials.append(eye)

    # 鼻子
    bpy.ops.mesh.primitive_cone_add(radius1=0.005, radius2=0.015, depth=0.04, vertices=12)
    nose = bpy.context.active_object
    nose.name = 'Nose'
    nose.location = (0, -0.045, leg_h + torso_h + head_h * 0.5)
    nose.rotation_euler = (math.radians(90), 0, 0)

    # 嘴
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.015, segments=12, ring_count=8)
    mouth = bpy.context.active_object
    mouth.name = 'Mouth'
    mouth.location = (0, -0.06, leg_h + torso_h + head_h * 0.4)
    mouth.scale = (1.5, 0.4, 0.5)
    mouth.data.materials.append(skin)

    # 耳朵
    for sign in (-1, +1):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.012, segments=12, ring_count=8)
        ear = bpy.context.active_object
        ear.name = f'Ear_{"L" if sign < 0 else "R"}'
        ear.location = (sign * 0.055, 0, leg_h + torso_h + head_h * 0.6)
        ear.scale = (0.4, 1, 1.5)
        ear.data.materials.append(skin)

    # 躯干(穿着,深色)
    bpy.ops.mesh.primitive_cylinder_add(radius=body_w / 2, depth=torso_h, vertices=24)
    torso = bpy.context.active_object
    torso.name = 'Torso'
    torso.location = (0, 0, leg_h + torso_h / 2)
    torso.data.materials.append(body_cloth)

    # 手臂(手臂皮肤)
    for sign in (-1, +1):
        bpy.ops.mesh.primitive_cylinder_add(radius=body_w / 8, depth=arm_h, vertices=16)
        arm = bpy.context.active_object
        arm.name = f'Arm_{"L" if sign < 0 else "R"}'
        arm.location = (sign * (body_w / 2 + body_w / 16), 0, leg_h + torso_h - arm_h / 4)
        arm.data.materials.append(skin)

        # 手
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.035, segments=12, ring_count=8)
        hand = bpy.context.active_object
        hand.name = f'Hand_{"L" if sign < 0 else "R"}'
        hand.location = (sign * (body_w / 2 + body_w / 3), 0, leg_h)
        hand.scale = (0.8, 1.4, 0.5)
        hand.data.materials.append(skin)

    # 腿
    for sign in (-1, +1):
        bpy.ops.mesh.primitive_cylinder_add(radius=body_w / 6, depth=leg_h, vertices=16)
        leg = bpy.context.active_object
        leg.name = f'Leg_{"L" if sign < 0 else "R"}'
        leg.location = (sign * body_w / 8, 0, leg_h / 2)
        leg.data.materials.append(body_cloth)

        # 鞋
        bpy.ops.mesh.primitive_cube_add(size=0.13)
        shoe = bpy.context.active_object
        shoe.name = f'Shoe_{"L" if sign < 0 else "R"}'
        shoe.location = (sign * body_w / 8, 0.06, 0.05)
        shoe.scale = (0.7, 1.5, 0.5)
        shoe.data.materials.append(make_cloth_material('Shoe', (0.05, 0.05, 0.05, 1.0)))

    # 合并
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.join()
    body = bpy.context.active_object
    body.name = 'Body'
    return body


def main():
    args = parse_args()
    print(f'[build_realistic] 输出路径: {args.output}')
    print(f'[build_realistic] 身高: {args.height} m')

    clear_scene()

    body = build_realistic_body(args.height)
    print(f'[build_realistic] 写实身体 mesh 构建完成: {body.name}')

    armature = build_armature(args.height)
    print(f'[build_realistic] 骨架构建完成: {len(armature.data.bones)} bones')

    bind_mesh(body, armature)
    print('[build_realistic] 自动权重绑骨完成')

    morph_keys = add_basic_blendshapes(body)
    print(f'[build_realistic] BlendShape: {len(morph_keys)} keys')

    make_idle_action(armature)
    print('[build_realistic] idle 动画烘焙完成')
    make_wave_action(armature)
    print('[build_realistic] wave 动画烘焙完成')
    make_walk_action(armature)
    print('[build_realistic] walk 动画烘焙完成')

    export_glb(args.output, 'avatar')
    print('[build_realistic] 完成!')


if __name__ == '__main__':
    main()
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
    make_idle_action, make_wave_action, make_walk_action, export_glb,
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


def build_body(height=1.75):
    """
    程序化构建简化人形身体(头部 + 躯干 + 四肢)。
    没用 MakeHuman / 外部资产,纯 Blender primitives — 完全离线可重复。
    生产环境建议替换成 MakeHuman 或自己 Blender 雕刻的 .blend 文件。
    """
    head_h = height * 0.13
    torso_h = height * 0.40
    arm_h = height * 0.32
    leg_h = height * 0.48
    body_w = height * 0.22
    head_w = height * 0.10

    # 头
    bpy.ops.mesh.primitive_uv_sphere_add(radius=head_w / 2, segments=24, ring_count=16)
    head = bpy.context.active_object
    head.name = 'Head'
    head.location = (0, 0, leg_h + torso_h + head_h / 2)
    bpy.context.view_layer.objects.active = head
    head.select_set(True)

    # 身体(略粗圆柱 + 上下端球)
    bpy.ops.mesh.primitive_cylinder_add(
        radius=body_w / 2,
        depth=torso_h,
        vertices=16,
    )
    torso = bpy.context.active_object
    torso.name = 'Torso'
    torso.location = (0, 0, leg_h + torso_h / 2)

    # 手臂(左右)
    for sign in (-1, +1):
        bpy.ops.mesh.primitive_cylinder_add(
            radius=body_w / 8,
            depth=arm_h,
            vertices=12,
        )
        arm = bpy.context.active_object
        arm.name = 'Arm_' + ('L' if sign < 0 else 'R')
        arm.location = (sign * (body_w / 2 + body_w / 16), 0, leg_h + torso_h - arm_h / 4)

    # 腿
    for sign in (-1, +1):
        bpy.ops.mesh.primitive_cylinder_add(
            radius=body_w / 6,
            depth=leg_h,
            vertices=12,
        )
        leg = bpy.context.active_object
        leg.name = 'Leg_' + ('L' if sign < 0 else 'R')
        leg.location = (sign * body_w / 8, 0, leg_h / 2)

    # 合并所有 mesh 成单个对象(便于后续加骨架)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.join()
    body = bpy.context.active_object
    body.name = 'Body'
    return body


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

    make_idle_action(armature)
    print('[build_avatar] idle 动画烘焙完成')
    make_wave_action(armature)
    print('[build_avatar] wave 动画烘焙完成')
    make_walk_action(armature)
    print('[build_avatar] walk 动画烘焙完成')

    export_glb(args.output, args.name)
    print('[build_avatar] 完成!')


if __name__ == '__main__':
    main()
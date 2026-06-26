"""
rig_mesh.py —— 把 clean-mesh.py 产出的 GLB 导入 Blender,绑骨 + 雕 BlendShape + 动作 → 可驱动 GLB

输入:
  --input   work/xiaoqiu/mesh/cleaned.glb  (来自 clean-mesh.py)
  --output  public/avatars/model.glb

流程:
  1. import cleaned.glb
  2. 找 head 子 mesh(按 bbox 顶部 / 名称匹配)
  3. 合并所有子 mesh 成单对象(便于绑骨)
  4. build_armature() 17 关节骨架(来自 _rig_template)
  5. bind_mesh() 自动权重
  6. sculpt_blendshapes() 真实 BlendShape 雕刻(来自 sculpt_blendshapes.py)
  7. 3 个 baked action(idle / wave / walk)
  8. export_glb()

注意:
  - 真实人 mesh 没有规范的"head"标签;我们按 bbox 最高 30% 找
  - 自动权重对拓扑复杂的 mesh 效果有限,失败时给提示让用户手摆
  - 依赖 Blender 4.x+(WebGPURenderer / GLTF export API)

用法:
  blender --background --python scripts/blender/rig_mesh.py -- \
      --input work/xiaoqiu/mesh/cleaned.glb \
      --output public/avatars/model.glb
"""

import bpy
import sys
import os
import argparse

# 把同目录加进 path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _rig_template import (
    clear_scene, build_armature, bind_mesh,
    make_idle_action, make_wave_action, make_walk_action, export_glb,
)
from sculpt_blendshapes import sculpt_blendshapes


def parse_args():
    argv = sys.argv
    if '--' in argv:
        argv = argv[argv.index('--') + 1:]
    else:
        argv = []
    parser = argparse.ArgumentParser(description='Rig an imported GLB mesh')
    parser.add_argument('--input', required=True, help='Input GLB from clean-mesh.py')
    parser.add_argument('--output', default='public/avatars/model.glb',
                        help='Output rigged GLB')
    parser.add_argument('--height', type=float, default=1.75,
                        help='Character height (used for armature placement)')
    parser.add_argument('--no-blendshapes', action='store_true',
                        help='Skip BlendShape sculpting (faster)')
    parser.add_argument('--no-animations', action='store_true',
                        help='Skip baked animations')
    return parser.parse_args(argv)


def import_glb(path):
    """导入 GLB,返回主 mesh 对象(合并所有子 mesh)。"""
    ext = os.path.splitext(path)[1].lower()
    if ext == '.glb' or ext == '.gltf':
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == '.obj':
        bpy.ops.import_scene.obj(filepath=path)
    elif ext == '.fbx':
        bpy.ops.import_scene.fbx(filepath=path)
    elif ext == '.ply':
        # open3d 产出的 mesh 通常是 .ply
        bpy.ops.import_mesh.ply(filepath=path)
    else:
        raise ValueError(f'不支持的扩展名: {ext}')

    # 找所有 mesh 对象
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if not meshes:
        raise RuntimeError(f'导入后没有 mesh 对象: {path}')
    print(f'[rig_mesh] 导入 {len(meshes)} 个 mesh 对象')

    # 如果有多个,合并成一个
    if len(meshes) > 1:
        bpy.ops.object.select_all(action='DESELECT')
        for m in meshes:
            m.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        bpy.ops.object.join()
        print(f'[rig_mesh] 已合并为单 mesh')

    body = bpy.context.view_layer.objects.active
    body.name = 'Body'
    return body


def main():
    args = parse_args()
    print(f'[rig_mesh] 输入: {args.input}')
    print(f'[rig_mesh] 输出: {args.output}')

    if not os.path.isfile(args.input):
        print(f'ERROR: 输入文件不存在: {args.input}', file=sys.stderr)
        sys.exit(1)

    clear_scene()

    body = import_glb(args.input)
    print(f'[rig_mesh] mesh: {body.name}, {len(body.data.vertices):,} 顶点, {len(body.data.polygons):,} 面')

    armature = build_armature(args.height)
    print(f'[rig_mesh] 骨架: {len(armature.data.bones)} bones')

    bind_mesh(body, armature)
    print('[rig_mesh] 自动权重绑骨完成')

    if not args.no_blendshapes:
        morph_keys = sculpt_blendshapes(body)
        print(f'[rig_mesh] BlendShape: {len(morph_keys)} keys')
    else:
        print('[rig_mesh] 跳过 BlendShape(--no-blendshapes)')

    if not args.no_animations:
        make_idle_action(armature)
        print('[rig_mesh] idle 动画烘焙完成')
        make_wave_action(armature)
        print('[rig_mesh] wave 动画烘焙完成')
        make_walk_action(armature)
        print('[rig_mesh] walk 动画烘焙完成')
    else:
        print('[rig_mesh] 跳过动画(--no-animations)')

    export_glb(args.output, 'avatar')
    print('[rig_mesh] 完成!')


if __name__ == '__main__':
    main()
"""
import_mixamo.py —— 把 Mixamo 下载的 FBX 动画导入并 retarget 到现有 rig

用法:
  blender --background --python scripts/blender/import_mixamo.py -- \
      --fbx mixamo/wave.fbx \
      --target public/avatars/model.glb \
      --output public/avatars/model.glb \
      --action-name wave_mixamo

原理:
  1. 加载目标 GLB(已有 rig + 12 个 BlendShape)
  2. 导入 Mixamo FBX(临时场景,带动画)
  3. 把 FBX 的骨骼姿态 → 重命名映射到目标 rig 的 STANDARD_BONES
  4. 把每帧 rotation/location 拷到目标 armature 的 pose bones
  5. 把动画作为新 action 追加到目标 armature
  6. 重新导出 GLB

Mixamo 下载注意事项:
  - 在 https://www.mixamo.com 选角色和动作
  - Download Settings:
      Format: FBX Binary
      Pose: T-Pose (无关紧要,我们不依赖)
      Skin: Without Skin (只要骨骼 + 动画)
  - 下载后改名为方便看的名字(wave.fbx / walking.fbx / dance.fbx ...)

Mixamo → 自建骨骼名映射在 _rig_template.MIXAMO_BONE_MAP
"""

import bpy
import sys
import os
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _rig_template import MIXAMO_BONE_MAP, STANDARD_BONES, export_glb


def parse_args():
    argv = sys.argv
    if '--' in argv:
        argv = argv[argv.index('--') + 1:]
    else:
        argv = []
    parser = argparse.ArgumentParser(description='Import a Mixamo FBX animation and retarget')
    parser.add_argument('--fbx', required=True, help='Mixamo FBX path')
    parser.add_argument('--target', required=True, help='Target rigged GLB')
    parser.add_argument('--output', required=True, help='Output GLB (target + new animation)')
    parser.add_argument('--action-name', default=None,
                        help='Action name in output (default: FBX filename without ext)')
    parser.add_argument('--print-mapping', action='store_true',
                        help='Print the Mixamo → standard bone mapping and exit')
    return parser.parse_args(argv)


def print_mapping_and_exit():
    print('Mixamo bone → Standard bone mapping:')
    for mix, std in MIXAMO_BONE_MAP.items():
        print(f'  {mix:35s} → {std}')
    print(f'\nStandard bones: {STANDARD_BONES}')
    sys.exit(0)


def find_armature(obj_iter):
    """在对象列表中找 armature。"""
    for o in obj_iter:
        if o.type == 'ARMATURE':
            return o
    return None


def find_mesh(obj_iter):
    for o in obj_iter:
        if o.type == 'MESH':
            return o
    return None


def remap_animation(src_armature, dst_armature):
    """
    把 src_armature 的当前动画帧数据拷到 dst_armature。

    注意:
      - Mixamo 用 Z-up,Y-forward;Blender 默认 Y-up,Z-forward;但 bpy.ops.transform 会处理
      - Mixamo 的骨骼链可能有 Spine/Spine1/Spine2,它们都映射到 'Spine' →
        我们取每个标准骨骼的"最后一次出现"的值(因为同名骨骼可能有多个 mapping)
      - 这里简化处理:只映射有唯一目标的骨骼
    """
    # 先收集 src_armature 的 pose bones(按名字)
    src_pose = {b.name: b for b in src_armature.pose.bones}
    dst_pose = {b.name: b for b in dst_armature.pose.bones}

    # 反向映射:standard → [mixamo_names]
    std_to_mix = {}
    for mix, std in MIXAMO_BONE_MAP.items():
        std_to_mix.setdefault(std, []).append(mix)

    # 当前 src_armature 的 action
    if not src_armature.animation_data or not src_armature.animation_data.action:
        raise RuntimeError('FBX 没有动画 action')
    src_action = src_armature.animation_data.action

    # 准备 dst_action(空白,后面追加 fcurve)
    # Blender 的 action 可以被多个对象共享,所以我们直接复制 fcurve
    # 简化做法:把 src_action 复制一份,改名,然后改名其中的 bone 路径

    # 创建一个新的 action,按映射复制 fcurve
    new_action = bpy.data.actions.new(name='__imported')

    for fcurve in src_action.fcurves:
        # data_path 通常是 'pose.bones["mixamorig:Hips"].rotation_euler' 这种
        if 'pose.bones[' not in fcurve.data_path:
            continue
        # 提取 mixamo 骨骼名
        try:
            bone_name = fcurve.data_path.split('pose.bones[')[1].split(']')[0].strip('"\'')
        except (IndexError, ValueError):
            continue
        # 映射到 standard name
        std_name = MIXAMO_BONE_MAP.get(bone_name)
        if std_name is None or std_name not in dst_pose:
            continue
        # 新的 data_path:pose.bones["StdBone"].rotation_euler 等
        rest = fcurve.data_path.split(']', 1)[1]  # .rotation_euler 等
        new_path = f'pose.bones["{std_name}"]{rest}'
        new_fc = new_action.fcurves.new(
            data_path=new_path,
            index=fcurve.array_index,
        )
        # 复制 keyframes
        for kp in fcurve.keyframe_points:
            new_fc.keyframe_points.add(1)
            new_fc.keyframe_points[-1].co = (kp.co[0], kp.co[1])
            new_fc.keyframe_points[-1].interpolation = kp.interpolation
        new_fc.update()

    return new_action


def main():
    args = parse_args()
    if args.print_mapping:
        print_mapping_and_exit()

    if not os.path.isfile(args.fbx):
        print(f'ERROR: FBX 不存在: {args.fbx}', file=sys.stderr)
        sys.exit(1)
    if not os.path.isfile(args.target):
        print(f'ERROR: target GLB 不存在: {args.target}', file=sys.stderr)
        sys.exit(1)

    action_name = args.action_name or os.path.splitext(os.path.basename(args.fbx))[0]

    # 1. 清空场景,导入目标 GLB
    print(f'[import_mixamo] 加载目标 GLB: {args.target}')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=args.target)

    target_armature = find_armature(bpy.context.scene.objects)
    if not target_armature:
        print('ERROR: target GLB 里没有 armature', file=sys.stderr)
        sys.exit(1)
    print(f'[import_mixamo] 目标 armature: {target_armature.name}, '
          f'{len(target_armature.data.bones)} bones')

    # 2. 导入 Mixamo FBX 到独立集合,不污染当前 scene
    print(f'[import_mixamo] 导入 Mixamo FBX: {args.fbx}')
    fbx_collection_name = '__mixamo_import'
    fbx_coll = bpy.data.collections.new(fbx_collection_name)
    bpy.context.scene.collection.children.link(fbx_coll)
    prev_active = bpy.context.view_layer.active_layer_collection
    fbx_layer = bpy.context.view_layer.layer_collection.children.get(fbx_collection_name) \
        or bpy.context.view_layer.layer_collection

    # 用 temporary context 导入到独立 collection
    bpy.ops.object.select_all(action='DESELECT')

    # 临时复制一份 FBX 内容
    try:
        bpy.ops.import_scene.fbx(filepath=args.fbx)
    except Exception as e:
        print(f'ERROR: 导入 FBX 失败: {e}', file=sys.stderr)
        sys.exit(1)

    fbx_armature = find_armature(bpy.context.scene.objects)
    if not fbx_armature:
        print('ERROR: FBX 里没找到 armature', file=sys.stderr)
        sys.exit(1)
    print(f'[import_mixamo] FBX armature: {fbx_armature.name}, '
          f'{len(fbx_armature.data.bones)} bones')

    # 3. Retarget
    print('[import_mixamo] Retarget 骨骼映射...')
    mapped_count = 0
    for fcurve in (fbx_armature.animation_data.action.fcurves if fbx_armature.animation_data
                   and fbx_armature.animation_data.action else []):
        if 'pose.bones[' in fcurve.data_path:
            bone_name = fcurve.data_path.split('pose.bones[')[1].split(']')[0].strip('"\'')
            if bone_name in MIXAMO_BONE_MAP:
                mapped_count += 1
    print(f'[import_mixamo] 将映射 {mapped_count} 条 fcurve')

    new_action = remap_animation(fbx_armature, target_armature)

    # 4. 删掉 FBX 临时对象,只保留 target_armature 和它的 mesh
    bpy.data.objects.remove(fbx_armature, do_unlink=True)
    # 把其他临时对象也删
    for obj in list(bpy.context.scene.objects):
        if obj == target_armature:
            continue
        if obj.type == 'MESH' and obj.parent is None:
            # 可能 FBX 带 skin mesh,删掉
            bpy.data.objects.remove(obj, do_unlink=True)

    # 5. 把 new_action 附加到 target_armature,改名
    new_action.name = action_name
    if not target_armature.animation_data:
        target_armature.animation_data_create()
    # 不替换当前 action,而是 push 到 action list
    # Blender 的 armature 只能一个 active action,但 GLB 导出时会带所有 actions?
    # 简单做法:把现有 active action 和 new_action 都放到一个 marker 列表(用 fake_user)
    if target_armature.animation_data.action:
        existing = target_armature.animation_data.action
        existing.user_remap(new_action)
        # 保留现有 action + new_action
        target_armature.animation_data.action = new_action
        # 把 existing 标记成不会自动清掉的 fake_user
        existing.use_fake_user = True
    else:
        target_armature.animation_data.action = new_action

    print(f'[import_mixamo] 附加 action: {action_name}')

    # 6. 导出
    export_glb(args.output, 'avatar')
    print(f'[import_mixamo] 完成 → {args.output}')


if __name__ == '__main__':
    main()
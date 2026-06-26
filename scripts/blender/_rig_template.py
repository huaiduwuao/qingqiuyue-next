"""
_rig_template.py —— 共享的 Blender rig 模板。

被以下脚本 import:
  - build_avatar.py  (procedural primitives)
  - rig_mesh.py      (导入外部 mesh)
  - sculpt_blendshapes.py (真实雕刻)
  - import_mixamo.py (动作追加)

提供:
  - clear_scene()        清空场景
  - build_armature()     17 关节标准人形骨架
  - bind_mesh()          把 mesh 自动绑到 armature
  - bake_animation()     把关键帧写进 armature 的 action
  - 3 个 baked action    idle / wave / walk(占位,可被 Mixamo 覆盖)
  - export_glb()         GLB 导出(兼容 Blender 4.x 和 5.x)

不依赖 SMPL / FLAME / 任何外部模型。
"""

import bpy
import os
import math


# 标准骨骼名表 — 用于 Mixamo 映射 / 跨 rig 通信
STANDARD_BONES = [
    'Root',
    'Pelvis', 'Spine', 'Head',
    'Shoulder_L', 'Elbow_L', 'Hand_L',
    'Shoulder_R', 'Elbow_R', 'Hand_R',
    'Hip_L', 'Knee_L', 'Foot_L',
    'Hip_R', 'Knee_R', 'Foot_R',
]


def clear_scene():
    """清空场景 + 所有 mesh 数据。"""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh)


def build_armature(height=1.75, name='Armature'):
    """
    创建 17 关节标准人形骨架。
    不用 Blender 自带 Rigify(复杂 + 慢),手写一个 minimal 骨架。
    返回 armature object。
    """
    head_h = height * 0.13
    torso_h = height * 0.40
    arm_h = height * 0.32
    leg_h = height * 0.48
    body_w = height * 0.22

    bpy.ops.object.armature_add()
    armature = bpy.context.active_object
    armature.name = name
    bpy.ops.object.mode_set(mode='EDIT')

    # 删除默认 bone
    bpy.ops.armature.select_all(action='SELECT')
    bpy.ops.armature.delete()

    # 根骨盆
    bpy.ops.armature.bone_primitive_add(name='Root')
    root = armature.data.edit_bones['Root']
    root.head = (0, 0, 0)
    root.tail = (0, 0, 0.05)

    # 髋关节
    pelvis = armature.data.edit_bones.new('Pelvis')
    pelvis.parent = root
    pelvis.head = (0, 0, leg_h)
    pelvis.tail = (0, 0, leg_h + 0.05)

    # 脊椎
    spine = armature.data.edit_bones.new('Spine')
    spine.parent = pelvis
    spine.head = (0, 0, leg_h)
    spine.tail = (0, 0, leg_h + torso_h)

    # 头
    head = armature.data.edit_bones.new('Head')
    head.parent = spine
    head.head = (0, 0, leg_h + torso_h)
    head.tail = (0, 0, leg_h + torso_h + head_h)

    # 肩膀 + 手臂
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

    # 髋 + 腿
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

    # 进入 POSE 模式以便后续 bake_animation 操作
    return armature


def bind_mesh(mesh, armature):
    """把 mesh 自动绑到 armature(自动权重)。"""
    mesh.select_set(True)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')


def add_basic_blendshapes(mesh):
    """
    添加 12 个基础 BlendShape(表情 + 口型)。

    仅适用于程序化几何:用 z > 1.0 启发式找头部顶点。
    真实 mesh(来自 COLMAP/3DGS)应该用 sculpt_blendshapes.sculpt() 替代。

    Returns: list of shape key names.
    """
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.shape_key_add(from_mix=False)  # basis
    basis = mesh.data.shape_keys.key_blocks['Basis']

    def add_skshape(name, scale_z=1.0, scale_x=1.0, scale_y=1.0, dz=0.0, dy=0.0, dx=0.0):
        bpy.ops.object.shape_key_add(from_mix=False)
        kb = mesh.data.shape_keys.key_blocks[-1]
        kb.name = name
        for i, v in enumerate(mesh.data.vertices):
            if v.co.z > 1.0:  # 头部顶点(高于 1m)
                kb.data[i].co = (
                    v.co.x * scale_x + dx,
                    v.co.y * scale_y + dy,
                    v.co.z * scale_z + dz,
                )
            else:
                kb.data[i].co = v.co

    add_skshape('smile', dy=0.0)
    add_skshape('blink', scale_z=0.1, dy=-0.02)
    add_skshape('aa', scale_z=1.2, dy=0.03)
    add_skshape('sad', dy=-0.01)
    add_skshape('angry', dy=0.005)
    add_skshape('surprised', scale_z=1.4, scale_y=1.05, dy=0.05)
    add_skshape('ih', scale_z=1.1, dy=0.02, dx=0.005)
    add_skshape('ou', scale_z=1.15, dy=0.02)
    add_skshape('E', scale_z=1.05, dy=0.01, dx=0.01)
    add_skshape('O', scale_z=1.1, dy=0.015)
    add_skshape('U', scale_z=1.05, dy=0.005)
    add_skshape('closed', scale_z=0.95)

    return list(mesh.data.shape_keys.key_blocks.keys())


def bake_animation(armature, action_name, frames_fn, frame_count=60, fps=30):
    """
    在 armature 上创建一个 action 并烘焙关键帧。
    frames_fn(frame, bones): 给定帧号 + armature pose bones dict,设置 bone.rotation_euler。
    """
    action = bpy.data.actions.new(name=action_name)
    if not armature.animation_data:
        armature.animation_data_create()
    armature.animation_data.action = action

    bones = {b.name: b for b in armature.pose.bones}
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = frame_count
    scene.render.fps = fps

    for f in range(1, frame_count + 1):
        scene.frame_set(f)
        frames_fn(f, bones)
        for bone_name, bone in bones.items():
            bone.keyframe_insert(data_path='rotation_euler', frame=f)
            bone.keyframe_insert(data_path='location', frame=f)

    return action


def make_idle_action(armature):
    """idle: 轻微呼吸 + 微晃头"""
    def frame_fn(f, bones):
        phase = (f / 60.0) * 2 * math.pi
        head = bones.get('Head')
        if head:
            head.rotation_euler = (math.sin(phase) * 0.05, 0, math.sin(phase * 0.5) * 0.03)
        spine = bones.get('Spine')
        if spine:
            spine.rotation_euler = (math.sin(phase * 0.7) * 0.02, 0, 0)
    return bake_animation(armature, 'idle', frame_fn, frame_count=60)


def make_wave_action(armature):
    """wave: 抬右手摇摆"""
    def frame_fn(f, bones):
        phase = (f / 60.0) * 2 * math.pi
        r_shoulder = bones.get('Shoulder_R')
        r_elbow = bones.get('Elbow_R')
        if r_shoulder:
            r_shoulder.rotation_euler = (0, -2.5 + math.sin(phase) * 0.3, -0.3)
        if r_elbow:
            r_elbow.rotation_euler = (0, -2.0, 0)
    return bake_animation(armature, 'wave', frame_fn, frame_count=60)


def make_walk_action(armature):
    """walk: 左右腿交替摆动"""
    def frame_fn(f, bones):
        phase = (f / 60.0) * 2 * math.pi
        if bones.get('Knee_L'):
            bones['Knee_L'].rotation_euler = (math.sin(phase) * 0.5, 0, 0)
        if bones.get('Knee_R'):
            bones['Knee_R'].rotation_euler = (math.sin(phase + math.pi) * 0.5, 0, 0)
        if bones.get('Shoulder_L'):
            bones['Shoulder_L'].rotation_euler = (math.sin(phase + math.pi) * 0.3, 0, 0)
        if bones.get('Shoulder_R'):
            bones['Shoulder_R'].rotation_euler = (math.sin(phase) * 0.3, 0, 0)
    return bake_animation(armature, 'walk', frame_fn, frame_count=60)


def make_run_action(armature):
    """run: 步频更快 + 抬腿更高 + 摆臂更猛"""
    def frame_fn(f, bones):
        phase = (f / 30.0) * 2 * math.pi  # 2x 速度
        if bones.get('Knee_L'):
            bones['Knee_L'].rotation_euler = (math.sin(phase) * 0.9, 0, 0)
        if bones.get('Knee_R'):
            bones['Knee_R'].rotation_euler = (math.sin(phase + math.pi) * 0.9, 0, 0)
        if bones.get('Hip_L'):
            bones['Hip_L'].rotation_euler = (math.sin(phase) * 0.15, 0, 0)
        if bones.get('Hip_R'):
            bones['Hip_R'].rotation_euler = (math.sin(phase + math.pi) * 0.15, 0, 0)
        if bones.get('Shoulder_L'):
            bones['Shoulder_L'].rotation_euler = (math.sin(phase + math.pi) * 0.7, 0, 0)
        if bones.get('Shoulder_R'):
            bones['Shoulder_R'].rotation_euler = (math.sin(phase) * 0.7, 0, 0)
        # 整体身体轻微上下颠
        root = bones.get('Root')
        if root:
            root.location = (0, 0, abs(math.sin(phase * 2)) * 0.04)
    return bake_animation(armature, 'run', frame_fn, frame_count=45)  # 1.5s 循环


def make_dance_action(armature):
    """dance: 身体左右晃 + 双臂摆动 + 头摆"""
    def frame_fn(f, bones):
        phase = (f / 60.0) * 2 * math.pi
        # 身体左右晃
        spine = bones.get('Spine')
        if spine:
            spine.rotation_euler = (0, math.sin(phase) * 0.25, 0)
        # 头随身体摆
        head = bones.get('Head')
        if head:
            head.rotation_euler = (math.sin(phase * 1.3) * 0.1, 0, math.sin(phase) * 0.15)
        # 双臂轮流抬
        r_shoulder = bones.get('Shoulder_R')
        l_shoulder = bones.get('Shoulder_L')
        if r_shoulder:
            r_shoulder.rotation_euler = (0, -2.2 + math.sin(phase) * 0.4, -0.4)
        if l_shoulder:
            l_shoulder.rotation_euler = (0, 2.2 + math.sin(phase + math.pi) * 0.4, 0.4)
        # 双腿轻摇
        if bones.get('Knee_L'):
            bones['Knee_L'].rotation_euler = (math.sin(phase * 2) * 0.15, 0, 0)
        if bones.get('Knee_R'):
            bones['Knee_R'].rotation_euler = (math.sin(phase * 2 + math.pi) * 0.15, 0, 0)
    return bake_animation(armature, 'dance', frame_fn, frame_count=90)  # 3s 循环


def make_sit_action(armature):
    """sit: 双腿弯曲 90° + 身体下沉"""
    def frame_fn(f, bones):
        # 第 1 帧开始坐下,中间保持,最后 10 帧回站立(让循环自然)
        progress = f / 60.0  # 0 -> 1
        if progress < 0.5:
            t = progress * 2  # 0 -> 1 (坐下)
        else:
            t = 1.0  # 保持坐
        # 双腿弯 90°
        for knee_name in ('Knee_L', 'Knee_R'):
            knee = bones.get(knee_name)
            if knee:
                knee.rotation_euler = (t * 1.5, 0, 0)  # ~85°
        # 臀部轻沉
        root = bones.get('Root')
        if root:
            root.location = (0, 0, -t * 0.35)
        # 上身略前倾
        spine = bones.get('Spine')
        if spine:
            spine.rotation_euler = (t * 0.15, 0, 0)
    return bake_animation(armature, 'sit', frame_fn, frame_count=60)


def make_point_action(armature):
    """point: 抬右臂指向前方 + 头微低(看指的方向)"""
    def frame_fn(f, bones):
        phase = (f / 60.0) * 2 * math.pi
        # 右臂抬平,前伸 + 食指伸出(用单骨近似)
        r_shoulder = bones.get('Shoulder_R')
        r_elbow = bones.get('Elbow_R')
        if r_shoulder:
            r_shoulder.rotation_euler = (0, -1.5, 0)  # 前伸
        if r_elbow:
            r_elbow.rotation_euler = (0, -0.1, 0)  # 微弯
        # 头跟手臂方向
        head = bones.get('Head')
        if head:
            head.rotation_euler = (0, math.sin(phase) * 0.05, math.sin(phase) * 0.05)
        # 左手自然下垂(微动)
        l_shoulder = bones.get('Shoulder_L')
        if l_shoulder:
            l_shoulder.rotation_euler = (math.sin(phase) * 0.05, 0, 0)
    return bake_animation(armature, 'point', frame_fn, frame_count=60)


def make_think_action(armature):
    """think: 右手托下巴(头微低)+ 身体略前倾"""
    def frame_fn(f, bones):
        phase = (f / 60.0) * 2 * math.pi
        # 头微低(思考)
        head = bones.get('Head')
        if head:
            head.rotation_euler = (0.3, math.sin(phase) * 0.04, 0)
        # 身体前倾
        spine = bones.get('Spine')
        if spine:
            spine.rotation_euler = (0.1, 0, 0)
        # 右手弯曲,上抬到下巴位置
        r_shoulder = bones.get('Shoulder_R')
        r_elbow = bones.get('Elbow_R')
        if r_shoulder:
            r_shoulder.rotation_euler = (0, -1.8, -0.3)
        if r_elbow:
            r_elbow.rotation_euler = (-0.3, -2.2, 0)  # 前臂水平
    return bake_animation(armature, 'think', frame_fn, frame_count=60)


def make_talk_action(armature):
    """talk: 双臂微张 + 头随节奏摆(像在说话时打手势)"""
    def frame_fn(f, bones):
        phase = (f / 60.0) * 2 * math.pi
        # 头随节奏点头 + 摆
        head = bones.get('Head')
        if head:
            head.rotation_euler = (math.sin(phase * 1.5) * 0.08, math.sin(phase) * 0.1, 0)
        # 双臂抬起到胸前,微张(打手势)
        for side_sign, shoulder_name, elbow_name in [(+1, 'Shoulder_R', 'Elbow_R'), (-1, 'Shoulder_L', 'Elbow_L')]:
            sh = bones.get(shoulder_name)
            el = bones.get(elbow_name)
            if sh:
                sh.rotation_euler = (0, -1.0 + math.sin(phase + side_sign) * 0.3, side_sign * 0.4)
            if el:
                el.rotation_euler = (-0.8, math.sin(phase * 1.5 + side_sign) * 0.2, 0)
    return bake_animation(armature, 'talk', frame_fn, frame_count=60)


def make_bow_action(armature):
    """bow: 上身前倾 30°(鞠躬) + 头更前倾"""
    def frame_fn(f, bones):
        progress = f / 60.0
        if progress < 0.3:
            t = progress / 0.3  # 0 -> 1 (弯腰)
        elif progress < 0.7:
            t = 1.0  # 保持鞠躬
        else:
            t = (1.0 - progress) / 0.3  # 1 -> 0 (直起)
        # 脊椎前倾
        spine = bones.get('Spine')
        if spine:
            spine.rotation_euler = (t * 0.5, 0, 0)  # ~30°
        # 头更前倾
        head = bones.get('Head')
        if head:
            head.rotation_euler = (t * 0.4, 0, 0)
    return bake_animation(armature, 'bow', frame_fn, frame_count=60)


# 10 个 baked action(标准动作库)
BUILTIN_ACTIONS = [
    ('idle', make_idle_action, 60),
    ('wave', make_wave_action, 60),
    ('walk', make_walk_action, 60),
    ('run', make_run_action, 45),
    ('dance', make_dance_action, 90),
    ('sit', make_sit_action, 60),
    ('point', make_point_action, 60),
    ('think', make_think_action, 60),
    ('talk', make_talk_action, 60),
    ('bow', make_bow_action, 60),
]


def make_all_builtin_actions(armature):
    """一次性 bake 全部 10 个内置 action 到 armature"""
    out = []
    for name, fn, _ in BUILTIN_ACTIONS:
        out.append(fn(armature))
        print(f'[_rig_template] baked action: {name}')
    return out


def export_glb(output_path, scene_name='avatar'):
    """导出 GLB 格式(兼容 Blender 4.x 和 5.x)"""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    kwargs = dict(
        filepath=output_path,
        export_format='GLB',
        export_apply=True,
        export_animations=True,
        export_morph=True,
        export_skins=True,
    )
    try:
        bpy.ops.export_scene.gltf(export_armature=True, **kwargs)
    except TypeError:
        # Blender 5+ 没有 export_armature 参数
        bpy.ops.export_scene.gltf(**kwargs)
    print(f'[_rig_template] GLB 已写入: {output_path}')
    sz = os.path.getsize(output_path) / 1024
    print(f'[_rig_template] 大小: {sz:.1f} KB')


# Mixamo → 自建骨骼名映射表(由 import_mixamo.py 使用)
MIXAMO_BONE_MAP = {
    'mixamorig:Hips': 'Pelvis',
    'mixamorig:Spine': 'Spine',
    'mixamorig:Spine1': 'Spine',
    'mixamorig:Spine2': 'Spine',
    'mixamorig:Neck': 'Head',
    'mixamorig:Head': 'Head',
    'mixamorig:LeftShoulder': 'Shoulder_L',
    'mixamorig:LeftArm': 'Elbow_L',
    'mixamorig:LeftForeArm': 'Hand_L',
    'mixamorig:LeftHand': 'Hand_L',
    'mixamorig:RightShoulder': 'Shoulder_R',
    'mixamorig:RightArm': 'Elbow_R',
    'mixamorig:RightForeArm': 'Hand_R',
    'mixamorig:RightHand': 'Hand_R',
    'mixamorig:LeftUpLeg': 'Hip_L',
    'mixamorig:LeftLeg': 'Knee_L',
    'mixamorig:LeftFoot': 'Foot_L',
    'mixamorig:LeftToeBase': 'Foot_L',
    'mixamorig:RightUpLeg': 'Hip_R',
    'mixamorig:RightLeg': 'Knee_R',
    'mixamorig:RightFoot': 'Foot_R',
    'mixamorig:RightToeBase': 'Foot_R',
}
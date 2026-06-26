"""
glb-to-vrm.py —— 把现有 model.glb 包装成 minimal .vrm

VRM 0.0 = GLB + VRMC_vrm-1.0 扩展
扩展需要:
  - meta(名称 / 版本 / 作者 / license)
  - humanoid(humanBones 映射 56+ 骨头)
  - blendShapeMaster(blendShapeGroups 表情分组)
  - secondaryAnimation(可选)

用法:
  python scripts/glb-to-vrm.py \\
      --glb public/avatars/model.glb \\
      --vrm public/avatars/character.vrm
"""

import argparse
import json
import struct
import sys


def parse_args():
    ap = argparse.ArgumentParser()
    ap.add_argument('--glb', required=True, help='输入 GLB 路径')
    ap.add_argument('--vrm', required=True, help='输出 VRM 路径')
    return ap.parse_args()


def read_glb(path):
    with open(path, 'rb') as f:
        magic, ver, total = struct.unpack('<4sII', f.read(12))
        if magic != b'glTF' or ver != 2:
            raise ValueError(f'not a glb 2.0: {magic} {ver}')
        chunk_len, chunk_type = struct.unpack('<I4s', f.read(8))
        if chunk_type != b'JSON':
            raise ValueError(f'first chunk must be JSON, got {chunk_type}')
        json_str = f.read(chunk_len).decode('utf-8')
        json_chunk = json.loads(json_str)
        # 读 bin chunk
        bin_chunk_len, bin_chunk_type = struct.unpack('<I4s', f.read(8))
        if bin_chunk_type != b'BIN\0':
            raise ValueError(f'second chunk must be BIN, got {bin_chunk_type}')
        bin_chunk = f.read(bin_chunk_len)
        return json_chunk, bin_chunk


def write_glb(path, json_chunk, bin_chunk):
    with open(path, 'wb') as f:
        json_bytes = json.dumps(json_chunk, ensure_ascii=False).encode('utf-8')
        # 对齐到 4 字节
        json_pad = (4 - len(json_bytes) % 4) % 4
        json_bytes += b' ' * json_pad
        bin_pad = (4 - len(bin_chunk) % 4) % 4
        bin_chunk_padded = bin_chunk + b'\x00' * bin_pad
        total = 12 + 8 + len(json_bytes) + 8 + len(bin_chunk_padded)
        f.write(struct.pack('<4sII', b'glTF', 2, total))
        f.write(struct.pack('<I4s', len(json_bytes), b'JSON'))
        f.write(json_bytes)
        f.write(struct.pack('<I4s', len(bin_chunk_padded), b'BIN\0'))
        f.write(bin_chunk_padded)


def mesh_to_skin_bones(mesh_idx, json_data):
    """简单:用 mesh 名推骨头(Variant 名字 → 17 个我们标准骨头)"""
    mesh = json_data['meshes'][mesh_idx]
    # 找第一个 joint
    if 'primitives' not in mesh or not mesh['primitives']:
        return None
    p = mesh['primitives'][0]
    if 'attributes' not in p or 'JOINTS_0' not in p['attributes']:
        return None
    joints_acc = json_data['accessors'][p['attributes']['JOINTS_0']]
    return joints_acc


def make_vrm_metadata():
    return {
        'name': 'qingqiuyue-avatar',
        'version': '1.0.0',
        'authors': ['qingqiuyue-pipeline'],
        'copyrightInformation': '',
        'licenseName': 'CC0',
        'licenseUrl': 'https://creativecommons.org/publicdomain/zero/1.0/',
        'contactInformation': '',
        'references': [],
        'thirdPartyLicenses': '',
    }


def make_vrm_humanoid():
    """VRM 0.0 humanoid bones - 简化为只指 1 个 node,避免 headless swiftshader SkinnedMesh bug

    空 humanoid 不会让 three-vrm 抛错,但不会做 humanoid IK 修正。
    vertex 直接按 GLB 里的 skin 数据渲染。
    """
    return {
        'humanBones': {
            'hips': {'node': 0},  # 占位,让 three-vrm 加载 OK
        },
    }


def make_vrm_blendshape_master(json_data):
    """把现有 morph 重新分组(预设 / 表情)"""
    groups = []
    PRESET = {
        'neutral': [],
        'joy': [{'node': None, 'index': None, 'weight': 1.0}],  # mapped from 'smile'
        'angry': [],
        'sorrow': [],  # mapped from 'sad'
        'fun': [],  # mapped from 'surprised'
        'blink': [],
    }
    # 收集所有 mesh 的 morph 名字(找同名)
    name_to_mesh_idx = {}
    for mi, m in enumerate(json_data['meshes']):
        if 'extras' in m and 'targetNames' in m['extras']:
            for idx, name in enumerate(m['extras']['targetNames']):
                if name not in name_to_mesh_idx:
                    name_to_mesh_idx[name] = (mi, idx)

    for preset_name, refs in PRESET.items():
        grp = {'name': preset_name, 'presets': [], 'bind': [], 'materialValues': []}
        if preset_name == 'joy':
            for m_name in ['smile']:
                if m_name in name_to_mesh_idx:
                    mi, idx = name_to_mesh_idx[m_name]
                    grp['bind'].append({'node': mi, 'index': idx})
        elif preset_name == 'angry':
            for m_name in ['angry']:
                if m_name in name_to_mesh_idx:
                    mi, idx = name_to_mesh_idx[m_name]
                    grp['bind'].append({'node': mi, 'index': idx})
        elif preset_name == 'sorrow':
            for m_name in ['sad']:
                if m_name in name_to_mesh_idx:
                    mi, idx = name_to_mesh_idx[m_name]
                    grp['bind'].append({'node': mi, 'index': idx})
        elif preset_name == 'fun':
            for m_name in ['surprised']:
                if m_name in name_to_mesh_idx:
                    mi, idx = name_to_mesh_idx[m_name]
                    grp['bind'].append({'node': mi, 'index': idx})
        elif preset_name == 'blink':
            for m_name in ['blink']:
                if m_name in name_to_mesh_idx:
                    mi, idx = name_to_mesh_idx[m_name]
                    grp['bind'].append({'node': mi, 'index': idx})
        if grp['bind'] or grp['presets']:
            groups.append(grp)

    # 表情 blendShapeGroups(VRM 用)
    return {
        'blendShapeGroups': [
            {
                'name': name,
                'presets': [],
                'bind': refs,
                'materialValues': [],
                'isBinary': False,
            }
            for name, refs in [
                ('Neutral', []),
                ('Joy', []),  # smile
                ('Angry', []),
                ('Sorrow', []),
                ('Fun', []),
                ('Blink', []),
            ]
            if refs
        ],
    }


def main():
    args = parse_args()
    json_data, bin_chunk = read_glb(args.glb)
    print(f'Loaded GLB: {len(json_data["meshes"])} meshes, '
          f'{len(json_data.get("animations", []))} animations')

    # 加 VRM 扩展
    json_data['extensionsUsed'] = list(json_data.get('extensionsUsed', [])) + ['VRMC_vrm-1.0']
    json_data['extensions'] = json_data.get('extensions', {})
    json_data['extensions']['VRMC_vrm-1.0'] = {
        'specVersion': '1.0',
        'meta': make_vrm_metadata(),
        'humanoid': make_vrm_humanoid(),
        'blendShapeMaster': make_vrm_blendshape_master(json_data),
    }

    write_glb(args.vrm, json_data, bin_chunk)
    print(f'Wrote VRM: {args.vrm}')
    print(f'Size: {os.path.getsize(args.vrm):,} bytes')


import os

if __name__ == '__main__':
    main()

#!/usr/bin/env python3
# ============================================================================
# 把 ExAvatar / GauHuman 的训练产物 → 前端 assetFormat.ts 约定的格式
# (meta.json / smplx.json / gaussians.bin / skinning.bin / avatar.ply)
#
# 用法:
#   python convert-exavatar.py \
#     --exavatar-dir ./output/xiaoqiu/train \
#     --data-dir ./avatar-train/xiaoqiu/data \
#     --subject xiaoqiu \
#     --out ./output/xiaoqiu
#
# ⚠️  这是一个适配器模板。ExAvatar / GauHuman 的实际产物路径和字段名
# 随版本变化,请按需调整 READER 部分(找注释 # ⚙️ ADAPT 的地方)。
#
# 输出的 .bin 布局(必须与 src/digital-human/gs/assetFormat.ts 一致):
#   gaussians.bin: [pos3, scale3, rot4, opacity1, sh48] * n  (Float32)
#   skinning.bin:  [j0..j3 (uint16 LE), w0..w3 (float32 LE)] * n
#   smplx.json:    { parents: int[], restJoints: float[] (xyz 串联), flameBasis?: float[] }
#   meta.json:     { count, jointCount, hasFlame, up, flameDim? }
#   avatar.ply:    可视化版高斯(给 mkkellogg Viewer 加载)
# ============================================================================
import argparse
import json
import struct
from pathlib import Path

import numpy as np

# ─── ⚙️ ADAPT: ExAvatar / GauHuman 的具体读取器 ────────────────────────────
def read_exavatar_point_cloud(pc_dir: Path):
    """
    读取训练出来的高斯点云。
    ExAvatar 通常在 output/<subj>/train/point_cloud/iteration_30000/point_cloud.ply
    字段: x,y,z, nx,ny,nz, f_dc_0..2 (SH DC 3), f_rest_0..44 (SH rest 45),
          opacity, scale_0..2, rot_0..3 (wxyz)
    """
    from plyfile import PlyData
    # ⚙️ ADAPT: 找最新的 iteration 目录
    candidates = sorted(pc_dir.glob("point_cloud/iteration_*"))
    if not candidates:
        # GauHuman 风格
        candidates = sorted(pc_dir.glob("point_cloud/iteration_*"))
    if not candidates:
        raise FileNotFoundError(f"找不到 point_cloud: {pc_dir}")
    latest = candidates[-1]
    print(f"  读点云: {latest}/point_cloud.ply")
    ply = PlyData.read(str(latest / "point_cloud.ply"))
    v = ply["vertex"].data
    n = len(v)
    pos = np.stack([v["x"], v["y"], v["z"]], axis=1).astype(np.float32)
    # 3DGS 的 scale 是 log(scale), 旋转是 (w,x,y,z) → 我们要 (x,y,z,w)
    scale = np.stack([v["scale_0"], v["scale_1"], v["scale_2"]], axis=1).astype(np.float32)
    scale = np.exp(scale)  # 反 log
    rot = np.stack([v["rot_0"], v["rot_1"], v["rot_2"], v["rot_3"]], axis=1).astype(np.float32)
    rot = rot[:, [1, 2, 3, 0]]  # wxyz → xyzw
    rot /= np.linalg.norm(rot, axis=1, keepdims=True) + 1e-8
    opacity = (1 / (1 + np.exp(-v["opacity"]))).astype(np.float32)  # 反 sigmoid
    # SH DC 3 + rest 45 = 48 通道
    sh = np.zeros((n, 48), dtype=np.float32)
    sh[:, 0:3] = np.stack([v["f_dc_0"], v["f_dc_1"], v["f_dc_2"]], axis=1)
    if "f_rest_0" in v.dtype.names:
        rest = np.stack([v[f"f_rest_{i}"] for i in range(45)], axis=1).astype(np.float32)
        sh[:, 3:48] = rest
    return n, pos, scale, rot, opacity, sh


def read_smplx_template(data_dir: Path):
    """
    读 SMPL-X 模板(关节父节点 + rest pose)。
    ⚙️ ADAPT: ExAvatar 在 preprocess 时会输出 smplx/00000.json 之类,
    parents 来自 SMPL-X 模型本身的 kinship 表。
    """
    # ⚙️ ADAPT: 按你的 preprocess 实际产物改路径
    smplx_dir = data_dir / "smplx"
    files = sorted(smplx_dir.glob("*.json"))
    if not files:
        raise FileNotFoundError(f"找不到 smplx 帧: {smplx_dir}")
    # 关节父节点 SMPL-X 标准 55 关节 (含手+脸), 你 preprocess 时应当输出
    # parents.json; 没有就 hardcode 标准 SMPL-X 父节点
    parents_path = data_dir / "smplx_parents.json"
    if parents_path.exists():
        parents = json.loads(parents_path.read_text())
    else:
        # 标准 SMPL-X 55 关节父节点(根 pelvis = -1)
        parents = [-1, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 9, 12, 13, 14, 16, 17, 18, 19, 20, 21, 15, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51]
    # rest joints: 取第 0 帧
    first = json.loads(files[0].read_text())
    # ⚙️ ADAPT: 字段名看你 preprocess 输出
    rest_joints = np.asarray(first.get("joints") or first.get("joints3d") or first.get("betas"), dtype=np.float32).flatten()
    if rest_joints.size < 55 * 3:
        rest_joints = np.zeros(55 * 3, dtype=np.float32)
    return parents, rest_joints


def read_skinning_weights(pc_dir: Path, n: int):
    """
    读每高斯的 LBS 蒙皮(最多 4 关节)。
    ⚙️ ADAPT: ExAvatar 通常把 skinning weights 存在 .npy / .pt / 额外 .ply 属性,
    按你 preprocess 实际产物改。
    """
    # 例 1: 单独 .npy
    wpath = pc_dir / "skinning_weights.npy"
    if wpath.exists():
        w = np.load(wpath).astype(np.float32)  # (n, J) 或 (n, 4)
        if w.shape[1] > 4:
            top4 = np.argpartition(-w, kth=4, axis=1)[:, :4]
            j = top4.astype(np.uint16)
            w4 = np.take_along_axis(w, top4, axis=1)
        else:
            j = np.zeros((n, 4), dtype=np.uint16)
            w4 = w
        w4 = w4 / (w4.sum(axis=1, keepdims=True) + 1e-8)
        return j, w4.astype(np.float32)

    # 例 2: 兜底 — 全绑到 root (关节 0), 全身不形变
    print("  ⚠️ 找不到 skinning weights, 退化为绑根(无 LBS 形变)")
    return np.zeros((n, 4), dtype=np.uint16), np.tile([1, 0, 0, 0], (n, 1)).astype(np.float32)


# ─── WRITER: 写前端 assetFormat ────────────────────────────────────────────
def write_gaussians_bin(path: Path, pos, scale, rot, opacity, sh):
    assert pos.shape[1] == 3 and scale.shape[1] == 3 and rot.shape[1] == 4 and sh.shape[1] == 48
    n = pos.shape[0]
    arr = np.concatenate([pos, scale, rot, opacity.reshape(-1, 1), sh], axis=1).astype(np.float32)
    path.write_bytes(arr.tobytes())
    print(f"  写 gaussians.bin: {path} ({n} points, {arr.nbytes/1e6:.1f} MB)")


def write_skinning_bin(path: Path, joints, weights):
    n = joints.shape[0]
    with path.open("wb") as f:
        for i in range(n):
            f.write(struct.pack("<4H", *joints[i]))   # uint16 LE x4
            f.write(struct.pack("<4f", *weights[i]))  # float32 LE x4
    print(f"  写 skinning.bin: {path} ({n} points)")


def write_smplx_json(path: Path, parents, rest_joints, flame_basis=None):
    obj = {
        "parents": list(parents),
        "restJoints": rest_joints.astype(float).tolist(),
    }
    if flame_basis is not None:
        obj["flameBasis"] = flame_basis.astype(float).tolist()
    path.write_text(json.dumps(obj))
    print(f"  写 smplx.json: {path} ({len(parents)} joints)")


def write_meta_json(path: Path, n, joint_count, has_flame=False, flame_dim=0, up="-y"):
    obj = {
        "count": int(n),
        "jointCount": int(joint_count),
        "hasFlame": bool(has_flame),
        "up": up,
    }
    if has_flame and flame_dim:
        obj["flameDim"] = int(flame_dim)
    path.write_text(json.dumps(obj, indent=2))
    print(f"  写 meta.json: {path}")


def write_avatar_ply(path: Path, pos, scale, rot, opacity, sh):
    """
    可视化 .ply (mkkellogg Viewer 直接加载)。
    字段顺序按 mkkellogg/gaussian-splats-3d 期望: x,y,z, nx,ny,nz, f_dc_*, f_rest_*, opacity, scale_*, rot_*
    """
    n = pos.shape[0]
    # 3DGS 存的是 log(scale) 和 wxyz 旋转; 还原回去
    scale_log = np.log(scale + 1e-8).astype(np.float32)
    rot_wxyz = rot[:, [3, 0, 1, 2]].astype(np.float32)
    opa_logit = np.log(opacity / (1 - opacity + 1e-8) + 1e-8).astype(np.float32)

    dtype = [
        ("x", "f4"), ("y", "f4"), ("z", "f4"),
        ("nx", "f4"), ("ny", "f4"), ("nz", "f4"),
    ]
    # f_dc_0..2
    for i in range(3):
        dtype.append((f"f_dc_{i}", "f4"))
    # f_rest_0..44
    for i in range(45):
        dtype.append((f"f_rest_{i}", "f4"))
    dtype.extend([
        ("opacity", "f4"),
        ("scale_0", "f4"), ("scale_1", "f4"), ("scale_2", "f4"),
        ("rot_0", "f4"), ("rot_1", "f4"), ("rot_2", "f4"), ("rot_3", "f4"),
    ])

    arr = np.empty(n, dtype=dtype)
    arr["x"], arr["y"], arr["z"] = pos[:, 0], pos[:, 1], pos[:, 2]
    arr["nx"], arr["ny"], arr["nz"] = 0, 0, 0
    for i in range(3):
        arr[f"f_dc_{i}"] = sh[:, i]
    for i in range(45):
        arr[f"f_rest_{i}"] = sh[:, 3 + i]
    arr["opacity"] = opa_logit
    arr["scale_0"], arr["scale_1"], arr["scale_2"] = scale_log[:, 0], scale_log[:, 1], scale_log[:, 2]
    arr["rot_0"], arr["rot_1"], arr["rot_2"], arr["rot_3"] = rot_wxyz[:, 0], rot_wxyz[:, 1], rot_wxyz[:, 2], rot_wxyz[:, 3]

    from plyfile import PlyData, PlyElement
    el = PlyElement.describe(arr, "vertex")
    PlyData([el]).write(str(path))
    print(f"  写 avatar.ply: {path} ({n} points)")


# ─── main ──────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--exavatar-dir", required=True, help="ExAvatar/GauHuman output 目录(含 point_cloud/)")
    ap.add_argument("--data-dir", required=True, help="预处理数据目录(含 smplx/ 帧)")
    ap.add_argument("--subject", required=True)
    ap.add_argument("--out", required=True, help="输出目录,前端会从这个目录读")
    ap.add_argument("--no-flame", action="store_true", help="不带 FLAME 表情")
    args = ap.parse_args()

    ex_dir = Path(args.exavatar_dir)
    data_dir = Path(args.data_dir)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    print("▶ 1) 读点云")
    n, pos, scale, rot, opacity, sh = read_exavatar_point_cloud(ex_dir)

    print("▶ 2) 读 SMPL-X 模板")
    parents, rest_joints = read_smplx_template(data_dir)
    joint_count = len(parents)

    print("▶ 3) 读 skinning weights")
    joints, weights = read_skinning_weights(ex_dir, n)

    print("▶ 4) 写产物")
    write_gaussians_bin(out_dir / "gaussians.bin", pos, scale, rot, opacity, sh)
    write_skinning_bin(out_dir / "skinning.bin", joints, weights)
    write_smplx_json(out_dir / "smplx.json", parents, rest_joints)
    write_meta_json(out_dir / "meta.json", n, joint_count, has_flame=not args.no_flame, flame_dim=50)
    write_avatar_ply(out_dir / "avatar.ply", pos, scale, rot, opacity, sh)

    print(f"\n✅ 完成。5 个文件在 {out_dir}:")
    for f in sorted(out_dir.iterdir()):
        print(f"  {f.name:20s} {f.stat().st_size/1024/1024:8.2f} MB")


if __name__ == "__main__":
    main()

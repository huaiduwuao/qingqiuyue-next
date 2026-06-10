#!/usr/bin/env python3
# ============================================================================
# convert-gauhuman.py —— GauHuman 训练产物 → 前端 assetFormat.ts 约定的格式
# (meta.json / smplx.json / gaussians.bin / skinning.bin / avatar.ply)
#
# 与 convert-exavatar.py 的区别:
#   - 只针对 GauHuman,产物布局明确(smpl 24 关节,默认中性)
#   - 主动读 GauHuman 的 canonical.ply / skinning_weight.npy / canonical_joints.npy
#   - GauHuman 不输出 SMPL-X,只有 SMPL(24 关节)。前端会按 jointCount=24 跑
#
# 用法:
#   python convert-gauhuman.py \
#     --gauhuman-dir /root/GauHuman/output/xiaoqiu \
#     --out /root/output/xiaoqiu
#
# 期望的 GauHuman 输出(默认训练完成后):
#   <gauhuman-dir>/point_cloud/iteration_30000/point_cloud.ply
#   <gauhuman-dir>/canonical_joints.npy    # (J, 3) float32
#   <gauhuman-dir>/skinning_weight.npy     # (N, J) float32  ← 可选,缺失就全绑根
#   <gauhuman-dir>/metadata.json          # 含 gender, subject, fps 等
#
# 产物:
#   meta.json, smplx.json (实为 SMPL)
#   gaussians.bin, skinning.bin, avatar.ply
# ============================================================================
import argparse
import json
import struct
from pathlib import Path

import numpy as np

# SMPL 24 关节父节点(根 pelvis = -1)
SMPL_PARENTS = [
    -1, 0, 0, 0, 1, 2, 3, 4, 5, 6,
    7, 8, 9, 9, 9, 12, 13, 14, 16, 17,
    18, 19, 20, 21,
]
SMPL_JOINT_COUNT = len(SMPL_PARENTS)


# ─── READERS ───────────────────────────────────────────────────────────────
def read_gauhuman_point_cloud(pc_dir: Path):
    """
    GauHuman 在 output/<subj>/point_cloud/iteration_30000/point_cloud.ply
    与 3DGS 字段完全一致(同源):pos3 + f_dc/f_rest + opacity(logit) + scale(log) + rot(wxyz)
    """
    from plyfile import PlyData
    iter_dirs = sorted(pc_dir.glob("iteration_*"))
    if not iter_dirs:
        raise FileNotFoundError(f"找不到 iteration_*: {pc_dir}")
    latest = iter_dirs[-1]
    ply_path = latest / "point_cloud.ply"
    print(f"  读点云: {ply_path}")
    ply = PlyData.read(str(ply_path))
    v = ply["vertex"].data
    n = len(v)
    pos = np.stack([v["x"], v["y"], v["z"]], axis=1).astype(np.float32)
    # 3DGS 存的是 log(scale) 和 wxyz 旋转
    scale_log = np.stack([v["scale_0"], v["scale_1"], v["scale_2"]], axis=1).astype(np.float32)
    scale = np.exp(scale_log)
    rot_wxyz = np.stack([v["rot_0"], v["rot_1"], v["rot_2"], v["rot_3"]], axis=1).astype(np.float32)
    rot = rot_wxyz[:, [1, 2, 3, 0]]  # → xyzw
    rot /= np.linalg.norm(rot, axis=1, keepdims=True) + 1e-8
    opacity_logit = v["opacity"].astype(np.float32)
    opacity = 1 / (1 + np.exp(-opacity_logit))
    # SH DC 3 + rest 45 = 48
    sh = np.zeros((n, 48), dtype=np.float32)
    sh[:, 0:3] = np.stack([v["f_dc_0"], v["f_dc_1"], v["f_dc_2"]], axis=1)
    if "f_rest_0" in v.dtype.names:
        rest = np.stack([v[f"f_rest_{i}"] for i in range(45)], axis=1).astype(np.float32)
        sh[:, 3:48] = rest
    return n, pos, scale, rot, opacity, sh


def read_canonical_joints(gauhuman_dir: Path):
    """
    GauHuman 会存 canonical_joints.npy(静止姿态的关节全局位置)。
    没有的话给零(数字人不会按 pose 形变,但 .ply 仍可见)。
    """
    p = gauhuman_dir / "canonical_joints.npy"
    if p.exists():
        j = np.load(p).astype(np.float32)
        # 兼容 (J,3) 或 (J*3,) 两种布局
        if j.ndim == 2 and j.shape[1] == 3:
            return j.flatten()
        return j.flatten()
    print("  ⚠️ 找不到 canonical_joints.npy,使用零位")
    return np.zeros(SMPL_JOINT_COUNT * 3, dtype=np.float32)


def read_skinning_weights(gauhuman_dir: Path, n: int):
    """
    GauHuman 把蒙皮权重存成 skinning_weight.npy,shape = (N, 24)。
    """
    p = gauhuman_dir / "skinning_weight.npy"
    if not p.exists():
        print("  ⚠️ 找不到 skinning_weight.npy,退化为绑根(无 LBS 形变)")
        return (
            np.zeros((n, 4), dtype=np.uint16),
            np.tile([1.0, 0, 0, 0], (n, 1)).astype(np.float32),
        )
    w = np.load(p).astype(np.float32)
    if w.shape[0] != n:
        raise ValueError(f"skinning_weight 行数 {w.shape[0]} ≠ 点数 {n}")
    # 取 top-4
    if w.shape[1] > 4:
        top4 = np.argpartition(-w, kth=4, axis=1)[:, :4]
        j = top4.astype(np.uint16)
        w4 = np.take_along_axis(w, top4, axis=1)
    else:
        j = np.zeros((n, 4), dtype=np.uint16)
        w4 = w
    w4 = w4 / (w4.sum(axis=1, keepdims=True) + 1e-8)
    return j, w4.astype(np.float32)


# ─── WRITERS(同 convert-exavatar.py 的二进制布局)──────────────────────
def write_gaussians_bin(path, pos, scale, rot, opacity, sh):
    assert pos.shape[1] == 3 and scale.shape[1] == 3 and rot.shape[1] == 4 and sh.shape[1] == 48
    n = pos.shape[0]
    arr = np.concatenate([pos, scale, rot, opacity.reshape(-1, 1), sh], axis=1).astype(np.float32)
    path.write_bytes(arr.tobytes())
    print(f"  写 gaussians.bin: {path} ({n} points, {arr.nbytes/1e6:.1f} MB)")


def write_skinning_bin(path, joints, weights):
    n = joints.shape[0]
    with path.open("wb") as f:
        for i in range(n):
            f.write(struct.pack("<4H", *joints[i]))
            f.write(struct.pack("<4f", *weights[i]))
    print(f"  写 skinning.bin: {path} ({n} points)")


def write_smplx_json(path, parents, rest_joints):
    obj = {"parents": list(parents), "restJoints": rest_joints.astype(float).tolist()}
    path.write_text(json.dumps(obj))
    print(f"  写 smplx.json: {path} ({len(parents)} joints,注意:GauHuman 是 SMPL 24 关节,不是 SMPL-X)")


def write_meta_json(path, n, joint_count, up="-y"):
    obj = {
        "count": int(n),
        "jointCount": int(joint_count),
        "hasFlame": False,  # GauHuman 不带 FLAME
        "up": up,
    }
    path.write_text(json.dumps(obj, indent=2))
    print(f"  写 meta.json: {path}")


def write_avatar_ply(path, pos, scale, rot, opacity, sh):
    """写 mkkellogg / Spark 都能加载的可视化 .ply(同 convert-exavatar.py)"""
    n = pos.shape[0]
    scale_log = np.log(scale + 1e-8).astype(np.float32)
    rot_wxyz = rot[:, [3, 0, 1, 2]].astype(np.float32)
    opa_logit = np.log(opacity / (1 - opacity + 1e-8) + 1e-8).astype(np.float32)

    dtype = [("x", "f4"), ("y", "f4"), ("z", "f4"),
             ("nx", "f4"), ("ny", "f4"), ("nz", "f4")]
    for i in range(3): dtype.append((f"f_dc_{i}", "f4"))
    for i in range(45): dtype.append((f"f_rest_{i}", "f4"))
    dtype.extend([("opacity", "f4"),
                  ("scale_0", "f4"), ("scale_1", "f4"), ("scale_2", "f4"),
                  ("rot_0", "f4"), ("rot_1", "f4"), ("rot_2", "f4"), ("rot_3", "f4")])

    arr = np.empty(n, dtype=dtype)
    arr["x"], arr["y"], arr["z"] = pos[:, 0], pos[:, 1], pos[:, 2]
    arr["nx"], arr["ny"], arr["nz"] = 0, 0, 0
    for i in range(3): arr[f"f_dc_{i}"] = sh[:, i]
    for i in range(45): arr[f"f_rest_{i}"] = sh[:, 3 + i]
    arr["opacity"] = opa_logit
    arr["scale_0"], arr["scale_1"], arr["scale_2"] = scale_log[:, 0], scale_log[:, 1], scale_log[:, 2]
    arr["rot_0"], arr["rot_1"], arr["rot_2"], arr["rot_3"] = rot_wxyz[:, 0], rot_wxyz[:, 1], rot_wxyz[:, 2], rot_wxyz[:, 3]

    from plyfile import PlyData, PlyElement
    el = PlyElement.describe(arr, "vertex")
    PlyData([el]).write(str(path))
    print(f"  写 avatar.ply: {path} ({n} points)")


# ─── main ─────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gauhuman-dir", required=True,
                    help="GauHuman output 目录(含 point_cloud/、canonical_joints.npy 等)")
    ap.add_argument("--out", required=True, help="前端资产输出目录")
    ap.add_argument("--up", default="-y", choices=["y", "-y"], help="坐标系 up 方向")
    args = ap.parse_args()

    gh_dir = Path(args.gauhuman_dir)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    print("▶ 1) 读点云")
    n, pos, scale, rot, opacity, sh = read_gauhuman_point_cloud(gh_dir / "point_cloud")

    print("▶ 2) 读 canonical joints")
    rest_joints = read_canonical_joints(gh_dir)

    print("▶ 3) 读 skinning weights")
    joints, weights = read_skinning_weights(gh_dir, n)

    print("▶ 4) 写产物")
    write_gaussians_bin(out_dir / "gaussians.bin", pos, scale, rot, opacity, sh)
    write_skinning_bin(out_dir / "skinning.bin", joints, weights)
    # GauHuman 用 SMPL(24 关节),文件仍叫 smplx.json(前端读的就是这个)
    write_smplx_json(out_dir / "smplx.json", SMPL_PARENTS, rest_joints)
    write_meta_json(out_dir / "meta.json", n, SMPL_JOINT_COUNT, up=args.up)
    write_avatar_ply(out_dir / "avatar.ply", pos, scale, rot, opacity, sh)

    print(f"\n✅ 完成。5 个文件在 {out_dir}:")
    for f in sorted(out_dir.iterdir()):
        print(f"  {f.name:20s} {f.stat().st_size/1024/1024:8.2f} MB")
    print("\n⚠️  这是 SMPL 24 关节资产,不能用 SMPL-X 的动作库直接驱动。")
    print("   需要把 src/digital-human/poseLibraries.ts 的 JOINT_COUNT 改为 24,")
    print("   或在 ActionStateMachine 里设 fsm.setJointCount(24)。")


if __name__ == "__main__":
    main()

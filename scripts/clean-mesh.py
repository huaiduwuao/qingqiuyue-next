#!/usr/bin/env python3
"""
clean-mesh.py —— 3DGS / COLMAP 点云 → 干净 GLB mesh

流程:
  1. 读 .ply 点云(open3d)
  2. 估计法向(KNN)
  3. Poisson surface reconstruction → watertight mesh
  4. crop 到原始点云包围盒(去掉飘出去的漂浮物)
  5. 简化到 ≤ 50k 面(quadric decimation)
  6. 平滑(几次 Laplacian)
  7. 写 GLB

用法:
  python scripts/clean-mesh.py \
      --ply work/xiaoqiu/gs/point_cloud/iteration_30000/point_cloud.ply \
      --out work/xiaoqiu/mesh/cleaned.glb

依赖:
  pip install open3d numpy plyfile trimesh
"""

import argparse
import os
import sys
import time

import numpy as np


def log(msg):
    print(f'[clean-mesh] {msg}', flush=True)


def parse_args():
    ap = argparse.ArgumentParser(description='Clean a 3DGS/COLMAP point cloud into a GLB mesh')
    ap.add_argument('--ply', required=True, help='Input .ply point cloud path')
    ap.add_argument('--out', required=True, help='Output .glb mesh path')
    ap.add_argument('--max-faces', type=int, default=50000,
                    help='Target max face count after decimation (default 50000)')
    ap.add_argument('--voxel', type=float, default=0.005,
                    help='Voxel size for normal estimation (meters, default 0.005)')
    ap.add_argument('--poisson-depth', type=int, default=9,
                    help='Poisson reconstruction depth (8~10, default 9)')
    ap.add_argument('--smooth-iters', type=int, default=3,
                    help='Laplacian smoothing iterations (default 3)')
    return ap.parse_args()


def main():
    args = parse_args()

    if not os.path.isfile(args.ply):
        log(f'ERROR: 输入 PLY 不存在: {args.ply}')
        sys.exit(1)

    try:
        import open3d as o3d
    except ImportError:
        log('ERROR: open3d 未安装。pip install open3d')
        sys.exit(1)

    out_dir = os.path.dirname(args.out)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    t0 = time.time()

    # 1. 读点云
    log(f'读 PLY: {args.ply}')
    pcd = o3d.io.read_point_cloud(args.ply)
    n_pts = len(pcd.points)
    log(f'  点数: {n_pts:,}')
    if n_pts < 1000:
        log('ERROR: 点云太少 (< 1000),检查重建结果')
        sys.exit(1)

    # 2. 估计法向(Poisson 输入需要法向)
    log(f'估计法向(voxel={args.voxel})...')
    pcd = pcd.voxel_down_sample(voxel_size=args.voxel)
    log(f'  下采样后: {len(pcd.points):,} 点')
    pcd.estimate_normals(
        search_param=o3d.geometry.KDTreeSearchParamKNN(knn=30)
    )
    pcd.orient_normals_consistent_tangent_plane(k=30)

    # 保存原始点云 bbox,后面裁剪 Poisson 输出
    bbox = pcd.get_axis_aligned_bounding_box()
    bbox_extent = bbox.get_extent()
    log(f'  点云 bbox: {bbox_extent[0]:.3f} x {bbox_extent[1]:.3f} x {bbox_extent[2]:.3f} m')

    # 3. Poisson surface reconstruction
    log(f'Poisson 重建 (depth={args.poisson_depth})...')
    mesh, densities = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(
        pcd, depth=args.poisson_depth, width=0, scale=1.1, linear_fit=False
    )
    n_faces = len(mesh.triangles)
    log(f'  Poisson 输出: {n_faces:,} 面')

    # 4. Crop 到原始点云 bbox
    log('裁剪到点云包围盒...')
    mesh = mesh.crop(bbox)

    # 移除低密度顶点(Poisson 会在低密度区域产生漂浮物)
    log('移除低密度漂浮顶点...')
    densities = np.asarray(densities)
    if len(densities) == len(mesh.vertices):
        # 直接 remove by density threshold
        threshold = np.quantile(densities, 0.05)  # 去掉最低 5%
        keep = densities > threshold
        mesh.remove_vertices_by_mask(~keep)
    n_faces = len(mesh.triangles)
    log(f'  裁剪后: {n_faces:,} 面')

    # 移除退化三角面和孤立顶点
    log('清理退化三角面...')
    mesh.remove_degenerate_triangles()
    mesh.remove_unreferenced_vertices()
    mesh.remove_duplicated_triangles()
    mesh.remove_duplicated_vertices()

    # 5. 简化到目标面数
    if len(mesh.triangles) > args.max_faces:
        log(f'简化到 ≤ {args.max_faces:,} 面(quadric decimation)...')
        mesh = mesh.simplify_quadric_decimation(
            target_number_of_triangles=args.max_faces,
            maximum_error=0.01,
        )
        log(f'  简化后: {len(mesh.triangles):,} 面')

    # 6. 平滑
    if args.smooth_iters > 0:
        log(f'Laplacian 平滑 {args.smooth_iters} 次...')
        for _ in range(args.smooth_iters):
            mesh = mesh.filter_smooth_laplacian(number_of_iterations=1)

    # 重新计算法向(简化/平滑后法向可能不准)
    mesh.compute_vertex_normals()

    # 7. 写 GLB
    log(f'写 GLB: {args.out}')
    o3d.io.write_mesh(args.out, mesh, write_ascii=False)

    sz = os.path.getsize(args.out) / 1024
    dt = time.time() - t0
    log(f'完成。{len(mesh.triangles):,} 面 / {sz:.1f} KB / {dt:.1f} s')
    log(f'下一步: blender --background --python scripts/blender/rig_mesh.py -- '
        f'--input {args.out} --output public/avatars/model.glb')


if __name__ == '__main__':
    main()
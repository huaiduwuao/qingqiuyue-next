import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyAvatarParams } from '../vrm/avatarCustomize';

/** 一根「腿」:胯骨在 1 米高,脚的顶点挂在它下面 1 米(地面 y=0) */
function rig() {
  const scene = new THREE.Group();
  const hips = new THREE.Bone();
  hips.position.y = 1;
  scene.add(hips);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.1, 0, 0, 0, 1, 0], 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
  scene.add(mesh);
  scene.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton([hips]));
  const vrm = { scene, humanoid: { getRawBoneNode: (n: string) => (n === 'hips' ? hips : null) } };
  return { vrm, hips };
}

describe('avatar foot offset', () => {
  it('measures the soles in the loaded stance, not in whatever pose the avatar is in when the params arrive', () => {
    const { vrm, hips } = rig();
    expect(applyAvatarParams(THREE, vrm, {}).footOffset).toBeCloseTo(0, 3);
    // 走路的起伏 / 坐下:胯沉了 0.3 米。以前这时候量,脚底「低了」0.3,整个人被抬起 0.3 米
    hips.position.y = 0.7;
    hips.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.2);
    const r = applyAvatarParams(THREE, vrm, { body: { height: 1 } });
    expect(r.footOffset).toBeCloseTo(0, 3);
    // 量完姿势放回去,动画接着演
    expect(hips.position.y).toBeCloseTo(0.7, 6);
    expect(hips.quaternion.z).toBeCloseTo(Math.sin(0.1), 6);
  });
});

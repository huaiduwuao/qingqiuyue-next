// 测试 three-vrm 加载 character.vrm
import { readFileSync } from 'fs';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';

const file = readFileSync('./public/avatars/character.vrm');
const buf = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
console.log('VRM file size:', file.byteLength, 'bytes');

const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));

try {
  let gltf;
  try {
    // 试 parseAsync
    gltf = await loader.parseAsync(buf, '');
  } catch (e1) {
    console.log('parseAsync failed:', e1.message);
    // 改用 parse (同步),用 ArrayBuffer
    try {
      gltf = loader.parse(buf, '');
    } catch (e2) {
      console.log('parse also failed:', e2.message);
      throw e2;
    }
  }
  console.log('PARSE OK');
  console.log('  scene children:', gltf.scene.children.length);
  console.log('  animations:', gltf.animations?.length || 0);
  const vrm = gltf.userData.vrm;
  console.log('  vrm loaded:', !!vrm);
  if (vrm) {
    console.log('  meta:', vrm.meta);
    console.log('  humanoid bones:', vrm.humanoid ? Object.keys(vrm.humanoid.humanBones || {}).length : 'no humanoid');
    console.log('  expressionManager:', !!vrm.expressionManager);
  }
} catch (e) {
  console.error('PARSE FAILED:', e.message);
  process.exit(1);
}

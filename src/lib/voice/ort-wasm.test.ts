import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// public/ort-wasm 里的 .wasm 必须和已装 onnxruntime-web 的 JS 胶水同一版本:
// 版本错位时 InferenceSession 初始化失败,唤醒词静默退回备用方案,线上很难发现。
// 升级 onnxruntime-web 后跑 scripts/copy-ort-runtime.sh 重新同步。
const root = process.cwd();
const dist = path.join(root, 'node_modules/onnxruntime-web/dist');
const served = path.join(root, 'public/ort-wasm');

const sha = (p: string) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');

describe('public/ort-wasm 与已装 onnxruntime-web 一致', () => {
  it.each(['ort-wasm-simd.wasm', 'ort-wasm-simd-threaded.wasm'])('%s 逐字节相同', (name) => {
    expect(fs.existsSync(path.join(served, name))).toBe(true);
    expect(sha(path.join(served, name))).toBe(sha(path.join(dist, name)));
  });
});

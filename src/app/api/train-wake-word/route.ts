import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

/**
 * 训练小月唤醒词 — 上传录音 + 自动训练
 *
 * POST /api/train-wake-word
 *   Body: FormData
 *     - files: 多个 audio/wav blob (录音样本, 30-200 条)
 *     - target: 'xiaoyue' (默认)
 *
 * 流程:
 *   1. 保存到 data/positive/小月_001.wav 等
 *   2. 调用 scripts/train_xiaoyue_model.py (Python)
 *   3. 返回 status: ok / error
 *
 * 注意: 这是 dev-only endpoint, prod 不应该暴露(随便训练浪费 CPU)
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const REPO_ROOT = process.cwd();
const POS_DIR = join(REPO_ROOT, 'data', 'positive');
const MODEL_OUT_DIR = join(REPO_ROOT, 'models', 'xiaoyue');
const PUBLIC_WAKE_DIR = join(REPO_ROOT, 'public', 'wake');
const TRAIN_SCRIPT = join(REPO_ROOT, 'scripts', 'train_xiaoyue_model.py');

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ ok: false, error: 'training endpoint disabled in production' }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length < 10) {
      return NextResponse.json({
        ok: false,
        error: `至少需要 10 条样本, 现在 ${files?.length || 0} 条`,
      }, { status: 400 });
    }

    // 清空旧样本(避免混淆)
    if (existsSync(POS_DIR)) {
      const old = await readdir(POS_DIR);
      for (const f of old) {
        if (f.startsWith('小月_') && f.endsWith('.wav')) {
          await rm(join(POS_DIR, f));
        }
      }
    } else {
      await mkdir(POS_DIR, { recursive: true });
    }

    // 保存上传的音频(按顺序编号)
    const saved: string[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file || file.size === 0) continue
      const buf = Buffer.from(await file.arrayBuffer())
      const filename = `小月_${String(i + 1).padStart(3, '0')}.wav`
      const path = join(POS_DIR, filename)
      await writeFile(path, buf)
      saved.push(filename)
    }

    if (saved.length < 10) {
      return NextResponse.json({ ok: false, error: '保存样本失败' }, { status: 500 });
    }

    // 调用 Python 训练脚本
    // 训练 + 部署预计 30-60s
    const pythonBin = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3')
    const startTime = Date.now()
    const result = await new Promise<{ ok: boolean; stdout: string; stderr: string }>((resolve) => {
      const proc = spawn(pythonBin, [TRAIN_SCRIPT], {
        cwd: REPO_ROOT,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let stdout = ''
      let stderr = ''
      proc.stdout.on('data', (d) => { stdout += d.toString() })
      proc.stderr.on('data', (d) => { stderr += d.toString() })
      proc.on('close', (code) => {
        resolve({ ok: code === 0, stdout, stderr })
      })
    })
    const duration = Date.now() - startTime

    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        error: '训练失败',
        stderr: result.stderr.slice(-2000),
        stdout: result.stdout.slice(-2000),
        saved: saved.length,
        duration,
      }, { status: 500 });
    }

    // 复制新模型到 public/wake/(脚本内 export_for_browser 已做)
    // 验证文件在位
    const modelFile = join(PUBLIC_WAKE_DIR, 'xiaoyue.onnx')
    if (!existsSync(modelFile)) {
      return NextResponse.json({
        ok: false,
        error: '训练完成但模型未部署到 public/wake/',
        saved: saved.length,
        duration,
      }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      saved: saved.length,
      duration,
      modelPath: '/wake/xiaoyue.onnx',
      stdoutTail: result.stdout.slice(-500),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function GET() {
  // 查看当前训练数据状态
  try {
    let posCount = 0
    let lastModel = ''
    if (existsSync(POS_DIR)) {
      const files = await readdir(POS_DIR)
      posCount = files.filter(f => f.endsWith('.wav')).length
    }
    if (existsSync(join(PUBLIC_WAKE_DIR, 'xiaoyue.onnx'))) {
      const { statSync } = await import('fs')
      const s = statSync(join(PUBLIC_WAKE_DIR, 'xiaoyue.onnx'))
      lastModel = `${(s.size / 1024).toFixed(1)} KB, mtime ${s.mtime.toISOString()}`
    }
    return NextResponse.json({
      ok: true,
      positiveSamples: posCount,
      model: lastModel,
      posDir: POS_DIR,
      trainScript: TRAIN_SCRIPT,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
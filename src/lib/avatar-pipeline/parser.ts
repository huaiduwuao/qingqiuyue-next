/**
 * avatar-pipeline parser.ts —— 解析 avatar-pipeline.sh 的 stdout / stderr
 *
 * 协议(沿用 qingqiuyue-go/internal/avatarapp/studio.go:268-282 parseTrainLine):
 *   STAGE <key> <pct>     → 切阶段
 *   PROGRESS <0-100>      → 更新进度
 *   其他行                 → 普通日志
 *
 * 把行解析结果调用回调,callbacks 在 run-pipeline.ts 里挂到 job-store。
 */

import { PIPELINE_STAGES, type PipelineStage } from './types';

export type ParserCallbacks = {
  onStage: (stage: PipelineStage, pct: number) => void;
  onProgress: (pct: number) => void;
  onLog: (stream: 'stdout' | 'stderr', line: string) => void;
};

const STAGE_RE = /^STAGE\s+(\S+)\s+(\d+)\s*$/;
const PROGRESS_RE = /^PROGRESS\s+(\d+)\s*$/;

function isPipelineStage(s: string): s is PipelineStage {
  return (PIPELINE_STAGES as readonly string[]).includes(s);
}

export function parseLine(line: string, stream: 'stdout' | 'stderr', cb: ParserCallbacks): void {
  const trimmed = line.trim();
  if (!trimmed) return;

  const stageMatch = STAGE_RE.exec(trimmed);
  if (stageMatch) {
    const [, key, pctStr] = stageMatch;
    const pct = parseInt(pctStr, 10);
    if (isPipelineStage(key)) {
      cb.onStage(key, isNaN(pct) ? 0 : pct);
      return;
    }
    // 未知 stage,仍当成日志
  }

  const progressMatch = PROGRESS_RE.exec(trimmed);
  if (progressMatch) {
    const [, pctStr] = progressMatch;
    const pct = parseInt(pctStr, 10);
    if (!isNaN(pct)) {
      cb.onProgress(pct);
      return;
    }
  }

  cb.onLog(stream, line);
}

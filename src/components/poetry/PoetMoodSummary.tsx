'use client';

// PoetMoodSummary —— 诗人心境分期解读。
//
// 数据形态:{ label: string, summary: string, source?: 'llm', model?: string, generatedAt?: string }[]
// 由后端 poet 接口从 metadata.mood 透出。后端在生成时 prompt 强约束:
// 「你是文学研究者,请基于诗人作品与时代背景,客观总结其创作心路。
//   不要编造史料,不确定的部分写'不详'。」
//
// 前端必须:
//   1. 标题必须是「AI 解读」,不能叫「心路历程」「情感变化」等带绝对语气的词
//   2. 紧邻标题渲染一个 AIGCBadge 行内小标签,合规且不遮原文
//   3. 数据缺失整个模块不渲染
//   4. 文末一行小字注脚:模型名 + 生成时间(若有),以及免责声明

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import PsychologyAltIcon from '@mui/icons-material/PsychologyAlt';
import AIGCBadge from '@/components/AIGCBadge';

export interface PoetMoodPeriod {
  /** 「早期/壮年/暮年」或「被贬黄州/晚年岭海」等场景化标签 */
  label: string;
  summary: string;
  source?: 'llm';
  model?: string;
  generatedAt?: string;
}

export interface PoetMoodSummaryProps {
  periods: PoetMoodPeriod[] | undefined;
}

function formatTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function PoetMoodSummary({ periods }: PoetMoodSummaryProps) {
  if (!periods || periods.length === 0) return null;

  const aiSource = periods.find((p) => p.source === 'llm');
  const model = aiSource?.model;
  const generatedAt = aiSource?.generatedAt;
  const footnote =
    model || generatedAt
      ? `生成模型:${model ?? '?'} · 生成时间:${formatTime(generatedAt) || '?'}`
      : '';

  return (
    <Box sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
        <PsychologyAltIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
        <Typography sx={{ fontSize: 15, fontWeight: 600 }}>AI 解读:诗人心路</Typography>
        <AIGCBadge variant="inline" label="AI 生成" />
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {periods.map((p, idx) => (
          <Box
            key={`${p.label}-${idx}`}
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: 'rgba(168, 85, 247, 0.06)',
              border: '1px solid',
              borderColor: 'rgba(168, 85, 247, 0.18)',
            }}
          >
            <Typography
              sx={{
                fontSize: 13,
                fontWeight: 600,
                color: '#a855f7',
                mb: 0.75,
                letterSpacing: '0.04em',
              }}
            >
              {p.label}
            </Typography>
            <Typography
              sx={{
                fontSize: 14,
                lineHeight: 1.85,
                color: 'text.primary',
                whiteSpace: 'pre-line',
                wordBreak: 'break-word',
              }}
            >
              {p.summary}
            </Typography>
          </Box>
        ))}
      </Box>

      {footnote && (
        <Typography sx={{ fontSize: 11, color: 'text.disabled', mt: 1.5 }}>
          {footnote}
        </Typography>
      )}
      <Typography sx={{ fontSize: 11, color: 'text.disabled', mt: 0.5 }}>
        此为 AI 基于诗人作品与时代背景的客观总结,非史料原文,仅供参考。
      </Typography>
    </Box>
  );
}

export default PoetMoodSummary;
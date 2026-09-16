'use client';

/**
 * 对话里的「操作日志」条目:工具调用卡 + 思考过程。
 *
 * 用户要看得见数字人在真干活:调了什么工具、给了什么参数、结果是什么、
 * 以及它这一轮是怎么想的。全屏页和浮窗共用。
 */

import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ChatToolEntry } from '../useChatAvatar';

const TOOL_LABEL: Record<string, string> = {
  draft_agent: '起草数字员工',
  draft_skill: '起草技能',
  draft_workflow: '起草工作流',
  draft_mcp_server: '起草 MCP 服务',
  dry_run_draft: '试运行草稿',
  publish_draft: '发布草稿',
  update_draft: '修改草稿',
  list_drafts: '查看草稿',
  discard_draft: '丢弃草稿',
  run_in_background: '交给后台运行',
  delegate_to: '委派给其他员工',
  ui_show_run: '展示运行卡片',
  ui_show_plan: '更新任务板',
  ui_show_list: '展示列表',
  ui_show_grid: '展示网格',
  ui_show_form: '展示表单',
  ui_dismiss: '收起面板',
  scene_act: '场景动作',
  sandbox_exec: '沙盒执行',
  workflow_execute: '执行工作流',
  resource_search: '搜索资源',
  bounty_create: '发布悬赏',
};

export function toolLabel(name: string): string {
  return TOOL_LABEL[name] || (name.startsWith('skill_') ? `技能 ${name.slice(6)}` : name);
}

/** 参数摘要:一行,最多 ~120 字 */
export function summarizeArgs(args: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(args || {})) {
    let s: string;
    if (typeof v === 'string') s = v;
    else if (v == null) continue;
    else s = JSON.stringify(v);
    if (s.length > 60) s = `${s.slice(0, 60)}…`;
    parts.push(`${k}=${s}`);
  }
  const out = parts.join('  ');
  return out.length > 120 ? `${out.slice(0, 120)}…` : out;
}

const STATUS = {
  running: { icon: '⏳', label: '执行中', color: 'rgba(255,200,80,0.95)' },
  done: { icon: '✓', label: '完成', color: 'rgba(120,230,160,0.95)' },
  error: { icon: '✕', label: '失败', color: 'rgba(255,120,120,0.95)' },
} as const;

export function ToolCallCard({ entry, compact }: { entry: ChatToolEntry; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const st = STATUS[entry.status];
  const args = summarizeArgs(entry.args);
  if (compact) {
    return (
      <Typography sx={{ fontSize: 10.5, color: st.color, wordBreak: 'break-word' }}>
        🔧 {toolLabel(entry.name)} {st.icon}{args ? ` · ${args}` : ''}
      </Typography>
    );
  }
  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={`${toolLabel(entry.name)} ${st.label}`}
      onClick={() => setOpen((o) => !o)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o); } }}
      sx={{
        alignSelf: 'flex-start',
        maxWidth: '85%',
        px: 1.25,
        py: 0.75,
        borderRadius: 2,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderLeft: `3px solid ${st.color}`,
        cursor: 'pointer',
        fontFamily: 'ui-monospace, Consolas, monospace',
      }}
    >
      <Typography sx={{ fontSize: 12, color: '#fff', display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
        <span>🔧 {toolLabel(entry.name)}</span>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{entry.name}</span>
        <span style={{ color: st.color, fontSize: 11 }}>{st.icon} {st.label}</span>
      </Typography>
      {args && (
        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', wordBreak: 'break-all', mt: 0.25 }}>{args}</Typography>
      )}
      {open && (
        <Box component="pre" sx={{ m: 0, mt: 0.75, fontSize: 11, color: 'rgba(255,255,255,0.85)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 220, overflow: 'auto' }}>
          {`参数 ${JSON.stringify(entry.args, null, 1)}\n\n结果 ${entry.result ?? (entry.status === 'running' ? '…' : '(无)')}`}
        </Box>
      )}
      {!open && entry.result && (
        <Typography sx={{ fontSize: 11, color: entry.status === 'error' ? st.color : 'rgba(255,255,255,0.75)', mt: 0.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          → {entry.result}
        </Typography>
      )}
    </Box>
  );
}

export function ThoughtBubble({ text, compact }: { text: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  if (compact) {
    return <Typography sx={{ fontSize: 10.5, color: 'rgba(200,200,255,0.85)', fontStyle: 'italic' }}>💭 {text.slice(0, 80)}{text.length > 80 ? '…' : ''}</Typography>;
  }
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={() => setOpen((o) => !o)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o); } }}
      sx={{ alignSelf: 'flex-start', maxWidth: '85%', px: 1.25, py: 0.75, borderRadius: 2, background: 'rgba(100,100,255,0.10)', border: '1px solid rgba(100,100,255,0.22)', cursor: 'pointer' }}
    >
      <Typography sx={{ fontSize: 11.5, color: 'rgba(200,200,255,0.9)', fontStyle: 'italic', whiteSpace: 'pre-wrap', display: open ? 'block' : '-webkit-box', WebkitLineClamp: open ? undefined : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        💭 {text}
      </Typography>
    </Box>
  );
}

'use client'

import { useState } from 'react'
import { canvasAPI } from './api'
import type { WorkflowResult, SkillResult, SkillKind } from './types'

interface GeneratorChatProps {
  agentId: number
  agentContext?: string
  onWorkflowGenerated?: (result: WorkflowResult) => void
  onSkillGenerated?: (result: SkillResult) => void
}

type GenMode = 'workflow' | 'skill'

const SKILL_TYPES: { value: SkillKind; label: string }[] = [
  { value: 'tool', label: '工具 (tool)' },
  { value: 'prompt', label: '提示词 (prompt)' },
  { value: 'mcp', label: 'MCP (mcp)' },
  { value: 'pipeline', label: '管道 (pipeline)' },
]

/**
 * 对话生成器
 * 通过自然语言描述生成工作流或技能
 */
export default function GeneratorChat({ agentId, agentContext, onWorkflowGenerated, onSkillGenerated }: GeneratorChatProps) {
  const [mode, setMode] = useState<GenMode>('workflow')
  const [skillType, setSkillType] = useState<SkillKind>('tool')
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [wfResult, setWfResult] = useState<WorkflowResult | null>(null)
  const [skResult, setSkResult] = useState<SkillResult | null>(null)
  const [saveMsg, setSaveMsg] = useState('')

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setLoading(true)
    setWfResult(null)
    setSkResult(null)
    setSaveMsg('')
    try {
      if (mode === 'workflow') {
        const result = await canvasAPI.generateWorkflow(prompt, agentContext)
        setWfResult(result)
        if (result.success) onWorkflowGenerated?.(result)
      } else {
        const result = await canvasAPI.generateSkill(prompt, skillType)
        setSkResult(result)
        if (result.success) onSkillGenerated?.(result)
      }
    } catch (e: any) {
      setSaveMsg(`生成失败: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveWorkflow = async () => {
    if (!wfResult?.success) return
    try {
      await canvasAPI.createWorkflow(agentId, {
        name: wfResult.name,
        description: wfResult.description,
        workflow_json: JSON.stringify({ nodes: wfResult.nodes, edges: wfResult.edges }),
        workflow_type: wfResult.workflow_type,
      })
      setSaveMsg('✅ 工作流已保存并关联到 Agent')
    } catch (e: any) {
      setSaveMsg(`保存失败: ${e.message}`)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 模式切换 */}
      <div style={{ display: 'flex', gap: 8 }}>
        <ModeButton active={mode === 'workflow'} onClick={() => setMode('workflow')}>
          🔀 生成工作流
        </ModeButton>
        <ModeButton active={mode === 'skill'} onClick={() => setMode('skill')}>
          ⚡ 生成技能
        </ModeButton>

        {mode === 'skill' && (
          <select
            value={skillType}
            onChange={(e) => setSkillType(e.target.value as SkillKind)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}
          >
            {SKILL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* 输入 */}
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={
          mode === 'workflow'
            ? '描述你想要的工作流，例如：先搜索最新新闻，然后总结成摘要，最后发送邮件通知'
            : '描述你想要的技能，例如：一个能查询天气并返回温度信息的工具'
        }
        rows={4}
        style={{
          width: '100%',
          padding: 10,
          borderRadius: 8,
          border: '1px solid #ddd',
          fontSize: 14,
          resize: 'vertical',
          fontFamily: 'inherit',
        }}
      />

      <button
        onClick={handleGenerate}
        disabled={loading || !prompt.trim()}
        style={{
          padding: '8px 20px',
          background: loading ? '#999' : '#7b1fa2',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: 14,
          alignSelf: 'flex-start',
        }}
      >
        {loading ? '生成中…' : '✨ 生成'}
      </button>

      {/* 结果预览 */}
      {wfResult && (
        <ResultCard success={wfResult.success} title={`工作流: ${wfResult.name}`} error={wfResult.error}>
          {wfResult.success && (
            <>
              <p style={{ margin: '4px 0', color: '#555', fontSize: 13 }}>{wfResult.description}</p>
              <p style={{ margin: '4px 0', fontSize: 12, color: '#888' }}>
                类型: {wfResult.workflow_type} · 节点: {wfResult.nodes?.length} · 边: {wfResult.edges?.length}
              </p>
              <JsonPreview data={{ nodes: wfResult.nodes, edges: wfResult.edges }} />
              <button
                onClick={handleSaveWorkflow}
                style={{
                  marginTop: 8,
                  padding: '6px 16px',
                  background: '#2e7d32',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                💾 保存并关联
              </button>
            </>
          )}
        </ResultCard>
      )}

      {skResult && (
        <ResultCard success={skResult.success} title={`技能: ${skResult.name}`} error={skResult.error}>
          {skResult.success && (
            <>
              <p style={{ margin: '4px 0', color: '#555', fontSize: 13 }}>{skResult.description}</p>
              <p style={{ margin: '4px 0', fontSize: 12, color: '#888' }}>
                类型: {skResult.kind} · 分类: {skResult.category}
              </p>
              <JsonPreview data={skResult} />
            </>
          )}
        </ResultCard>
      )}

      {saveMsg && (
        <div style={{ fontSize: 13, color: saveMsg.startsWith('✅') ? 'green' : 'red' }}>{saveMsg}</div>
      )}
    </div>
  )
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: 6,
        border: active ? '2px solid #7b1fa2' : '1px solid #ddd',
        background: active ? '#f3e5f5' : '#fff',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
      }}
    >
      {children}
    </button>
  )
}

function ResultCard({ success, title, error, children }: { success: boolean; title: string; error?: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: `1px solid ${success ? '#c8e6c9' : '#ffcdd2'}`,
        background: success ? '#f1f8f2' : '#fef5f5',
        borderRadius: 8,
        padding: 14,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
        {success ? '✅ ' : '❌ '}
        {title}
      </div>
      {error && <div style={{ color: '#c62828', fontSize: 13 }}>{error}</div>}
      {children}
    </div>
  )
}

function JsonPreview({ data }: { data: any }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginTop: 6 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          border: 'none',
          background: 'none',
          color: '#1976d2',
          cursor: 'pointer',
          fontSize: 12,
          padding: 0,
        }}
      >
        {open ? '▼ 收起 JSON' : '▶ 查看 JSON'}
      </button>
      {open && (
        <pre
          style={{
            marginTop: 6,
            padding: 10,
            background: '#263238',
            color: '#aed581',
            borderRadius: 6,
            fontSize: 11,
            maxHeight: 240,
            overflow: 'auto',
          }}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}

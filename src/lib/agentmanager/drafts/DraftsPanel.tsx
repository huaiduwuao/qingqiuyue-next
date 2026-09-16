'use client'

/**
 * DraftsPanel — 草稿箱:builder 员工起草的数字员工 / 技能 / 工作流 / MCP 服务。
 * 这里的「发布」按钮就是人的批准;对话里的发布走后台运行的批准卡片。
 */

import { useCallback, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import CircularProgress from '@mui/material/CircularProgress'
import { draftsAPI, draftSummary, KIND_LABEL, type Draft, type DraftStatus } from './draftsApi'

const STATUS_LABEL: Record<DraftStatus, string> = { draft: '草稿', published: '已发布', discarded: '已丢弃' }

export default function DraftsPanel({ isAdmin }: { isAdmin: boolean }) {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(false)
  const [all, setAll] = useState(false)
  const [status, setStatus] = useState<DraftStatus | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [open, setOpen] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setDrafts(await draftsAPI.list(all && isAdmin, status || undefined))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [all, isAdmin, status])

  useEffect(() => {
    load()
  }, [load])

  const act = async (id: number, fn: () => Promise<unknown>) => {
    setBusy(id)
    setError(null)
    try {
      await fn()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h6">草稿箱</Typography>
          <Typography variant="caption" color="text.secondary">
            和数字员工 builder 对话起草;这里试运行、发布或丢弃。发布 = 你的批准。
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <select aria-label="状态" value={status} onChange={e => setStatus(e.target.value as DraftStatus | '')} style={{ fontSize: 13, padding: '4px 6px' }}>
            <option value="">未丢弃</option>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
            <option value="discarded">已丢弃</option>
          </select>
          {isAdmin && <FormControlLabel control={<Switch size="small" checked={all} onChange={e => setAll(e.target.checked)} />} label="看全部用户" />}
          <Button size="small" onClick={load} disabled={loading}>刷新</Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {loading && drafts.length === 0 && <CircularProgress size={20} />}
      {!loading && drafts.length === 0 && (
        <Typography variant="body2" color="text.secondary">还没有草稿。到数字人页面选「builder」员工,说说你想造什么。</Typography>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {drafts.map(d => (
          <Paper key={d.id} variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Chip size="small" label={KIND_LABEL[d.kind] || d.kind} color="primary" variant="outlined" />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{d.name}</Typography>
              <Chip
                size="small"
                label={STATUS_LABEL[d.status] || d.status}
                color={d.status === 'published' ? 'success' : d.status === 'discarded' ? 'default' : 'warning'}
              />
              {d.dry_run_ok !== undefined && (
                <Chip size="small" label={d.dry_run_ok ? '试运行通过' : '试运行未通过'} color={d.dry_run_ok ? 'success' : 'error'} variant="outlined" />
              )}
              {d.published_ref && <Chip size="small" label={`→ ${d.published_ref}`} variant="outlined" />}
              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                #{d.id} · {new Date(d.created_at).toLocaleString()}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ mt: 1 }}>{d.description}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>{draftSummary(d)}</Typography>
            {d.dry_run && (
              <Box component="pre" sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1, fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: 160, overflow: 'auto' }}>
                {d.dry_run}
              </Box>
            )}
            {open === d.id && (
              <Box component="pre" sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1, fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: 320, overflow: 'auto' }}>
                {JSON.stringify(d.spec, null, 2)}
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
              <Button size="small" variant="text" onClick={() => setOpen(open === d.id ? null : d.id)}>
                {open === d.id ? '收起内容' : '查看内容'}
              </Button>
              {d.status === 'draft' && (
                <>
                  <Button size="small" variant="outlined" disabled={busy === d.id} onClick={() => act(d.id, () => draftsAPI.dryRun(d.id))}>
                    试运行
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={busy === d.id}
                    onClick={() => {
                      if (confirm(`发布「${d.name}」(${KIND_LABEL[d.kind]})?发布后立即生效。`)) act(d.id, () => draftsAPI.publish(d.id))
                    }}
                  >
                    发布
                  </Button>
                  <Button size="small" color="error" variant="text" disabled={busy === d.id} onClick={() => { if (confirm('丢弃这份草稿?不可恢复。')) act(d.id, () => draftsAPI.discard(d.id)) }}>
                    丢弃
                  </Button>
                </>
              )}
              {busy === d.id && <CircularProgress size={18} sx={{ alignSelf: 'center' }} />}
            </Box>
          </Paper>
        ))}
      </Box>
    </Box>
  )
}

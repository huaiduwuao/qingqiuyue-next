'use client'

/**
 * SkillHubPanel — 从开源技能库(GitHub / 本地目录)发现、扫描、安装 SKILL.md 技能。
 * 安装后技能以 skill_<name> 工具交给数字员工:先读说明,脚本在沙盒里跑。
 */

import { useCallback, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import CircularProgress from '@mui/material/CircularProgress'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import { hubAPI, type HubCandidate, type HubReport, type HubScan, type HubSource } from './hubApi'

const SEVERITY: Record<string, 'error' | 'warning' | 'default'> = { critical: 'error', high: 'warning', medium: 'default' }

export default function SkillHubPanel({ isAdmin, onInstalled }: { isAdmin: boolean; onInstalled?: () => void }) {
  const [sources, setSources] = useState<HubSource[]>([])
  const [q, setQ] = useState('')
  const [results, setResults] = useState<HubCandidate[]>([])
  const [fetchErrors, setFetchErrors] = useState<Record<string, string>>({})
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scan, setScan] = useState<{ cand: HubCandidate; data: HubScan } | null>(null)
  const [scanning, setScanning] = useState<string | null>(null)
  const [installing, setInstalling] = useState(false)
  const [force, setForce] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [draft, setDraft] = useState({ name: '', type: 'github' as 'github' | 'local', url: '', ref: '', trusted: false })

  const loadSources = useCallback(async () => {
    try {
      setSources(await hubAPI.sources())
    } catch (e: any) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    loadSources()
  }, [loadSources])

  const search = async () => {
    setSearching(true)
    setError(null)
    try {
      const r = await hubAPI.search(q)
      setResults(r.list || [])
      setFetchErrors(r.errors || {})
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSearching(false)
    }
  }

  const doScan = async (cand: HubCandidate) => {
    const key = `${cand.source}/${cand.identifier}`
    setScanning(key)
    setError(null)
    try {
      setScan({ cand, data: await hubAPI.scan(cand.source, cand.identifier) })
      setForce(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setScanning(null)
    }
  }

  const doInstall = async () => {
    if (!scan) return
    setInstalling(true)
    try {
      const r = await hubAPI.install(scan.cand.source, scan.cand.identifier, force)
      const { cand } = scan
      setScan(null)
      setError(null)
      setResults((prev) => prev.map((c) => (c.source === cand.source && c.identifier === cand.identifier ? { ...c, installed_id: r.id } : c)))
      onInstalled?.()
      alert(`已安装「${r.name}」,数字员工可用工具 ${r.tool}${r.entry ? `,入口 ${r.entry}` : '(只有说明)'}`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setInstalling(false)
    }
  }

  const addSource = async () => {
    try {
      await hubAPI.addSource(draft)
      setAddOpen(false)
      setDraft({ name: '', type: 'github', url: '', ref: '', trusted: false })
      loadSources()
    } catch (e: any) {
      setError(e.message)
    }
  }

  const removeSource = async (s: HubSource) => {
    if (!confirm(`移除来源「${s.name}」?已安装的技能不受影响。`)) return
    try {
      await hubAPI.deleteSource(s.id)
      loadSources()
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <Paper sx={{ p: 2, mb: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>技能仓库</Typography>
        {sources.map((s) => (
          <Chip
            key={s.id}
            size="small"
            label={`${s.name} · ${s.url}${s.trusted ? ' · 受信' : ''}`}
            variant="outlined"
            color={s.trusted ? 'success' : 'default'}
            onDelete={isAdmin ? () => removeSource(s) : undefined}
            deleteIcon={<DeleteOutlineIcon />}
          />
        ))}
        {isAdmin && <Button size="small" onClick={() => setAddOpen(true)}>+ 来源</Button>}
      </Box>
      <Typography variant="body2" color="text.secondary">
        从 GitHub 技能库(SKILL.md 格式)发现技能;安装前会扫描脚本里的危险模式。装好后数字员工先读说明,脚本在无网络的沙盒里执行。
      </Typography>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          id="skill-hub-q"
          size="small"
          placeholder="搜技能名或描述,留空列出全部"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') search()
          }}
          sx={{ flex: 1 }}
        />
        <Button variant="contained" onClick={search} disabled={searching}>
          {searching ? <CircularProgress size={18} /> : '搜索'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {Object.entries(fetchErrors).map(([name, msg]) => (
        <Alert key={name} severity="warning">
          来源「{name}」抓取失败:{msg}
        </Alert>
      ))}

      {results.length > 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 1.5 }}>
          {results.map((c) => {
            const key = `${c.source}/${c.identifier}`
            return (
              <Box key={key} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }} noWrap>
                    {c.name}
                  </Typography>
                  {c.installed_id && <Chip size="small" label="已安装" color="success" />}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {c.description || '(没有描述)'}
                </Typography>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.disabled' }} noWrap>
                  {key}
                  {c.scripts?.length ? ` · ${c.scripts.length} 个脚本` : ' · 仅说明'}
                </Typography>
                <Box>
                  <Button size="small" onClick={() => doScan(c)} disabled={scanning === key}>
                    {scanning === key ? '扫描中…' : isAdmin ? '扫描并安装' : '扫描'}
                  </Button>
                </Box>
              </Box>
            )
          })}
        </Box>
      )}

      <Dialog open={!!scan} onClose={() => setScan(null)} maxWidth="sm" fullWidth>
        {scan && (
          <>
            <DialogTitle>{scan.data.name}</DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography variant="body2">{scan.data.description}</Typography>
              <Typography variant="caption" color="text.secondary">
                {scan.data.files.length} 个文件 · 入口 {scan.data.entry || '(无,只有说明)'} · sha256 {scan.data.sha256.slice(0, 12)}
              </Typography>
              <ReportView report={scan.data.report} />
              {scan.data.skipped && scan.data.skipped.length > 0 && (
                <Typography variant="caption" color="text.secondary">
                  未收录:{scan.data.skipped.join('、')}
                </Typography>
              )}
              {!scan.data.report.allowed && scan.data.report.forceable && isAdmin && (
                <FormControlLabel
                  control={<Switch id="skill-hub-force" checked={force} onChange={(e) => setForce(e.target.checked)} />}
                  label="我已看过发现项,确认无害,强制安装"
                />
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setScan(null)}>关闭</Button>
              {isAdmin && (
                <Button
                  variant="contained"
                  onClick={doInstall}
                  disabled={installing || (!scan.data.report.allowed && !(scan.data.report.forceable && force))}
                >
                  {installing ? '安装中…' : scan.cand.installed_id ? '重新安装' : '安装'}
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>添加技能来源</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
          <TextField id="hub-src-name" size="small" label="名称" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <TextField
            id="hub-src-url"
            size="small"
            label={draft.type === 'github' ? 'GitHub:owner/repo 或 owner/repo/子目录' : '本地绝对路径'}
            value={draft.url}
            onChange={(e) => setDraft({ ...draft, url: e.target.value })}
          />
          <TextField id="hub-src-ref" size="small" label="分支/标签(可选,默认 main)" value={draft.ref} onChange={(e) => setDraft({ ...draft, ref: e.target.value })} />
          <FormControlLabel
            control={<Switch id="hub-src-local" checked={draft.type === 'local'} onChange={(e) => setDraft({ ...draft, type: e.target.checked ? 'local' : 'github' })} />}
            label="本地目录(服务器上的路径)"
          />
          <FormControlLabel
            control={<Switch id="hub-src-trusted" checked={draft.trusted} onChange={(e) => setDraft({ ...draft, trusted: e.target.checked })} />}
            label="受信来源(high 级发现也允许安装)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>取消</Button>
          <Button variant="contained" onClick={addSource} disabled={!draft.name.trim() || !draft.url.trim()}>
            添加
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}

function ReportView({ report }: { report: HubReport }) {
  const severity = report.allowed ? (report.findings.length ? 'warning' : 'success') : 'error'
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Alert severity={severity}>
        {report.reason}
        {report.trusted ? '(受信来源)' : ''}
      </Alert>
      {report.findings.map((f, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <Chip size="small" label={f.severity} color={SEVERITY[f.severity] ?? 'default'} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2">{f.message}</Typography>
            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
              {f.file}:{f.line} · {f.id}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  )
}

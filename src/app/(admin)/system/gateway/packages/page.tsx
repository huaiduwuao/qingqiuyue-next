'use client'

/**
 * LLM 配额套餐管理(管理员)
 * 路径 /system/gateway/packages
 * 维护 agentm_quota_packages:增删改查 + 启用 / 排序 / 限速 / 单价。
 */

import { useCallback, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Switch from '@mui/material/Switch'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import AddIcon from '@mui/icons-material/Add'
import RefreshIcon from '@mui/icons-material/Refresh'
import { quotaAPI, type QuotaPackage } from '@/lib/agentmanager/quotaApi'

const EMPTY: Partial<QuotaPackage> = {
  code: '',
  name: '',
  token_quota: 0,
  request_quota: 0,
  diamond_price: 0,
  rmb_price: 0,
  rpm: 0,
  tpm: 0,
  valid_days: 30,
  target_tier: 'all',
  enabled: true,
  sort: 0,
}

export default function Page() {
  const [list, setList] = useState<QuotaPackage[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Partial<QuotaPackage>>(EMPTY)
  const [editingId, setEditingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await quotaAPI.adminListPackages().catch(() => ({ list: [] as QuotaPackage[], total: 0 }))
      setList(res.list || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...EMPTY })
    setOpen(true)
  }

  const openEdit = (p: QuotaPackage) => {
    setEditingId(p.id)
    setForm({ ...p })
    setOpen(true)
  }

  const handleSave = async () => {
    if (!form.code?.trim() || !form.name?.trim()) {
      alert('code 与 name 必填')
      return
    }
    try {
      if (editingId) {
        await quotaAPI.updatePackage(editingId, form)
      } else {
        await quotaAPI.createPackage(form)
      }
      setOpen(false)
      await load()
    } catch (e: any) {
      alert(`保存失败: ${e.message ?? e}`)
    }
  }

  const handleDelete = async (p: QuotaPackage) => {
    if (!confirm(`删除套餐「${p.name}」?`)) return
    await quotaAPI.deletePackage(p.id).catch((e) => alert(`删除失败: ${e.message ?? e}`))
    await load()
  }

  const toggleEnabled = async (p: QuotaPackage) => {
    await quotaAPI.updatePackage(p.id, { enabled: !p.enabled }).catch(() => {})
    await load()
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">🎁 LLM 配额套餐管理</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>刷新</Button>
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreate}>添加套餐</Button>
        </Box>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        配置钻石/人民币购买的 LLM 配额套餐。用户购买后,token 累加到 user_quotas.quota_limit(不影响本月 tokens_used)。
      </Typography>

      {list.length === 0 ? (
        <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 1, p: 3, color: 'text.disabled' }}>
          暂无套餐,点「添加套餐」开始
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 1.5 }}>
          {list.map(p => (
            <Card key={p.id} variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }} noWrap>{p.name}</Typography>
                  <Chip size="small" label={p.enabled ? '上架' : '下架'} color={p.enabled ? 'success' : 'default'} variant="outlined" />
                </Box>
                <Typography variant="caption" color="text.secondary">{p.code}</Typography>
                <Box sx={{ mt: 1, fontSize: 13 }}>
                  <div>Tokens: <b>{p.token_quota.toLocaleString()}</b></div>
                  <div>请求: <b>{p.request_quota.toLocaleString()}</b></div>
                  <div>价格: <b>{p.diamond_price > 0 ? `${p.diamond_price} 💎` : p.rmb_price > 0 ? `¥${(p.rmb_price / 100).toFixed(2)}` : '免费'}</b></div>
                  <div>限速: <b>{p.rpm || '∞'} RPM / {p.tpm || '∞'} TPM</b></div>
                  <div>有效: <b>{p.valid_days} 天</b></div>
                  <div>目标: <b>{p.target_tier}</b></div>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5, mt: 1, justifyContent: 'flex-end' }}>
                  <Switch size="small" checked={p.enabled} onChange={() => toggleEnabled(p)} />
                  <IconButton size="small" onClick={() => openEdit(p)} title="编辑"><EditOutlinedIcon fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDelete(p)} title="删除"><DeleteOutlinedIcon fontSize="small" /></IconButton>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? '编辑套餐' : '添加套餐'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 2 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField label="code" size="small" required sx={{ flex: 1 }} value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="starter_500k" />
            <TextField label="名称" size="small" required sx={{ flex: 2 }} value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField label="Tokens 授予" size="small" type="number" sx={{ flex: 1 }} value={form.token_quota ?? 0} onChange={(e) => setForm({ ...form, token_quota: parseInt(e.target.value, 10) || 0 })} />
            <TextField label="请求数授予" size="small" type="number" sx={{ flex: 1 }} value={form.request_quota ?? 0} onChange={(e) => setForm({ ...form, request_quota: parseInt(e.target.value, 10) || 0 })} />
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField label="钻石价" size="small" type="number" sx={{ flex: 1 }} value={form.diamond_price ?? 0} onChange={(e) => setForm({ ...form, diamond_price: parseInt(e.target.value, 10) || 0 })} helperText="0=不开放钻石" />
            <TextField label="人民币价(分)" size="small" type="number" sx={{ flex: 1 }} value={form.rmb_price ?? 0} onChange={(e) => setForm({ ...form, rmb_price: parseInt(e.target.value, 10) || 0 })} helperText="0=不开放人民币" />
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField label="RPM" size="small" type="number" sx={{ flex: 1 }} value={form.rpm ?? 0} onChange={(e) => setForm({ ...form, rpm: parseInt(e.target.value, 10) || 0 })} helperText="0=不限" />
            <TextField label="TPM" size="small" type="number" sx={{ flex: 1 }} value={form.tpm ?? 0} onChange={(e) => setForm({ ...form, tpm: parseInt(e.target.value, 10) || 0 })} helperText="0=不限" />
            <TextField label="有效天数" size="small" type="number" sx={{ flex: 1 }} value={form.valid_days ?? 30} onChange={(e) => setForm({ ...form, valid_days: parseInt(e.target.value, 10) || 30 })} />
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField label="目标分层" size="small" sx={{ flex: 1 }} value={form.target_tier ?? 'all'} onChange={(e) => setForm({ ...form, target_tier: e.target.value })} helperText="all/vip/enterprise" />
            <TextField label="排序" size="small" type="number" sx={{ flex: 1 }} value={form.sort ?? 0} onChange={(e) => setForm({ ...form, sort: parseInt(e.target.value, 10) || 0 })} />
          </Box>
          <Box>
            <Switch checked={form.enabled ?? true} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> 上架
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleSave}>保存</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
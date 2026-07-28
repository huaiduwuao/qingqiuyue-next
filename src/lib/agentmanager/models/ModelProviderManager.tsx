'use client'

/**
 * 模型供应商管理(参考 CC Switch)
 * 按类型分组(llm/tts/asr/diffusion/codingplan),每个供应商一张卡片:
 * 名称 / base_url / api_key / model / 官网 / 备注 / 启用 / 默认。
 * 对话与生成调用方读取「某类型的默认/启用供应商」来真正跑通。
 */

import { useCallback, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import AddIcon from '@mui/icons-material/Add'
import StarIcon from '@mui/icons-material/Star'

import { agentmAPI, type ModelProvider, type ModelProviderType } from '../api'

const TYPE_META: Record<ModelProviderType, { label: string; color: string; hint: string }> = {
  llm: { label: 'LLM 大模型', color: '#1976d2', hint: '对话/生成用的语言模型(OpenAI 兼容)' },
  tts: { label: 'TTS 语音合成', color: '#7b1fa2', hint: '文字转语音服务' },
  asr: { label: 'ASR 语音识别', color: '#00796b', hint: '语音转文字服务' },
  diffusion: { label: '扩散模型', color: '#e65100', hint: '图像生成(Stable Diffusion 等)' },
  codingplan: { label: 'CodingPlan', color: '#c62828', hint: '编程向模型供应商(OpenAI 兼容)' },
}

const TYPES = Object.keys(TYPE_META) as ModelProviderType[]

const EMPTY: Partial<ModelProvider> = {
  type: 'llm',
  name: '',
  base_url: '',
  api_key: '',
  model: '',
  website: '',
  remark: '',
  enabled: true,
  is_default: false,
  context_length: 0,
  api_format: 'openai',
  auth_field: 'authorization',
}

export default function ModelProviderManager() {
  const [list, setList] = useState<ModelProvider[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Partial<ModelProvider>>(EMPTY)
  const [editingId, setEditingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await agentmAPI.listModelProviders().catch(() => ({ list: [] as ModelProvider[], total: 0 }))
      setList(res.list || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = (type: ModelProviderType) => {
    setEditingId(null)
    setForm({ ...EMPTY, type })
    setOpen(true)
  }

  const openEdit = (p: ModelProvider) => {
    setEditingId(p.id)
    setForm({ ...p })
    setOpen(true)
  }

  const handleSave = async () => {
    if (!form.name?.trim()) {
      alert('请填写供应商名称')
      return
    }
    try {
      if (editingId) {
        await agentmAPI.updateModelProvider(editingId, form)
      } else {
        await agentmAPI.createModelProvider(form)
      }
      setOpen(false)
      await load()
    } catch (e: any) {
      alert(`保存失败: ${e.message}`)
    }
  }

  const handleDelete = async (p: ModelProvider) => {
    if (!confirm(`删除供应商「${p.name}」?`)) return
    await agentmAPI.deleteModelProvider(p.id).catch((e) => alert(`删除失败: ${e.message}`))
    await load()
  }

  const setDefault = async (p: ModelProvider) => {
    await agentmAPI.updateModelProvider(p.id, { is_default: true, enabled: true }).catch(() => {})
    await load()
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">🧠 模型供应商管理</Typography>
        <Button size="small" onClick={load} disabled={loading}>刷新</Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        配置各类模型的接口地址与 Key。对话、技能/工作流生成会使用对应类型下「启用且默认」的供应商。
      </Typography>

      {TYPES.map((t) => {
        const meta = TYPE_META[t]
        const items = list.filter((p) => p.type === t)
        return (
          <Box key={t} sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Chip size="small" label={meta.label} sx={{ bgcolor: meta.color, color: '#fff', fontWeight: 600 }} />
              <Typography variant="caption" color="text.secondary">{meta.hint}</Typography>
              <Box sx={{ flex: 1 }} />
              <Button size="small" startIcon={<AddIcon />} onClick={() => openCreate(t)}>添加</Button>
            </Box>

            {items.length === 0 ? (
              <Box sx={{ border: '1px dashed #e0e0e0', borderRadius: 1, p: 2, color: 'text.disabled', fontSize: 13 }}>
                未配置,点右侧「添加」
              </Box>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 1.5 }}>
                {items.map((p) => (
                  <Card key={p.id} variant="outlined" sx={{ borderColor: p.is_default ? meta.color : 'divider', borderWidth: p.is_default ? 2 : 1 }}>
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }} noWrap>{p.name}</Typography>
                        {p.is_default && <Chip size="small" icon={<StarIcon />} label="默认" color="warning" />}
                        <Chip size="small" label={p.enabled ? '启用' : '停用'} color={p.enabled ? 'success' : 'default'} variant="outlined" />
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }} noWrap>
                        {p.model || '—'} · {p.base_url || '—'}
                      </Typography>
                      {p.remark && (
                        <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }} noWrap>{p.remark}</Typography>
                      )}
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 1, justifyContent: 'flex-end' }}>
                        {!p.is_default && (
                          <Button size="small" onClick={() => setDefault(p)}>设为默认</Button>
                        )}
                        <IconButton size="small" onClick={() => openEdit(p)} title="编辑"><EditOutlinedIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDelete(p)} title="删除"><DeleteOutlineIcon fontSize="small" /></IconButton>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}
          </Box>
        )
      })}

      {/* 编辑/新建对话框 */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? '编辑供应商' : '添加供应商'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            select
            label="类型"
            size="small"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as ModelProviderType })}
            disabled={!!editingId}
          >
            {TYPES.map((t) => <MenuItem key={t} value={t}>{TYPE_META[t].label}</MenuItem>)}
          </TextField>
          <TextField label="供应商名称" size="small" required value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如 DeepSeek / CodingPlan" />
          <TextField label="请求地址 (base_url)" size="small" value={form.base_url ?? ''} onChange={(e) => setForm({ ...form, base_url: e.target.value })} placeholder="https://api.deepseek.com/v1" />
          <TextField label="API Key" size="small" value={form.api_key ?? ''} onChange={(e) => setForm({ ...form, api_key: e.target.value })} placeholder="sk-..." type="password" autoComplete="new-password" />
          <TextField label="模型名 (model)" size="small" value={form.model ?? ''} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="deepseek-chat" />
          <TextField label="官网链接" size="small" value={form.website ?? ''} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://..." />
          {/* 调用配置:上下文长度 / API 格式 / 认证字段 */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              label="上下文长度"
              size="small"
              type="number"
              sx={{ flex: 1 }}
              value={form.context_length ?? 0}
              onChange={(e) => setForm({ ...form, context_length: parseInt(e.target.value, 10) || 0 })}
              helperText="0=模型默认"
            />
            <TextField
              select
              label="API 格式"
              size="small"
              sx={{ flex: 1 }}
              value={form.api_format ?? 'openai'}
              onChange={(e) => setForm({ ...form, api_format: e.target.value as any })}
            >
              <MenuItem value="openai">OpenAI 兼容</MenuItem>
              <MenuItem value="anthropic">Anthropic</MenuItem>
            </TextField>
            <TextField
              select
              label="认证字段"
              size="small"
              sx={{ flex: 1 }}
              value={form.auth_field ?? 'authorization'}
              onChange={(e) => setForm({ ...form, auth_field: e.target.value as any })}
            >
              <MenuItem value="authorization">Authorization: Bearer</MenuItem>
              <MenuItem value="x-api-key">x-api-key</MenuItem>
              <MenuItem value="api-key">api-key (查询参数)</MenuItem>
            </TextField>
          </Box>
          <TextField label="备注" size="small" value={form.remark ?? ''} onChange={(e) => setForm({ ...form, remark: e.target.value })} />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControlLabel control={<Switch checked={form.enabled ?? true} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />} label="启用" />
            <FormControlLabel control={<Switch checked={form.is_default ?? false} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />} label="设为该类型默认" />
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

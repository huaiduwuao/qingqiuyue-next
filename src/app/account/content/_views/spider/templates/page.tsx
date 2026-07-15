'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import { DataGridTable } from '@/components/tables/DataGridTable';
import { listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getTemplateDetail,
  addTemplateAttr,
  deleteTemplateAttr,
  autoGenerateTemplate } from '@/apis/spider';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CheckIcon from '@mui/icons-material/Check';
import type { GridColDef } from '@mui/x-data-grid';
import type { TemplateAttr, AutoTemplateRule, AutoTemplateResult } from '@/beans/spider';

const TYPE_LABELS: Record<string, string> = {
  novel: '小说',
  video: '视频',
  news: '新闻',
  music: '音乐',
  animation: '动漫',
  film: '电影',
  tv: '电视剧',
  html: '通用',
};

interface TemplateFormData {
  name: string;
  type: string;
  source: string;
}

const ATTR_TYPES = ['text', 'link', 'image', 'element', 'meta'];
const ATTR_CODES = ['title', 'link', 'cover', 'content', 'description', 'date', 'container', 'item'];

export default function TemplatesPage() {
  const qc = useQueryClient();
  const [writeVisible, setWriteVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [formValues, setFormValues] = useState<TemplateFormData>({ name: '', type: 'novel', source: '' });
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoUrl, setAutoUrl] = useState('');
  const [autoResult, setAutoResult] = useState<AutoTemplateResult | null>(null);

  const showMessage = useCallback((message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ['spider', 'templates'] }), [qc]);

  const createMutation = useMutation({
    mutationFn: (values: TemplateFormData) => createTemplate(values),
    onSuccess: () => {
      showMessage('创建成功');
      setWriteVisible(false);
      refresh();
    },
    onError: (err: any) => showMessage(err.message || '创建失败', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: number; values: TemplateFormData }) => updateTemplate(vars.id, vars.values),
    onSuccess: () => {
      showMessage('更新成功');
      setWriteVisible(false);
      refresh();
    },
    onError: (err: any) => showMessage(err.message || '更新失败', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTemplate(id),
    onSuccess: () => {
      showMessage('删除成功');
      refresh();
    },
    onError: (err: any) => showMessage(err.message || '删除失败', 'error'),
  });

  const autoGenMutation = useMutation({
    mutationFn: (url: string) => autoGenerateTemplate({ url }),
    onSuccess: (res: any) => {
      setAutoResult(res.data);
    },
    onError: (err: any) => showMessage(err.message || '生成失败', 'error'),
  });

  const applyRuleMutation = useMutation({
    mutationFn: (vars: { templateId: number; rule: AutoTemplateRule }) =>
      addTemplateAttr(vars.templateId, {
        name: vars.rule.code,
        type: vars.rule.code === 'cover' ? 'image' : vars.rule.code === 'link' ? 'link' : 'text',
        code: vars.rule.code,
        content: JSON.stringify({ selector: vars.rule.selector, attr: vars.rule.attr || 'text', isArray: vars.rule.isArray || false }),
      }),
    onSuccess: (_data, vars) => {
      showMessage(`已应用规则: ${vars.rule.code}`);
      qc.invalidateQueries({ queryKey: ['spider', 'template-detail', vars.templateId] });
    },
    onError: (err: any) => showMessage(err.message || '应用失败', 'error'),
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const handleCreate = () => {
    setEditingTemplate(null);
    setFormValues({ name: '', type: 'novel', source: '' });
    setWriteVisible(true);
  };

  const handleEdit = (record: any) => {
    setEditingTemplate(record);
    setFormValues({ name: record.name, type: record.type, source: record.source });
    setWriteVisible(true);
  };

  const handleFormChange = (field: keyof TemplateFormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormValues((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = () => {
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, values: formValues });
    } else {
      createMutation.mutate(formValues);
    }
  };

  const handleDelete = (record: any) => {
    if (!confirm(`确定要删除模板 "${record.name}" 吗？`)) return;
    deleteMutation.mutate(record.id);
  };

  const openAutoGenerate = () => {
    setAutoUrl('');
    setAutoResult(null);
    setAutoOpen(true);
  };

  const handleAutoGenerate = () => {
    if (!autoUrl) return showMessage('请输入 URL', 'error');
    if (!editingTemplate) return showMessage('请先选择模板', 'error');
    autoGenMutation.mutate(autoUrl);
  };

  const handleApplyRule = (rule: AutoTemplateRule) => {
    if (!editingTemplate) return;
    applyRuleMutation.mutate({ templateId: editingTemplate.id, rule });
  };

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 80 },
    { field: 'name', headerName: '名称', width: 150 },
    {
      field: 'type',
      headerName: '类型',
      width: 100,
      renderCell: (params) => <Chip label={TYPE_LABELS[params.value] || params.value} size="small" variant="outlined" />,
    },
    { field: 'source', headerName: '来源', width: 120 },
    { field: 'attrs', headerName: '属性数', width: 100 },
    { field: 'items', headerName: '条目数', width: 100 },
    { field: 'createTime', headerName: '创建时间', width: 180, valueFormatter: (value) => value ? new Date(value).toLocaleString() : '-' },
    {
      field: 'actions',
      headerName: '操作',
      width: 130,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="编辑/属性">
            <IconButton size="small" color="primary" onClick={() => handleEdit(params.row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="删除">
            <IconButton size="small" color="error" onClick={() => handleDelete(params.row)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 } }}>
      <Typography variant="h5" sx={{ mb: 2 }}>模板管理</Typography>
      <DataGridTable
        columns={columns}
        fetchData={async (params) => {
          try {
            const res = await listTemplates({ page: params.pageNumber, pageSize: params.pageSize });
            const records = res.list || [];
            const total = res.total || records.length;
            return { data: { records, totalRow: total }, success: true };
          } catch (err: any) {
            showMessage(err.message || '获取数据失败', 'error');
            return { data: { records: [], totalRow: 0 }, success: false };
          }
        }}
        toolBarRender={() => (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
            新建模板
          </Button>
        )}
      />

      {/* 编辑/新建模板 Dialog */}
      <Dialog open={writeVisible} onClose={() => setWriteVisible(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6">{editingTemplate ? '编辑模板' : '新建模板'}</Typography>
            {editingTemplate && (
              <Button size="small" startIcon={<AutoFixHighIcon />} onClick={openAutoGenerate} sx={{ ml: 'auto' }}>
                智能生成属性
              </Button>
            )}
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="名称" value={formValues.name} onChange={handleFormChange('name')} size="small" fullWidth required />
            <TextField select label="类型" value={formValues.type} onChange={handleFormChange('type')} size="small" fullWidth>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </TextField>
            <TextField label="来源" value={formValues.source} onChange={handleFormChange('source')} size="small" fullWidth placeholder="关联的源名称" />
          </Box>

          {editingTemplate && (
            <>
              <Divider sx={{ my: 2 }} />
              <TemplateAttrsSection templateId={editingTemplate.id} onMsg={showMessage} />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWriteVisible(false)}>取消</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={isSubmitting}>{editingTemplate ? '更新' : '创建'}</Button>
        </DialogActions>
      </Dialog>

      {/* 智能生成 Dialog */}
      <Dialog open={autoOpen} onClose={() => setAutoOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoFixHighIcon color="primary" />
            <Typography variant="h6">LLM 智能分析 — 提取选择器规则</Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 2 }}>
            输入一个示例 URL,LLM 会分析其 DOM 结构,推荐最匹配的字段选择器(标题/链接/封面/容器/列表项)。
            <br />
            <em>注:当前为 mock 模拟,真实接入路径为 <code>POST /api/spider/tasks/rule</code>。</em>
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              label="示例 URL"
              value={autoUrl}
              onChange={(e) => setAutoUrl(e.target.value)}
              size="small"
              fullWidth
              placeholder="https://www.biquge.tw/book/1234"
              disabled={autoGenMutation.isPending}
            />
            <Button variant="contained" onClick={handleAutoGenerate} disabled={autoGenMutation.isPending || !autoUrl} startIcon={autoGenMutation.isPending ? <CircularProgress size={14} /> : <AutoFixHighIcon />}>
              {autoGenMutation.isPending ? '分析中' : '分析'}
            </Button>
          </Box>

          {autoResult && (
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 1 }}>提取的规则 ({autoResult.rules.length})</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                {autoResult.rules.map((r, i) => (
                  <Paper key={i} sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Chip
                      label={r.code}
                      size="small"
                      color={r.source === 'llm' ? 'primary' : r.source === 'heuristic' ? 'warning' : 'default'}
                      sx={{ minWidth: 80 }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 12, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.selector} {r.attr ? `[${r.attr}]` : ''} {r.isArray ? '(列表)' : ''}
                      </Typography>
                      <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                        置信度: {(r.confidence * 100).toFixed(0)}% · 来源: {r.source}
                      </Typography>
                    </Box>
                    <Button size="small" startIcon={<CheckIcon />} onClick={() => handleApplyRule(r)}>应用</Button>
                  </Paper>
                ))}
              </Box>
              {autoResult.previewItems.length > 0 && (
                <>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 1 }}>预览条目</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                    {autoResult.previewItems.map((p, i) => (
                      <Box key={i} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                        {p.cover && <img src={p.cover} alt="" style={{ width: '100%', height: 80, objectFit: 'cover' }} />}
                        <Box sx={{ p: 1 }}>
                          <Typography sx={{ fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</Typography>
                          <Typography sx={{ fontSize: 10, color: 'text.secondary', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.link}</Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAutoOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

function TemplateAttrsSection({ templateId, onMsg }: { templateId: number; onMsg: (m: string, s?: 'success' | 'error') => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['spider', 'template-detail', templateId],
    queryFn: () => getTemplateDetail(templateId).then((r) => r.data),
  });
  const attrs: TemplateAttr[] = data?.attrs || [];
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', type: 'text', code: 'title', content: '{"selector":""}', remark: '' });

  const refresh = () => qc.invalidateQueries({ queryKey: ['spider', 'template-detail', templateId] });

  const addAttrMutation = useMutation({
    mutationFn: (attr: typeof draft) => addTemplateAttr(templateId, attr),
    onSuccess: () => {
      onMsg('已新增');
      setAdding(false);
      setDraft({ name: '', type: 'text', code: 'title', content: '{"selector":""}', remark: '' });
      refresh();
    },
    onError: (err: any) => onMsg(err.message || '新增失败', 'error'),
  });

  const deleteAttrMutation = useMutation({
    mutationFn: (attrId: number) => deleteTemplateAttr(attrId),
    onSuccess: () => {
      onMsg('已删除');
      refresh();
    },
    onError: (err: any) => onMsg(err.message || '删除失败', 'error'),
  });

  const handleAdd = () => {
    addAttrMutation.mutate(draft);
  };

  const handleDelete = (attr: TemplateAttr) => {
    if (!confirm(`删除属性 "${attr.name}"?`)) return;
    deleteAttrMutation.mutate(attr.id);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="subtitle1">模板属性 ({(data?.attrs || []).length})</Typography>
        <Box sx={{ flex: 1 }} />
        <Button size="small" startIcon={<AddIcon />} onClick={() => setAdding(true)} disabled={adding}>新增属性</Button>
      </Box>

      {isLoading ? (
        <Typography sx={{ color: 'text.secondary', fontSize: 12, p: 1 }}>加载中…</Typography>
      ) : attrs.length === 0 ? (
        <Typography sx={{ color: 'text.secondary', fontSize: 12, p: 1 }}>该模板暂无属性,点击右上"新增属性"或使用上方"智能生成"。</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {attrs.map((a) => (
            <Box key={a.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1, bgcolor: 'action.hover' }}>
              <Chip label={a.code} size="small" color="primary" sx={{ minWidth: 70 }} />
              <Typography sx={{ fontSize: 12, fontWeight: 500, minWidth: 80 }}>{a.name}</Typography>
              <Typography sx={{ fontSize: 10, color: 'text.secondary', fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.content}
              </Typography>
              <Typography sx={{ fontSize: 10, color: 'text.secondary', minWidth: 40 }}>{a.type}</Typography>
              <IconButton size="small" color="error" onClick={() => handleDelete(a)}>
                <DeleteIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}

      {adding && (
        <Box sx={{ mt: 1.5, p: 1.5, border: '1px dashed', borderColor: 'divider', borderRadius: 1 }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <TextField size="small" label="名称" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} sx={{ flex: 1 }} />
            <TextField size="small" select label="类型" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })} sx={{ width: 100 }}>
              {ATTR_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
            <TextField size="small" select label="code" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} sx={{ width: 130 }}>
              {ATTR_CODES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
          </Box>
          <TextField size="small" label="content (JSON)" value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} fullWidth sx={{ mb: 1 }} />
          <TextField size="small" label="备注" value={draft.remark} onChange={(e) => setDraft({ ...draft, remark: e.target.value })} fullWidth sx={{ mb: 1 }} />
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button size="small" onClick={() => setAdding(false)}>取消</Button>
            <Button size="small" variant="contained" onClick={handleAdd}>保存</Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}

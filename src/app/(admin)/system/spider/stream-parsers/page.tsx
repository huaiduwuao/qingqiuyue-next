'use client';

/**
 * 通用流解析配置管理(module_stream_parser 表)。
 *
 * 站点无关:可以新建/编辑任意 platform 的解析配置(browser.engine 或 http)。
 * browser_config 是 JSON 字符串:常含 init_state_var / play_url_paths /
 * cover_url_paths / url_regex / media_url_patterns / custom_detail_script
 * 等通用字段。custom_detail_script 让运营为通用字段路径抽不到的字段,
 * 注入一段 evaluate JS — 见 internal/crawler/browser_parser.go::extract 阶段 0.6。
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { DataGridTable } from '@/components/tables/DataGridTable';
import {
  listStreamParsers,
  createStreamParser,
  updateStreamParser,
  deleteStreamParser,
  type StreamParserDTO,
  type StreamParserInput,
} from '@/apis/spider';
import type { GridColDef } from '@mui/x-data-grid';

const LIST_KEY = ['spider', 'stream-parsers'];
const ENGINES = ['http', 'browser'];

export default function StreamParsersPage() {
  const qc = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<StreamParserDTO | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const listQuery = useQuery({
    queryKey: LIST_KEY,
    queryFn: () => listStreamParsers(),
    staleTime: 30_000,
  });
  const showMessage = (message: string, severity: 'success' | 'error' = 'success') =>
    setSnackbar({ open: true, message, severity });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => deleteStreamParser(id),
    onSuccess: () => { showMessage('已删除'); qc.invalidateQueries({ queryKey: LIST_KEY }); },
    onError: (e: any) => showMessage(e?.message ?? '删除失败', 'error'),
  });

  const openCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };
  const openEdit = (row: StreamParserDTO) => {
    setEditing(row);
    setEditorOpen(true);
  };
  const onSave = (input: StreamParserInput, id: number | null) => {
    const promise = id == null
      ? createStreamParser(input)
      : updateStreamParser(id, input);
    return promise.then(() => {
      showMessage(id == null ? '已创建' : '已更新');
      qc.invalidateQueries({ queryKey: LIST_KEY });
      setEditorOpen(false);
    }).catch((e: any) => showMessage(e?.message ?? '保存失败', 'error'));
  };

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 80 },
    { field: 'name', headerName: 'name', flex: 1, minWidth: 160 },
    { field: 'platform', headerName: 'platform', width: 140 },
    { field: 'urlPattern', headerName: 'url_pattern', flex: 1, minWidth: 200 },
    {
      field: 'engine',
      headerName: 'engine',
      width: 110,
      renderCell: (p) => (
        <Chip
          size="small"
          label={p.value || 'http'}
          color={p.value === 'browser' ? 'secondary' : 'default'}
        />
      ),
    },
    { field: 'priority', headerName: 'priority', width: 110, type: 'number' },
    {
      field: 'engine-custom',
      headerName: 'custom_detail_script',
      flex: 2,
      minWidth: 240,
      renderCell: (p) => {
        const bc = (p.row.browserConfig ?? '') as string;
        if (!bc) return <Typography variant="caption">-</Typography>;
        try {
          const obj = JSON.parse(bc);
          const s = obj.custom_detail_script;
          if (!s) return <Typography variant="caption" color="text.secondary">(none)</Typography>;
          return (
            <Typography variant="caption" noWrap sx={{ maxWidth: 360, fontFamily: 'monospace' }}>
              {String(s).slice(0, 80)}
            </Typography>
          );
        } catch {
          return <Typography variant="caption" color="error">invalid json</Typography>;
        }
      },
    },
    {
      field: 'actions',
      headerName: '操作',
      width: 140,
      sortable: false,
      renderCell: (p) => (
        <Stack direction="row">
          <IconButton size="small" onClick={() => openEdit(p.row as StreamParserDTO)} title="编辑">
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(p.row.id)} title="删除">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      ),
    },
  ];

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h5">通用流解析配置</Typography>
          <Typography variant="body2" color="text.secondary">
            module_stream_parser 表的 CRUD UI。
            engine=browser 时,browser_config 是 BrowserParseConfig(JSON);
            URL 命中 → 走通用 BrowserParser.ParseByPlatform,
            custom_detail_script 让运营为 INITIAL_STATE 抽不到的字段注入 JS。
          </Typography>
        </Box>
        <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate}>新建</Button>
      </Stack>

      <Paper sx={{ p: 2 }}>
        <DataGridTable
          columns={columns}
          fetchData={async () => {
            const items = listQuery.data?.items ?? [];
            return { records: items, totalRow: items.length };
          }}
          onEdit={(r: any) => openEdit(r as StreamParserDTO)}
          onDelete={(r: any) => deleteMutation.mutate(r.id)}
        />
      </Paper>

      <StreamParserEditor
        open={editorOpen}
        initial={editing}
        onClose={() => setEditorOpen(false)}
        onSave={onSave}
      />

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

interface EditorProps {
  open: boolean;
  initial: StreamParserDTO | null;
  onClose: () => void;
  onSave: (input: StreamParserInput, id: number | null) => Promise<void>;
}

function StreamParserEditor({ open, initial, onClose, onSave }: EditorProps) {
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('');
  const [urlPattern, setUrlPattern] = useState('');
  const [engine, setEngine] = useState('http');
  const [priority, setPriority] = useState(50);
  const [remark, setRemark] = useState('');
  const [browserConfig, setBrowserConfig] = useState('{}');
  const [err, setErr] = useState('');

  React.useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setPlatform(initial?.platform ?? '');
    setUrlPattern(initial?.urlPattern ?? '');
    setEngine(initial?.engine ?? 'http');
    setPriority(initial?.priority ?? 50);
    setRemark(initial?.remark ?? '');
    setBrowserConfig(initial?.browserConfig ?? '{}');
    setErr('');
  }, [open, initial]);

  const submit = async () => {
    let bcParsed: any = null;
    try { bcParsed = JSON.parse(browserConfig); } catch (e: any) { setErr(`browser_config 不是合法 JSON:${e.message ?? e}`); return; }
    if (!name.trim()) { setErr('name 必填'); return; }
    await onSave({
      name: name.trim(),
      platform: platform.trim(),
      urlPattern: urlPattern.trim(),
      engine,
      priority,
      remark,
      browserConfig: JSON.stringify(bcParsed),
    }, initial?.id ?? null);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{initial ? '编辑' : '新建'}流解析</DialogTitle>
      <DialogContent dividers>
        <Stack sx={{ gap: 2 }}>
          {err && <Alert severity="error">{err}</Alert>}
          <TextField label="name (必填)" value={name} onChange={(e) => setName(e.target.value)} />
          <TextField
            label="platform"
            helperText="平台 routing key;空时取 URL pattern 兜底"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          />
          <TextField
            label="url_pattern (正则,如 ^[^/]*example\\.com/play/)"
            value={urlPattern}
            onChange={(e) => setUrlPattern(e.target.value)}
          />
          <Stack direction="row" sx={{ gap: 2 }}>
            <TextField
              select
              label="engine"
              value={engine}
              onChange={(e) => setEngine(e.target.value)}
              sx={{ minWidth: 200 }}
            >
              {ENGINES.map((e) => (<MenuItem key={e} value={e}>{e}</MenuItem>))}
            </TextField>
            <TextField
              label="priority"
              type="number"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value || '0', 10))}
              sx={{ minWidth: 200 }}
            />
            <TextField label="remark" value={remark} onChange={(e) => setRemark(e.target.value)} sx={{ flex: 1 }} />
          </Stack>
          <TextField
            label="browser_config (JSON)"
            helperText="engine=browser 时使用。常见键:init_state_var / play_url_paths / cover_url_paths / url_regex / extra_wait_ms / media_url_patterns / custom_detail_script"
            multiline
            minRows={10}
            maxRows={24}
            value={browserConfig}
            onChange={(e) => setBrowserConfig(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" onClick={submit}>保存</Button>
      </DialogActions>
    </Dialog>
  );
}

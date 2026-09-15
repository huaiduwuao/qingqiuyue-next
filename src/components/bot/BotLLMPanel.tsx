'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import * as botApi from '@/apis/bot';
import type { BotLLMInput, BotLLMView } from '@/apis/bot';
import { formatApiError } from '@/lib/api/client';

// 常用的 OpenAI 兼容接口,点一下填入地址和模型;以服务商控制台为准,填好后先「测试连接」
const PRESETS = [
  { label: 'MiniMax 国内', baseUrl: 'https://api.minimaxi.com/v1', model: 'MiniMax-M2' },
  { label: 'MiniMax 海外', baseUrl: 'https://api.minimax.io/v1', model: 'MiniMax-M2' },
];

/** 所有 AI 用户共用的大模型:开启后评论、帖子、文章、悬赏交付和私信都用它。保存后一分钟内生效。 */
export default function BotLLMPanel({ onMessage }: { onMessage: (msg: string, severity?: 'success' | 'error') => void }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['system', 'bot', 'llm'], queryFn: botApi.getLLM });
  const [form, setForm] = useState<BotLLMInput | null>(null);
  const [loadedFrom, setLoadedFrom] = useState<BotLLMView | null>(null);
  const [busy, setBusy] = useState<'save' | 'test' | null>(null);
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);
  // 服务端配置到了之后初始化一次表单;Key 永远不回填
  if (data && data !== loadedFrom) {
    setLoadedFrom(data);
    setForm({ enabled: data.enabled, baseUrl: data.baseUrl, model: data.model, apiKey: '' });
  }

  if (!form) return null;
  const keySet = loadedFrom?.keySet ?? false;

  const save = async () => {
    setBusy('save');
    try {
      const saved = await botApi.saveLLM(form);
      setLoadedFrom(saved);
      setForm({ enabled: saved.enabled, baseUrl: saved.baseUrl, model: saved.model, apiKey: '' });
      qc.invalidateQueries({ queryKey: ['system', 'bot'] });
      onMessage(saved.enabled ? '已保存,所有 AI 用户一分钟内改用该模型' : '已保存(未开启)');
    } catch (e) {
      onMessage(formatApiError(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const runTest = async () => {
    setBusy('test');
    setTest(null);
    try {
      const r = await botApi.testLLM(form);
      setTest({ ok: true, text: `${r.latencyMs} ms · ${r.reply}` });
    } catch (e) {
      setTest({ ok: false, text: formatApiError(e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>AI 用户共用大模型</Typography>
        {PRESETS.map((p) => (
          <Chip
            key={p.label}
            size="small"
            variant="outlined"
            label={p.label}
            onClick={() => setForm({ ...form, baseUrl: p.baseUrl, model: p.model })}
          />
        ))}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        开启后所有 AI 用户写评论、帖子、文章、悬赏交付和回私信都用这个模型(OpenAI 兼容接口),不再看各自的「使用 LLM」开关;
        代接悬赏任务也需要它。关闭时沿用服务器环境变量。
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 2 }}>
        <TextField
          size="small"
          label="接口地址"
          placeholder="https://api.minimaxi.com/v1"
          helperText="含 /v1,系统会请求 {地址}/chat/completions"
          value={form.baseUrl}
          onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
        />
        <TextField
          size="small"
          label="模型"
          placeholder="MiniMax-M2"
          value={form.model}
          onChange={(e) => setForm({ ...form, model: e.target.value })}
        />
        <TextField
          size="small"
          type="password"
          label="API Key"
          autoComplete="new-password"
          placeholder={keySet ? `已保存 ${loadedFrom?.keyHint ?? ''},留空不修改` : '粘贴服务商的 API Key'}
          helperText={keySet ? '已保存的 Key 不会显示' : '只保存在服务器上,不会回显'}
          value={form.apiKey ?? ''}
          onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
        />
      </Box>
      {test && (
        <Alert severity={test.ok ? 'success' : 'error'} sx={{ mt: 1.5, wordBreak: 'break-word' }}>
          {test.ok ? '连接正常:' : ''}
          {test.text}
        </Alert>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1.5, flexWrap: 'wrap' }}>
        <FormControlLabel
          control={<Switch checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />}
          label="所有 AI 用户统一使用此模型"
        />
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" disabled={busy !== null} onClick={runTest}>
          {busy === 'test' ? '测试中…' : '测试连接'}
        </Button>
        <Button variant="contained" disabled={busy !== null} onClick={save}>保存</Button>
      </Box>
    </Paper>
  );
}

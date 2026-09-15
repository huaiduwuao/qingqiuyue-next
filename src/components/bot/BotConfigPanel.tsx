'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import * as botApi from '@/apis/bot';
import type { BotConfig } from '@/apis/bot';
import { formatApiError } from '@/lib/api/client';

const NUMBER_FIELDS: { key: keyof BotConfig; label: string; help: string }[] = [
  { key: 'targetBotCount', label: '目标 AI 用户数', help: '不足时每 10 分钟补建 10 个,上限 2000' },
  { key: 'maxBotsPerTick', label: '高峰每分钟行动数', help: '晚上 9 点满额,其他时段按作息曲线折算' },
  { key: 'dailyActionCap', label: '每人每天行动上限', help: '点赞、评论、发帖等合计' },
  { key: 'maxPostsPerBotPerDay', label: '每人每天发帖上限', help: '0 = 不发帖' },
  { key: 'postGapSeconds', label: '全站发帖间隔(秒)', help: '两条 AI 帖子之间至少隔多久' },
  { key: 'engageBudgetPerTick', label: '每分钟回应真人次数', help: '给真人的新帖点赞评论、回关、回复' },
  { key: 'bountyPerDay', label: '每天发悬赏数', help: '全站合计,0 = 不发;AI 用户不认领任务' },
  { key: 'bountyMinYuan', label: '悬赏赏金下限(元)', help: '单个悬赏,按钻石托管' },
  { key: 'bountyMaxYuan', label: '悬赏赏金上限(元)', help: '单个悬赏' },
  { key: 'diamondGrantPerDayYuan', label: '每天发放钻石上限(元)', help: '平台发给 AI 用户的钻石,结账退回的会复用' },
  { key: 'initialDiamonds', label: '每人初始钻石', help: '每个 AI 用户一次性发放,新 AI 用户自动补发;不能提现' },
  { key: 'botClaimsPerDay', label: '每天代接任务数', help: '真人需求里开放满 10 分钟没人接的任务;需 LLM,带 AI 标记,驳回即重新开放' },
  { key: 'worksPerDay', label: '每天发作品数', help: '短评文章,自动审核通过后上线;0 = 不发' },
];

/** AI 用户运营参数:规模、活跃度、发帖节奏。保存后调度器一分钟内生效。 */
export default function BotConfigPanel({ onMessage }: { onMessage: (msg: string, severity?: 'success' | 'error') => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['system', 'bot', 'config'], queryFn: botApi.getConfig });
  const [form, setForm] = useState<BotConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // 服务端配置到了之后初始化一次表单;之后以用户编辑为准
  const [loadedFrom, setLoadedFrom] = useState<BotConfig | null>(null);
  if (data?.config && data.config !== loadedFrom) {
    setLoadedFrom(data.config);
    setForm(data.config);
  }

  if (isLoading || !form) return null;

  const save = async () => {
    setSaving(true);
    try {
      const saved = await botApi.saveConfig(form);
      setForm(saved);
      qc.invalidateQueries({ queryKey: ['system', 'bot', 'config'] });
      onMessage('已保存,一分钟内生效');
    } catch (e) {
      onMessage(formatApiError(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      const r = await botApi.refreshPersonas();
      onMessage(`已为 ${r.updated} 个 AI 用户补上人设`);
      qc.invalidateQueries({ queryKey: ['system', 'bot'] });
    } catch (e) {
      onMessage(formatApiError(e), 'error');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>AI 用户运营参数</Typography>
        <Typography variant="body2" color="text.secondary">
          当前 {data?.botCount ?? 0} 个(在岗 {data?.activeCount ?? 0})· 文案:{data?.llmEnabled ? 'LLM 生成' : '按人设模板组合(未配置 LLM)'}
        </Typography>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
        {NUMBER_FIELDS.map((f) => (
          <TextField
            key={f.key}
            size="small"
            type="number"
            label={f.label}
            helperText={f.help}
            value={form[f.key] as number}
            onChange={(e) => setForm({ ...form, [f.key]: Number(e.target.value) || 0 })}
          />
        ))}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1.5, flexWrap: 'wrap' }}>
        <FormControlLabel
          control={<Switch checked={form.followDayCurve} onChange={(e) => setForm({ ...form, followDayCurve: e.target.checked })} />}
          label="按作息曲线调节(凌晨少、晚上多)"
        />
        <FormControlLabel
          control={<Switch color="warning" checked={form.paused} onChange={(e) => setForm({ ...form, paused: e.target.checked })} />}
          label="暂停全部 AI 用户"
        />
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" disabled={refreshing} onClick={refresh}>补全人设</Button>
        <Button variant="contained" disabled={saving} onClick={save}>保存</Button>
      </Box>
    </Paper>
  );
}

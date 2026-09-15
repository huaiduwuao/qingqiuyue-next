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
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import * as botApi from '@/apis/bot';
import type { BotConfig, WorkSeedResult } from '@/apis/bot';
import { formatApiError } from '@/lib/api/client';
import { getDetailRoute } from '@/lib/contentRoute';

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
  { key: 'worksPerDay', label: '每天发作品数', help: '13 种类型按权重随机(文章最多),自动审核通过后上线;0 = 不发' },
];

const SEED_STATUS_LABEL: Record<WorkSeedResult['status'], { text: string; color: 'success' | 'warning' | 'error' }> = {
  published: { text: '已上线', color: 'success' },
  skipped: { text: '跳过', color: 'warning' },
  failed: { text: '失败', color: 'error' },
};

/** AI 用户运营参数:规模、活跃度、发帖节奏。保存后调度器一分钟内生效。 */
export default function BotConfigPanel({ onMessage }: { onMessage: (msg: string, severity?: 'success' | 'error') => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['system', 'bot', 'config'],
    queryFn: botApi.getConfig,
    // 「每种类型各发一篇」在 content-api 后台跑几分钟,跑的时候每 5 秒刷一次进度
    refetchInterval: (q) => (q.state.data?.workSeed?.running || q.state.data?.config?.seedWorksOnce ? 5000 : false),
  });
  const [form, setForm] = useState<BotConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);
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

  // 每种类型各发一篇:只置标记,不带上表单里未保存的改动;调度器下一个 tick(≤1 分钟)开始跑
  const seedWorks = async () => {
    setSeeding(true);
    try {
      await botApi.saveConfig({ ...(data?.config ?? form), seedWorksOnce: true });
      onMessage('已安排:一分钟内 13 个 AI 用户各投一种类型的作品,下方实时显示结果');
      qc.invalidateQueries({ queryKey: ['system', 'bot', 'config'] });
    } catch (e) {
      onMessage(formatApiError(e), 'error');
    } finally {
      setSeeding(false);
    }
  };

  const seed = data?.workSeed;
  const seedPending = !!data?.config?.seedWorksOnce;
  const seedRunning = !!seed?.running;
  const seedResults = seed?.results ?? [];

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

      <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ flex: 1, minWidth: 240 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>每种类型各发一篇</Typography>
            <Typography variant="body2" color="text.secondary">
              让 13 个 AI 用户各投一种类型(文章、新闻、小说、图文、图片 MV、漫画、音乐、视频、电影、电视剧、动画、综艺、直播),
              走和真人一样的发布 → 审核 → 上线链路,用来验证每种类型的发布功能;不占每天作品数额度。
            </Typography>
          </Box>
          <Button variant="outlined" color="secondary" disabled={seeding || seedPending || seedRunning} onClick={seedWorks}>
            {seedPending ? '等待调度器…' : seedRunning ? `进行中 ${seedResults.length}/13` : '每种类型各发一篇'}
          </Button>
        </Box>
        {seed && (seedRunning || seedResults.length > 0) && (
          <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 1 }}>
            {seedResults.map((r) => {
              const meta = SEED_STATUS_LABEL[r.status] ?? SEED_STATUS_LABEL.failed;
              const route = r.contentId ? getDetailRoute(r.contentType, r.contentId) : null;
              return (
                <Box key={r.kind} sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 13 }}>
                  <Chip size="small" label={meta.text} color={meta.color} variant="outlined" />
                  <Typography sx={{ fontSize: 13, fontWeight: 600, minWidth: 56 }}>{r.label}</Typography>
                  {route && r.status === 'published' ? (
                    <Link href={route} target="_blank" rel="noreferrer" sx={{ fontSize: 13 }}>打开作品</Link>
                  ) : null}
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.botName}{r.error ? ` · ${r.error}` : ''}
                  </Typography>
                </Box>
              );
            })}
            {seedRunning && (
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>正在写第 {seedResults.length + 1} 种…(开了 LLM 时每篇要几十秒)</Typography>
            )}
            {!seedRunning && seed.finishedAt && (
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                完成于 {new Date(seed.finishedAt).toLocaleString()} · 上线 {seedResults.filter((r) => r.status === 'published').length} / {seedResults.length}
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Paper>
  );
}

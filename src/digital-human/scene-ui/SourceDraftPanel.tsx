'use client';

/**
 * 接入助手草稿卡片 —— 数字人调 ui_show_source_draft 时弹出。
 *
 * 数据用「当前看卡片的人」的会话向 spider-api 取;「保存为爬虫源」也是这个人点的,不经过 agent:
 * 助手手里没有保存工具,这张卡是它起草的配置落库的唯一入口。决定之后把结果回灌给数字人。
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import {
  getSourceDraft, applySourceDraft, discardSourceDraft, summarizeDraftReport, type SourceDraft,
} from '@/apis/sourceSetup';

const ACCENT = '#25F4EE';
const TEXT = 'rgba(255,255,255,0.92)';
const SUBTEXT = 'rgba(255,255,255,0.55)';

const STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: '待确认', color: '#FFB547' },
  applied: { label: '已保存', color: '#4ADE80' },
  discarded: { label: '已放弃', color: SUBTEXT },
};

function errText(e: unknown): string {
  const status = (e as { status?: number } | null)?.status;
  if (status === 401 || status === 403) return '只有爬虫运营能查看和保存接入草稿。';
  return (e as { message?: string } | null)?.message || '加载失败';
}

export default function SourceDraftPanel({ draftId, onSend }: { draftId: string; onSend: (t: string) => void }) {
  const [draft, setDraft] = React.useState<SourceDraft | null>(null);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [showProfile, setShowProfile] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    getSourceDraft(draftId)
      .then((d) => { if (!cancelled) { setDraft(d); setError(''); } })
      .catch((e) => { if (!cancelled) setError(errText(e)); });
    return () => { cancelled = true; };
  }, [draftId]);

  const act = async (apply: boolean) => {
    setBusy(true);
    try {
      const d = await (apply ? applySourceDraft(draftId) : discardSourceDraft(draftId));
      setDraft(d);
      onSend(apply
        ? `我已把草稿 ${draftId} 保存为爬虫源(${d.domain},模板 ${d.template_id})。`
        : `我放弃了草稿 ${draftId}。`);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  if (error && !draft) return <Typography sx={{ color: '#FFB547', fontSize: 14 }}>{error}</Typography>;
  if (!draft) return <LinearProgress sx={{ '& .MuiLinearProgress-bar': { bgcolor: ACCENT } }} />;

  const s = STATUS[draft.status] ?? { label: draft.status, color: SUBTEXT };
  const lines = summarizeDraftReport(draft);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, color: TEXT }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Chip size="small" label={s.label} sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: s.color, fontWeight: 600 }} />
        <Chip size="small" variant="outlined" label={draft.ok ? '试跑通过' : '试跑未通过'}
          sx={{ color: draft.ok ? '#4ADE80' : '#F87171', borderColor: draft.ok ? '#4ADE80' : '#F87171' }} />
        <Typography sx={{ fontSize: 16, fontWeight: 600 }}>{draft.domain}</Typography>
        <Typography sx={{ fontSize: 12.5, color: SUBTEXT }}>
          {draft.kind === 'book' ? '小说' : '影视'} · {draft.category}
          {draft.credential_id > 0 ? ` · 登录凭据 #${draft.credential_id}` : ''}
        </Typography>
      </Box>

      <Typography sx={{ fontSize: 13, color: SUBTEXT }}>
        试跑作品:{draft.sample_title}{draft.sample_author ? ` / ${draft.sample_author}` : ''}{draft.sample_year ? ` (${draft.sample_year})` : ''}
      </Typography>
      {lines.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.04)' }}>
          {lines.map((l) => (
            <Typography key={l} sx={{ fontSize: 12.5, color: /出错|没有/.test(l) ? '#F87171' : TEXT }}>{l}</Typography>
          ))}
        </Box>
      )}

      <Typography component="button" type="button" onClick={() => setShowProfile((v) => !v)}
        sx={{ all: 'unset', cursor: 'pointer', fontSize: 12.5, color: ACCENT }}>
        {showProfile ? '收起模板内容' : '查看模板内容'}
      </Typography>
      {showProfile && (
        <Box component="pre" sx={{ m: 0, p: 1.25, maxHeight: 260, overflow: 'auto', fontSize: 11.5, borderRadius: 1.5, bgcolor: 'rgba(0,0,0,0.35)', color: SUBTEXT }}>
          {JSON.stringify(draft.profile, null, 2)}
        </Box>
      )}

      {draft.status === 'draft' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button fullWidth variant="contained" disabled={busy || !draft.ok} onClick={() => act(true)}
              sx={{ bgcolor: '#4ADE80', color: '#04121a', fontWeight: 600, '&:hover': { bgcolor: '#6ee7a0' } }}>
              保存为爬虫源
            </Button>
            <Button fullWidth variant="outlined" disabled={busy} onClick={() => act(false)}
              sx={{ color: '#F87171', borderColor: 'rgba(248,113,113,0.6)' }}>
              放弃
            </Button>
          </Box>
          <Typography sx={{ fontSize: 11.5, color: SUBTEXT }}>
            保存由你本人执行,AI 助手没有保存权限。同域名同类型已有模板时会用这份替换。
          </Typography>
        </Box>
      )}
      {draft.status === 'applied' && draft.template_id !== '0' && (
        <Typography component="a" href={`/system/spider/templates/edit?id=${encodeURIComponent(draft.template_id)}`}
          sx={{ fontSize: 12.5, color: ACCENT, textDecoration: 'none' }}>
          在模板管理里查看 →
        </Typography>
      )}
      {error && <Typography sx={{ color: '#FFB547', fontSize: 13 }}>{error}</Typography>}
    </Box>
  );
}

'use client';

import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Snackbar from '@mui/material/Snackbar';
import Chip from '@mui/material/Chip';
import Checkbox from '@mui/material/Checkbox';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import CopyrightRoundedIcon from '@mui/icons-material/CopyrightRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { formatApiError } from '@/lib/api/client';
import { coverBackground } from '@/lib/media';
import { getMyWorks } from '@/apis/dashboard';
import {
  listCerts,
  listSuspects,
  listTakedowns,
  listWhitelist,
  applyCerts,
  setCertStatus,
  removeCert,
  appealCase,
  caseAction,
  removeWhitelist,
  type OriginalCert,
  type OriginalCase,
} from '@/apis/original';

/**
 * 原创保护:给自己已发布的作品登记存证;监测中的存证会在站内比对同名作品,
 * 其他用户发布的同名内容出现在「疑似侵权」,可以发起下架申诉(进入平台举报审核)、忽略或加入白名单。
 * 平台只比对站内内容,不做跨平台监测。
 */

const CASE_STATUS: Record<OriginalCase['status'], { label: string; color: 'default' | 'warning' | 'info' | 'success' | 'error' }> = {
  pending: { label: '待处理', color: 'warning' },
  ignored: { label: '已忽略', color: 'default' },
  submitted: { label: '申诉审核中', color: 'info' },
  takenDown: { label: '申诉成立', color: 'success' },
  rejected: { label: '申诉被驳回', color: 'error' },
};

const fmtDate = (ms: number) => (ms ? new Date(ms).toLocaleString('zh-CN', { hour12: false }) : '-');
const shortHash = (h: string) => (h.length > 16 ? `${h.slice(0, 8)}…${h.slice(-6)}` : h);
const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] as string);

/** 打开一张可打印的存证证书,浏览器里可直接「另存为 PDF」 */
function printCertificate(c: OriginalCert) {
  const w = window.open('', '_blank', 'width=720,height=900');
  if (!w) return false;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>原创存证证书 ${esc(c.certificateNo)}</title>
<style>body{font-family:system-ui,"PingFang SC","Microsoft YaHei",sans-serif;padding:48px;color:#222}
.card{border:3px double #c8102e;padding:40px;border-radius:8px}h1{text-align:center;color:#c8102e;letter-spacing:8px;margin:0 0 32px}
table{width:100%;border-collapse:collapse}td{padding:10px 4px;border-bottom:1px solid #eee;font-size:14px;vertical-align:top}
td:first-child{color:#888;width:110px}.mono{font-family:Consolas,monospace;word-break:break-all}.foot{margin-top:32px;font-size:12px;color:#888;text-align:center}</style>
</head><body><div class="card"><h1>原创存证证书</h1><table>
<tr><td>证书编号</td><td class="mono">${esc(c.certificateNo)}</td></tr>
<tr><td>作品名称</td><td>${esc(c.title)}</td></tr>
<tr><td>作品编号</td><td class="mono">${esc(c.contentId)}</td></tr>
<tr><td>内容指纹</td><td class="mono">SHA-256 ${esc(c.fingerprint)}</td></tr>
<tr><td>登记时间</td><td>${esc(fmtDate(c.registeredAt))}</td></tr>
</table><div class="foot">本证书记录作品在青丘阅平台的原创登记信息,指纹由作品编号、作者、标题与发布时间计算得出。</div></div>
<script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
  return true;
}

export default function OriginalPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [snack, setSnack] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addSelected, setAddSelected] = useState<string[]>([]);
  const [appealTarget, setAppealTarget] = useState<OriginalCase | null>(null);
  const [appealReason, setAppealReason] = useState('');
  const [busy, setBusy] = useState(false);

  const certsQ = useQuery({ queryKey: ['original', 'certs'], queryFn: listCerts, refetchOnMount: 'always' });
  const suspectsQ = useQuery({ queryKey: ['original', 'suspects'], queryFn: listSuspects, refetchOnMount: 'always' });
  const takedownsQ = useQuery({ queryKey: ['original', 'takedowns'], queryFn: listTakedowns, enabled: tab === 2 });
  const whitelistQ = useQuery({ queryKey: ['original', 'whitelist'], queryFn: listWhitelist, enabled: tab === 3 });
  const worksQ = useQuery({ queryKey: ['creator-my-works'], queryFn: () => getMyWorks(), enabled: addOpen });

  const certs = certsQ.data ?? [];
  const suspects = suspectsQ.data ?? [];
  const registered = useMemo(() => new Set(certs.map((c) => c.contentId)), [certs]);
  const candidates = ((worksQ.data as any)?.list ?? (worksQ.data as any)?.records ?? []).filter(
    (w: any) => !registered.has(String(w.id)),
  );

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      setSnack(ok);
      qc.invalidateQueries({ queryKey: ['original'] });
      return true;
    } catch (err) {
      setSnack(formatApiError(err) || '操作失败,请稍后重试');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const stats = [
    { label: '已存证作品', value: certs.length },
    { label: '监测中', value: certs.filter((c) => c.status === 'monitoring').length },
    { label: '待处理疑似侵权', value: suspects.length },
    { label: '申诉成立', value: (takedownsQ.data ?? []).filter((t) => t.status === 'takenDown').length },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <CopyrightRoundedIcon sx={{ color: 'primary.main' }} />
        <Typography sx={{ fontSize: 18, fontWeight: 700, flex: 1 }}>原创保护</Typography>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => { setAddSelected([]); setAddOpen(true); }} sx={{ textTransform: 'none' }}>
          登记作品
        </Button>
      </Box>
      <Alert severity="info">
        给已发布的作品登记原创存证后,平台会在站内比对同名作品:其他用户发布的同名内容会出现在「疑似侵权」。
        发起下架申诉后由平台审核,结论会同步到「维权记录」。目前只比对本平台内容。
      </Alert>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
        {stats.map((s) => (
          <Box key={s.label} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s.label}</Typography>
            <Typography sx={{ fontSize: 24, fontWeight: 700 }}>{s.value}</Typography>
          </Box>
        ))}
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab label={`我的存证 (${certs.length})`} />
        <Tab label={`疑似侵权 (${suspects.length})`} />
        <Tab label="维权记录" />
        <Tab label="白名单" />
      </Tabs>

      {tab === 0 && (
        <Section loading={certsQ.isLoading} empty={certs.length === 0} emptyText="还没有登记存证的作品">
          {certs.map((c) => (
            <Row key={c.id} cover={c.cover}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{c.title}</Typography>
                  <Chip size="small" label={c.status === 'monitoring' ? '监测中' : '已暂停'} color={c.status === 'monitoring' ? 'info' : 'default'} />
                  {c.infringeCount > 0 && <Chip size="small" color="warning" label={`疑似侵权 ${c.infringeCount}`} />}
                </Box>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5, fontFamily: 'monospace' }}>
                  {c.certificateNo} · 指纹 {shortHash(c.fingerprint)}
                </Typography>
                <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>
                  登记于 {fmtDate(c.registeredAt)} · 播放 {c.totalViews}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Button size="small" onClick={() => { if (!printCertificate(c)) setSnack('浏览器拦截了弹窗,请允许后重试'); }}>证书</Button>
                <Button
                  size="small"
                  disabled={busy}
                  onClick={() => act(() => setCertStatus(c.id, c.status === 'monitoring' ? 'paused' : 'monitoring'), c.status === 'monitoring' ? '已暂停比对' : '已恢复比对')}
                >
                  {c.status === 'monitoring' ? '暂停' : '恢复'}
                </Button>
                <Button
                  size="small"
                  color="error"
                  disabled={busy}
                  onClick={() => { if (window.confirm(`撤销《${c.title}》的存证?未处理的疑似侵权记录会一并清除。`)) act(() => removeCert(c.id), '已撤销存证'); }}
                >
                  撤销
                </Button>
              </Box>
            </Row>
          ))}
        </Section>
      )}

      {tab === 1 && (
        <Section loading={suspectsQ.isLoading} empty={suspects.length === 0} emptyText="没有发现站内同名作品">
          {suspects.map((s) => (
            <Row key={s.id} cover={s.suspectCover}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{s.suspectTitle || `作品 ${s.suspectContentId}`}</Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
                  发布者 {s.infractorName} · 播放 {s.views} · 与我的《{s.workTitle}》同名
                </Typography>
                <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>发现于 {fmtDate(s.detectedAt)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Button size="small" variant="contained" disabled={busy} onClick={() => { setAppealTarget(s); setAppealReason(''); }} sx={{ textTransform: 'none' }}>
                  申诉下架
                </Button>
                <Button size="small" disabled={busy} onClick={() => act(() => caseAction(s.id, 'ignore'), '已忽略')}>忽略</Button>
                <Button size="small" disabled={busy} onClick={() => act(() => caseAction(s.id, 'whitelist'), `已把 ${s.infractorName} 加入白名单`)}>
                  加白名单
                </Button>
              </Box>
            </Row>
          ))}
        </Section>
      )}

      {tab === 2 && (
        <Section loading={takedownsQ.isLoading} empty={(takedownsQ.data ?? []).length === 0} emptyText="还没有发起过下架申诉">
          {(takedownsQ.data ?? []).map((t) => (
            <Row key={t.id} cover={t.suspectCover}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{t.suspectTitle || `作品 ${t.suspectContentId}`}</Typography>
                  <Chip size="small" label={CASE_STATUS[t.status]?.label ?? t.status} color={CASE_STATUS[t.status]?.color ?? 'default'} />
                </Box>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
                  发布者 {t.infractorName} · 我的存证 {t.certificateNo}
                </Typography>
                {t.reason && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>申诉理由:{t.reason}</Typography>}
                {t.reviewNote && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>审核意见:{t.reviewNote}</Typography>}
                <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>更新于 {fmtDate(t.updatedAt)}</Typography>
              </Box>
            </Row>
          ))}
        </Section>
      )}

      {tab === 3 && (
        <Section loading={whitelistQ.isLoading} empty={(whitelistQ.data ?? []).length === 0} emptyText="白名单为空。白名单里的作者发布同名作品不会被提示。">
          {(whitelistQ.data ?? []).map((w) => (
            <Row key={w.userId}>
              <Typography sx={{ flex: 1, fontSize: 14 }}>{w.name}</Typography>
              <Button size="small" disabled={busy} onClick={() => act(() => removeWhitelist(w.userId), `已把 ${w.name} 移出白名单`)}>
                移出
              </Button>
            </Row>
          ))}
        </Section>
      )}

      {/* 登记作品 */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>登记原创存证</DialogTitle>
        <DialogContent>
          {worksQ.isLoading ? (
            <Box sx={{ textAlign: 'center', py: 3 }}><CircularProgress size={24} /></Box>
          ) : candidates.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: 'text.secondary', py: 2 }}>没有可以登记的已发布作品(已登记的不会重复显示)。</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 360, overflowY: 'auto' }}>
              {candidates.map((w: any) => {
                const id = String(w.id);
                const checked = addSelected.includes(id);
                return (
                  <Box
                    key={id}
                    onClick={() => setAddSelected((p) => (checked ? p.filter((x) => x !== id) : [...p, id]))}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1, cursor: 'pointer', border: '1px solid', borderColor: checked ? 'primary.main' : 'divider' }}
                  >
                    <Checkbox checked={checked} size="small" sx={{ p: 0 }} />
                    <Typography sx={{ fontSize: 13, flex: 1 }}>{w.title}</Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>播放 {w.views ?? 0}</Typography>
                  </Box>
                );
              })}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>取消</Button>
          <Button
            variant="contained"
            disabled={busy || addSelected.length === 0}
            onClick={async () => { if (await act(() => applyCerts(addSelected), `已登记 ${addSelected.length} 个作品`)) setAddOpen(false); }}
          >
            登记 {addSelected.length} 个作品
          </Button>
        </DialogActions>
      </Dialog>

      {/* 下架申诉 */}
      <Dialog open={!!appealTarget} onClose={() => setAppealTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>申诉下架《{appealTarget?.suspectTitle}》</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 2 }}>
            申诉会提交给平台内容审核,并附上你的存证 {appealTarget?.certificateNo}。审核结论会显示在「维权记录」。
          </Typography>
          <TextField
            label="申诉理由"
            placeholder="说明作品为你原创,以及对方作品的问题"
            value={appealReason}
            onChange={(e) => setAppealReason(e.target.value)}
            multiline
            minRows={3}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAppealTarget(null)}>取消</Button>
          <Button
            variant="contained"
            disabled={busy || !appealReason.trim()}
            onClick={async () => {
              if (appealTarget && (await act(() => appealCase(appealTarget.id, appealReason.trim()), '申诉已提交,等待平台审核'))) setAppealTarget(null);
            }}
          >
            提交申诉
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack(null)} message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}

function Section({ loading, empty, emptyText, children }: { loading: boolean; empty: boolean; emptyText: string; children: React.ReactNode }) {
  if (loading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress size={24} /></Box>;
  if (empty) return <Typography sx={{ fontSize: 13, color: 'text.secondary', py: 3, textAlign: 'center' }}>{emptyText}</Typography>;
  return <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>{children}</Box>;
}

function Row({ cover, children }: { cover?: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
      {cover !== undefined && (
        <Box
          sx={{
            width: 64,
            height: 64,
            flexShrink: 0,
            borderRadius: 1,
            bgcolor: 'action.hover',
            backgroundImage: coverBackground(cover),
          }}
        />
      )}
      {children}
    </Box>
  );
}

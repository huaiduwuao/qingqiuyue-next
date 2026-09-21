'use client';

// TopicInsightsEditorDialog —— admin 编辑器:把专题洞察(lineups/versionHistory/autoFromSources)
// 作为一个独立的 Dialog 弹出,独立于新建/编辑专题的主 Dialog。这样 admin 主页面
// 的 linter 改动不会波及到这里,反过来本组件回滚也不会牵连主页。
//
// 数据来源:
//   - 读:GET /api/content/topic/:id/metadata → { payload: InsightsPayload }
//   - 写:PUT /api/content/topic/:id/metadata → 整体 JSONB 覆盖
//
// 行编辑的增删:右上角 + 加行 / 垃圾桶删行,内联展开,与项目内通用风格一致。
// 提交时把表单内 state 整体打包,后端做最终校验。

import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import {
  fetchTopicMetadata,
  updateTopicMetadata,
  type TopicInsightLineup,
  type TopicInsightVersion,
  type TopicInsightsPayload,
  type TopicTemplateConfig,
} from '@/apis/topic';

interface Props {
  open: boolean;
  topicId: number | null;
  topicTitle?: string;
  onClose: () => void;
  onSaved?: () => void;
}

type LineupRow = TopicInsightLineup;
type VersionRow = TopicInsightVersion;

const emptyLineup = (): LineupRow => ({ title: '', subtitle: '', cover: '', vendor: '', sourceUrl: '' });
const emptyVersion = (): VersionRow => ({ version: '', releasedAt: '', summary: '', sourceUrl: '' });

export function TopicInsightsEditorDialog({ open, topicId, topicTitle, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 表单 state。默认空,GET 拿到后回填。打开时重置。
  const [lineupTitle, setLineupTitle] = useState('当前版本热门阵容');
  const [lineupHint, setLineupHint] = useState('数据来源:tft.composition 子分类');
  const [lineups, setLineups] = useState<LineupRow[]>([]);

  const [versionTitle, setVersionTitle] = useState('历史版本时间线');
  const [versionHint, setVersionHint] = useState('从 tft.patch 笔记自动归类');
  const [versions, setVersions] = useState<VersionRow[]>([]);

  const [autoFromText, setAutoFromText] = useState('tft.composition, tft.patch');
  // 展现形式模板配置:本编辑器不编辑它,但必须回读并原样回写 —— 后端 Save 是整体
  // 覆盖,不带上 templates 会把用户创建时选的展现形式静默抹掉。
  const [templates, setTemplates] = useState<TopicTemplateConfig[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 打开时拉一次,关掉不清(下次打开会重新拉,id 切换不残留)
  useEffect(() => {
    if (!open || !topicId) return;
    setError(null);
    setLoading(true);
    fetchTopicMetadata(topicId)
      .then((res) => {
        const p: TopicInsightsPayload = (res as any)?.payload ?? {};
        if (p.lineups) {
          setLineupTitle(p.lineups.title || '当前版本热门阵容');
          setLineupHint(p.lineups.hint || '');
          setLineups(
            (p.lineups.lineups ?? []).map((l) => ({
              title: l.title,
              subtitle: l.subtitle,
              cover: l.cover,
              vendor: l.vendor,
              sourceUrl: l.sourceUrl,
              updateTime: l.updateTime,
            })),
          );
        } else {
          setLineupTitle('当前版本热门阵容');
          setLineupHint('数据来源:tft.composition 子分类');
          setLineups([]);
        }
        if (p.versionHistory) {
          setVersionTitle(p.versionHistory.title || '历史版本时间线');
          setVersionHint(p.versionHistory.hint || '');
          setVersions(
            (p.versionHistory.versions ?? []).map((v) => ({
              version: v.version,
              releasedAt: v.releasedAt,
              summary: v.summary,
              sourceUrl: v.sourceUrl,
            })),
          );
        } else {
          setVersionTitle('历史版本时间线');
          setVersionHint('从 tft.patch 笔记自动归类');
          setVersions([]);
        }
        setAutoFromText((p.autoFromSources ?? []).join(', '));
        setTemplates(p.templates ?? []);
      })
      .catch((e) => setError(e?.message || '读取专题洞察失败'))
      .finally(() => setLoading(false));
  }, [open, topicId]);

  const handleSave = async () => {
    if (!topicId) return;
    setError(null);
    setSaving(true);
    // 整理 autoFromSources:逗号/空白切分,去空,转小写
    const autoFromSources = autoFromText
      .split(/[,，\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    // 过滤掉没填 title 的行(lineup 必须有标题)
    const cleanLineups = lineups.filter((l) => l.title.trim());
    const cleanVersions = versions.filter((v) => v.version.trim() && v.summary.trim());
    const payload: TopicInsightsPayload = {
      lineups: { title: lineupTitle, hint: lineupHint, lineups: cleanLineups },
      versionHistory: { title: versionTitle, hint: versionHint, versions: cleanVersions },
      autoFromSources,
      // 原样回写展现形式模板,避免整体覆盖把用户创建时选的模板抹掉
      templates,
    };
    try {
      await updateTopicMetadata(topicId, payload);
      onSaved?.();
      onClose();
    } catch (e: any) {
      setError(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        专题洞察 · {topicTitle || `#${topicId}`}
        <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
          独立存储在 topic_metadata 表;不走 UpdateTopicReq 字段流
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {error && (
          <Typography sx={{ mb: 2, fontSize: 12, color: 'error.main' }}>{error}</Typography>
        )}
        {loading && <Typography sx={{ py: 4, textAlign: 'center', fontSize: 12 }}>读取中…</Typography>}

        <Stack spacing={3} sx={{ pt: 1 }}>
          {/* 当前热门阵容 */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>当前热门阵容</Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <TextField size="small" label="板块标题" value={lineupTitle} onChange={(e) => setLineupTitle(e.target.value)} sx={{ flex: 1 }} />
              <TextField size="small" label="副说明" value={lineupHint} onChange={(e) => setLineupHint(e.target.value)} sx={{ flex: 1 }} />
            </Stack>
            <Stack spacing={1.5}>
              {lineups.map((l, i) => (
                <Stack key={i} direction="row" spacing={1} sx={{ p: 1, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.04)' }}>
                  <TextField size="small" label="标题" value={l.title} onChange={(e) => setLineups(lineups.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} sx={{ flex: 1.4 }} />
                  <TextField size="small" label="副标题" value={l.subtitle} onChange={(e) => setLineups(lineups.map((x, j) => (j === i ? { ...x, subtitle: e.target.value } : x)))} sx={{ flex: 1.4 }} />
                  <TextField size="small" label="封面URL" value={l.cover} onChange={(e) => setLineups(lineups.map((x, j) => (j === i ? { ...x, cover: e.target.value } : x)))} sx={{ flex: 1.2 }} />
                  <TextField size="small" label="vendor" value={l.vendor ?? ''} onChange={(e) => setLineups(lineups.map((x, j) => (j === i ? { ...x, vendor: e.target.value } : x)))} sx={{ width: 110 }} />
                  <TextField size="small" label="源链接" value={l.sourceUrl ?? ''} onChange={(e) => setLineups(lineups.map((x, j) => (j === i ? { ...x, sourceUrl: e.target.value } : x)))} sx={{ width: 140 }} />
                  <IconButton size="small" onClick={() => setLineups(lineups.filter((_, j) => j !== i))} aria-label="删除">
                    <DeleteOutlinedIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
              <Button startIcon={<AddIcon />} size="small" sx={{ alignSelf: 'flex-start' }} onClick={() => setLineups([...lineups, emptyLineup()])}>
                加一行
              </Button>
            </Stack>
          </Box>

          <Divider />

          {/* 历史版本时间线 */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>历史版本时间线</Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <TextField size="small" label="板块标题" value={versionTitle} onChange={(e) => setVersionTitle(e.target.value)} sx={{ flex: 1 }} />
              <TextField size="small" label="副说明" value={versionHint} onChange={(e) => setVersionHint(e.target.value)} sx={{ flex: 1 }} />
            </Stack>
            <Stack spacing={1.5}>
              {versions.map((v, i) => (
                <Stack key={i} direction="row" spacing={1} sx={{ p: 1, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.04)' }}>
                  <TextField size="small" label="版本号" value={v.version} onChange={(e) => setVersions(versions.map((x, j) => (j === i ? { ...x, version: e.target.value } : x)))} sx={{ width: 110 }} />
                  <TextField size="small" label="发布日期" type="date" value={v.releasedAt?.slice(0, 10) ?? ''} onChange={(e) => setVersions(versions.map((x, j) => (j === i ? { ...x, releasedAt: e.target.value } : x)))} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 160 }} />
                  <TextField size="small" label="概述" value={v.summary} onChange={(e) => setVersions(versions.map((x, j) => (j === i ? { ...x, summary: e.target.value } : x)))} sx={{ flex: 1.4 }} />
                  <TextField size="small" label="源链接" value={v.sourceUrl ?? ''} onChange={(e) => setVersions(versions.map((x, j) => (j === i ? { ...x, sourceUrl: e.target.value } : x)))} sx={{ width: 140 }} />
                  <IconButton size="small" onClick={() => setVersions(versions.filter((_, j) => j !== i))} aria-label="删除">
                    <DeleteOutlinedIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
              <Button startIcon={<AddIcon />} size="small" sx={{ alignSelf: 'flex-start' }} onClick={() => setVersions([...versions, emptyVersion()])}>
                加一行
              </Button>
            </Stack>
          </Box>

          <Divider />

          {/* 自动来源 */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>自动来源(autoFromSources)</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
              当对应板块(lineups / versionHistory)为空时,服务从这里指定的子分类自动拉数据。
              推荐: tft.composition(阵容)、tft.patch(版本)、tft.trait(羁绊)
            </Typography>
            <TextField size="small" fullWidth value={autoFromText} onChange={(e) => setAutoFromText(e.target.value)} placeholder="tft.composition, tft.patch" />
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
              {autoFromText.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean).map((s) => (
                <Chip key={s} size="small" label={s} variant="outlined" />
              ))}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>取消</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || loading || !topicId}>
          {saving ? '保存中…' : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default TopicInsightsEditorDialog;

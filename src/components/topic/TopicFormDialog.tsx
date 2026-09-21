'use client';

// TopicFormDialog —— 创建/编辑意境(专题)的共享表单对话框。
//
// 抽自 admin 的 system/topic 页的内联 Dialog,供两处复用:
//   - 前台广场(create + 普通用户 + showTemplates):community/TopicHub.tsx
//   - admin 后台(edit/create + staff + 完整 rule 表单):system/topic/page.tsx
//
// 普通用户提交 → 后端置 status=0 进待审池,onSaved 收到 pendingReview=true,
// 由调用方决定怎么提示(前台不跳详情页,因为待审意境详情是 404)。

import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import {
  createTopic,
  updateTopic,
  listTopicGenres,
  parseTopicRule,
  TOPIC_REGIONS,
  TOPIC_VISIBILITY_LABEL,
  type CreateTopicReq,
  type Topic,
  type TopicGenre,
  type TopicKind,
  type TopicRule,
  type TopicTemplateConfig,
  type TopicVisibility,
} from '@/apis/topic';

// 自动收录规则可选的内容类型
const RULE_CONTENT_TYPES: { value: string; label: string }[] = [
  { value: 'FILM', label: '电影' },
  { value: 'TELEPLAY', label: '剧集' },
  { value: 'VIDEO', label: '视频' },
  { value: 'ANIMATION', label: '动画' },
  { value: 'COMICS', label: '漫画' },
  { value: 'VSHOW', label: '综艺' },
  { value: 'NOVEL', label: '小说' },
  { value: 'MUSIC', label: '音乐' },
  { value: 'ARTICLE', label: '文章' },
  { value: 'WALLPAPER', label: '壁纸' },
];

// 展现形式模板选项。aggregateFeed 默认勾选(可被取消);其余默认关。
const TEMPLATE_OPTIONS: { kind: string; label: string; desc: string }[] = [
  { kind: 'aggregateFeed', label: '聚合流', desc: '作品 / 讨论 / 需求 / 实现 / 团队 五个页签(经典形态)' },
  { kind: 'narrativeWorld', label: '叙事世界观', desc: '把版本/章节铺成纵向叙事流,适合剧情向意境' },
  { kind: 'cardArchive', label: '卡片档案集', desc: '把条目铺成密集档案卡,适合设定/收藏向意境' },
];

interface RuleForm {
  contentTypes: string[];
  keywords: string;
  orderBy: 'hot' | 'new';
  genres: string[];
  region: string;
  yearFrom: number;
  yearTo: number;
  minRating: number;
}

const emptyRule: RuleForm = {
  contentTypes: [],
  keywords: '',
  orderBy: 'hot',
  genres: [],
  region: '',
  yearFrom: 0,
  yearTo: 0,
  minRating: 0,
};

const emptyForm: CreateTopicReq = {
  title: '',
  subtitle: '',
  cover: '',
  description: '',
  contentType: '',
  sort: 0,
  kind: 'collection',
  visibility: 'public',
};

export interface TopicFormDialogProps {
  open: boolean;
  onClose: () => void;
  /** 传入即编辑模式,否则新建 */
  topic?: Topic | null;
  /** 当前用户是否平台管理员(控制可见范围/私密字段)。普通用户传 false。 */
  isAdmin: boolean;
  /** 是否展示「展现形式模板」多选。前台创建意境时开启;admin 编辑/创建时不开(走另一条 metadata 流) */
  showTemplates?: boolean;
  /** admin 编辑模式下是否显示自动收录规则(只 staff 用得到) */
  showRule?: boolean;
  onSaved: (result: { id: number; pendingReview: boolean }) => void;
}

export function TopicFormDialog({ open, onClose, topic, isAdmin, showTemplates, showRule, onSaved }: TopicFormDialogProps) {
  const editingTopic = topic ?? null;
  const [formData, setFormData] = useState<CreateTopicReq>(emptyForm);
  const [ruleForm, setRuleForm] = useState<RuleForm>(emptyRule);
  // 展现形式模板多选:默认只勾聚合流。
  const [templates, setTemplates] = useState<string[]>(['aggregateFeed']);
  const [genres, setGenres] = useState<TopicGenre[]>([]);
  const [genresLoading, setGenresLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGenres = (contentType?: string) => {
    setGenresLoading(true);
    listTopicGenres(contentType || undefined)
      .then((list) => setGenres(list || []))
      .catch(() => setGenres([]))
      .finally(() => setGenresLoading(false));
  };

  // 打开/切换编辑对象时初始化。
  useEffect(() => {
    if (!open) return;
    if (editingTopic) {
      setFormData({
        title: editingTopic.title,
        subtitle: editingTopic.subtitle || '',
        cover: editingTopic.cover || '',
        description: editingTopic.description || '',
        contentType: editingTopic.contentType || '',
        sort: editingTopic.sort,
        kind: editingTopic.kind || 'collection',
        visibility: editingTopic.visibility || 'public',
      });
      const r = parseTopicRule(editingTopic.rule);
      setRuleForm({
        contentTypes: r.contentTypes || [],
        keywords: (r.keywords || []).join(','),
        orderBy: r.orderBy === 'new' ? 'new' : 'hot',
        genres: r.genres || [],
        region: r.region || '',
        yearFrom: r.yearFrom || 0,
        yearTo: r.yearTo || 0,
        minRating: r.minRating || 0,
      });
      loadGenres(editingTopic.contentType || undefined);
    } else {
      setFormData(emptyForm);
      setRuleForm(emptyRule);
      loadGenres(undefined);
    }
    setTemplates(['aggregateFeed']);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingTopic?.id]);

  const toggleTemplate = (kind: string) => {
    setTemplates((prev) => (prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]));
  };

  const handleSubmit = async () => {
    if (editingTopic && editingTopic.visibility === 'admin_only' && formData.visibility !== 'admin_only') {
      if (!window.confirm(`把「${formData.title}」改为公开?公开后所有人都能在意境广场看到它。`)) return;
    }
    setSaving(true);
    setError(null);
    const payload: CreateTopicReq = {
      ...formData,
    };
    if (showRule) {
      payload.rule = {
        contentTypes: ruleForm.contentTypes,
        keywords: ruleForm.keywords.split(/[,，\s]+/).map((k) => k.trim()).filter(Boolean),
        orderBy: ruleForm.orderBy,
        genres: ruleForm.genres,
        region: ruleForm.region || undefined,
        yearFrom: ruleForm.yearFrom || undefined,
        yearTo: ruleForm.yearTo || undefined,
        minRating: ruleForm.minRating || undefined,
      } as TopicRule;
    }
    // 展现形式模板:只在新建 + showTemplates 时随创建落到 metadata(编辑走 InsightsEditorDialog)。
    if (!editingTopic && showTemplates) {
      payload.templates = TEMPLATE_OPTIONS.map((t) => ({
        kind: t.kind,
        enabled: templates.includes(t.kind),
      })) as TopicTemplateConfig[];
    }
    try {
      if (editingTopic) {
        await updateTopic(editingTopic.id, payload);
        onSaved({ id: editingTopic.id, pendingReview: false });
      } else {
        const res = await createTopic(payload);
        onSaved({ id: res.id, pendingReview: res.pendingReview });
      }
    } catch (e: any) {
      setError(e?.message || '保存失败,请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{editingTopic ? '编辑专题' : (showTemplates ? '创建意境' : '新建专题')}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {error && <Typography sx={{ fontSize: 12, color: 'error.main' }}>{error}</Typography>}
          <TextField
            label="标题"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            fullWidth
            required
          />
          <TextField
            label="副标题"
            value={formData.subtitle}
            onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
            fullWidth
          />
          <TextField
            label="封面图URL"
            value={formData.cover}
            onChange={(e) => setFormData({ ...formData, cover: e.target.value })}
            fullWidth
          />
          <TextField
            label="详细描述"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            fullWidth
            multiline
            rows={4}
          />
          <TextField
            select
            label="类型"
            value={formData.kind || 'collection'}
            onChange={(e) => {
              const kind = e.target.value as TopicKind;
              setFormData({ ...formData, kind, visibility: kind === 'topic' ? 'public' : formData.visibility || 'public' });
            }}
            fullWidth
            helperText="合集:以作品为主;话题:以讨论为主"
          >
            <MenuItem value="collection">合集</MenuItem>
            <MenuItem value="topic" disabled={formData.visibility === 'admin_only'}>
              话题
            </MenuItem>
          </TextField>

          {showTemplates && !editingTopic && (
            <Box>
              <Typography variant="subtitle2">展现形式(可多选)</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                决定这个意境在详情页以什么形态呈现,可叠加。
              </Typography>
              <FormGroup>
                {TEMPLATE_OPTIONS.map((t) => (
                  <FormControlLabel
                    key={t.kind}
                    control={<Checkbox size="small" checked={templates.includes(t.kind)} onChange={() => toggleTemplate(t.kind)} />}
                    label={
                      <Box>
                        <Typography component="span" sx={{ fontSize: 14 }}>{t.label}</Typography>
                        <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary', ml: 1 }}>{t.desc}</Typography>
                      </Box>
                    }
                  />
                ))}
              </FormGroup>
            </Box>
          )}

          {isAdmin && (
            <TextField
              select
              label="可见范围"
              value={formData.visibility || 'public'}
              onChange={(e) => {
                const visibility = e.target.value as TopicVisibility;
                setFormData({ ...formData, visibility, kind: visibility === 'admin_only' ? 'collection' : formData.kind });
              }}
              fullWidth
              helperText={
                isAdmin
                  ? `私密合集只有平台管理员能看到;前台搜索、联想、作品「收录于」都不会出现它。公开与私密可随时互转(仅管理员)`
                  : `私密:${TOPIC_VISIBILITY_LABEL.admin_only};前台都看不到`
              }
            >
              <MenuItem value="public">公开</MenuItem>
              <MenuItem value="admin_only" disabled={!isAdmin || (formData.kind || 'collection') === 'topic'}>
                仅管理员(私密)
              </MenuItem>
            </TextField>
          )}

          {showRule && (
            <>
              <Typography variant="subtitle2" sx={{ mt: 1 }}>自动收录规则(可选)</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: -1.5 }}>
                手工收录的作品排在前面,满足规则的作品自动补在后面;类型和关键词都不填表示不自动收录。
              </Typography>
              <TextField
                select
                label="内容类型"
                value={ruleForm.contentTypes}
                onChange={(e) => {
                  const v = e.target.value as unknown as string[] | string;
                  setRuleForm({ ...ruleForm, contentTypes: typeof v === 'string' ? v.split(',') : v });
                }}
                slotProps={{ select: { multiple: true } }}
                fullWidth
              >
                {RULE_CONTENT_TYPES.map((t) => (
                  <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                ))}
              </TextField>
              <TextField
                label="标题/标签关键词"
                value={ruleForm.keywords}
                onChange={(e) => setRuleForm({ ...ruleForm, keywords: e.target.value })}
                fullWidth
                placeholder="多个用逗号分隔,如:科幻, 悬疑"
              />
              <TextField
                select
                label="自动收录排序"
                value={ruleForm.orderBy}
                onChange={(e) => setRuleForm({ ...ruleForm, orderBy: e.target.value as 'hot' | 'new' })}
                fullWidth
              >
                <MenuItem value="hot">按热度</MenuItem>
                <MenuItem value="new">按最近更新</MenuItem>
              </TextField>
              <Typography variant="caption" color="text.secondary">
                分面条件(可选)—— 比关键词匹配更精准,不会误伤标题里碰巧带的字
              </Typography>
              <TextField
                select
                label="题材码"
                value={ruleForm.genres}
                onChange={(e) => {
                  const v = e.target.value as unknown as string[] | string;
                  setRuleForm({ ...ruleForm, genres: typeof v === 'string' ? v.split(',') : v });
                }}
                slotProps={{ select: { multiple: true } }}
                fullWidth
                helperText={genresLoading ? '加载中…' : `${genres.length} 项可选`}
                disabled={genresLoading}
              >
                {genres.map((g) => (
                  <MenuItem key={g.code} value={g.code}>{g.label}</MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="地区码"
                value={ruleForm.region}
                onChange={(e) => setRuleForm({ ...ruleForm, region: e.target.value })}
                fullWidth
                helperText="不选 = 不限地区"
              >
                <MenuItem value="">不限</MenuItem>
                {TOPIC_REGIONS.map((r) => (
                  <MenuItem key={r.code} value={r.code}>{r.label}</MenuItem>
                ))}
              </TextField>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField label="起始年份" type="number" value={ruleForm.yearFrom || ''} onChange={(e) => setRuleForm({ ...ruleForm, yearFrom: parseInt(e.target.value) || 0 })} fullWidth helperText="0 = 不限" />
                <TextField label="结束年份" type="number" value={ruleForm.yearTo || ''} onChange={(e) => setRuleForm({ ...ruleForm, yearTo: parseInt(e.target.value) || 0 })} fullWidth helperText="0 = 不限" />
                <TextField label="最低评分" type="number" value={ruleForm.minRating || ''} onChange={(e) => setRuleForm({ ...ruleForm, minRating: parseFloat(e.target.value) || 0 })} fullWidth helperText="0-10,0 = 不限" />
              </Box>
              <TextField label="排序" type="number" value={formData.sort} onChange={(e) => setFormData({ ...formData, sort: parseInt(e.target.value) || 0 })} fullWidth />
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>取消</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!formData.title || saving}>
          {saving ? '提交中…' : editingTopic ? '保存' : '提交'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default TopicFormDialog;

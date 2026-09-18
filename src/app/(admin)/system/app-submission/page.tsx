'use client';

/**
 * 应用提交资料。
 *
 * 上架一次要在六个后台重复填同一批东西(微信开放平台、应用宝、华为、小米、OPPO、vivo),
 * 其中最容易错的两项没有任何提示:「应用签名」要的是签名证书的 MD5,不是 keystore 别名;
 * 包名是 build.gradle.kts 里的 applicationId。填错的表现是授权一直报签名校验失败。
 *
 * 所以这一页不做花哨的东西,只做三件事:把值放在手边、每项写清出处、缺什么一眼看见。
 * 数据在后端 app_submission 表,字段是 JSON —— 各商店要什么会变,改后台不改表。
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import SouthRoundedIcon from '@mui/icons-material/SouthRounded';
import {
  listAppSubmission,
  saveAppSubmission,
  type AppSubmissionChannel,
  type AppSubmissionField,
} from '@/apis/app-submission';

const LIST_KEY = ['app-submission', 'list'];
const COMMON = 'common';

export default function AppSubmissionPage() {
  const qc = useQueryClient();
  const { data: channels = [], isLoading } = useQuery({ queryKey: LIST_KEY, queryFn: listAppSubmission });

  const [active, setActive] = useState<string>(COMMON);
  /** 本地编辑中的值:channel -> key -> value。没动过的渠道不在里面。 */
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [toast, setToast] = useState<{ msg: string; sev: 'success' | 'error' } | null>(null);

  // 后端返回后如果当前选中的渠道不存在(比如表是空的),退回第一个
  useEffect(() => {
    if (channels.length && !channels.some((c) => c.channel === active)) setActive(channels[0].channel);
  }, [channels, active]);

  const current = channels.find((c) => c.channel === active) ?? null;
  const common = channels.find((c) => c.channel === COMMON) ?? null;

  const valueOf = (ch: AppSubmissionChannel, f: AppSubmissionField) =>
    drafts[ch.channel]?.[f.key] ?? f.value ?? '';

  const setValue = (channel: string, key: string, value: string) =>
    setDrafts((d) => ({ ...d, [channel]: { ...(d[channel] || {}), [key]: value } }));

  const dirty = (channel: string) => Object.keys(drafts[channel] || {}).length > 0;

  const save = useMutation({
    mutationFn: async (ch: AppSubmissionChannel) => {
      const fields = ch.fields.map((f) => ({ ...f, value: valueOf(ch, f) }));
      await saveAppSubmission(ch.channel, fields);
    },
    onSuccess: (_d, ch) => {
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[ch.channel];
        return next;
      });
      void qc.invalidateQueries({ queryKey: LIST_KEY });
      setToast({ msg: '已保存', sev: 'success' });
    },
    onError: () => setToast({ msg: '保存失败,请重试', sev: 'error' }),
  });

  const copy = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setToast({ msg: '已复制', sev: 'success' });
    } catch {
      // 没有剪贴板权限(http 或旧 WebView)时不报错,用户还能自己选中复制
      setToast({ msg: '复制失败,请手动选中', sev: 'error' });
    }
  };

  /** 把「通用信息」里同名且非空的值填进当前渠道的空位。不覆盖已经填了的。 */
  const fillFromCommon = () => {
    if (!current || !common) return;
    const src = new Map(common.fields.map((f) => [f.key, valueOf(common, f)]));
    let n = 0;
    const patch: Record<string, string> = {};
    for (const f of current.fields) {
      const mine = valueOf(current, f);
      const from = src.get(f.key);
      if (!mine && from) {
        patch[f.key] = from;
        n += 1;
      }
    }
    if (n === 0) {
      setToast({ msg: '没有可填充的空位', sev: 'success' });
      return;
    }
    setDrafts((d) => ({ ...d, [current.channel]: { ...(d[current.channel] || {}), ...patch } }));
    setToast({ msg: `已从通用信息填入 ${n} 项`, sev: 'success' });
  };

  const missingOf = (ch: AppSubmissionChannel) =>
    ch.fields.filter((f) => f.required && !valueOf(ch, f).trim()).length;

  const missing = useMemo(() => (current ? missingOf(current) : 0), [current, drafts]);

  if (isLoading) {
    return (
      <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography sx={{ fontSize: 18, fontWeight: 700, mb: 0.5 }}>应用提交资料</Typography>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 2.5 }}>
        各应用商店上架表单要填的内容。先把「通用信息」补全,再进每个渠道用「从通用信息填充」补空位。
        各商店的必填项以它们自己的后台为准,这里只是把当前已知的整理好。
      </Typography>

      {/* 渠道切换 */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2.5 }}>
        {channels.map((ch) => {
          const n = missingOf(ch);
          const isActive = ch.channel === active;
          return (
            <Box
              key={ch.channel}
              onClick={() => setActive(ch.channel)}
              sx={{
                px: 1.5,
                py: 0.75,
                borderRadius: 1.5,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                border: '1px solid',
                borderColor: isActive ? 'primary.main' : 'divider',
                bgcolor: isActive ? 'action.selected' : 'transparent',
                transition: 'all .15s',
              }}
            >
              <Typography sx={{ fontSize: 13, fontWeight: isActive ? 600 : 400 }}>{ch.title}</Typography>
              {dirty(ch.channel) && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'warning.main' }} />}
              {n > 0 && <Chip size="small" label={`缺 ${n}`} sx={{ height: 18, fontSize: 10 }} color="warning" />}
            </Box>
          );
        })}
      </Box>

      {current && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: 15, fontWeight: 600, flex: 1, minWidth: 180 }}>{current.title}</Typography>
            {current.channel !== COMMON && (
              <Button size="small" variant="text" startIcon={<SouthRoundedIcon sx={{ fontSize: 16 }} />} onClick={fillFromCommon}>
                从通用信息填充
              </Button>
            )}
            <Button
              size="small"
              disabled={!dirty(current.channel) || save.isPending}
              onClick={() => save.mutate(current)}
            >
              {save.isPending ? '保存中…' : '保存'}
            </Button>
          </Box>

          {current.note && (
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 2, lineHeight: 1.7 }}>{current.note}</Typography>
          )}
          {missing > 0 && (
            <Alert severity="warning" sx={{ mb: 2, fontSize: 12 }}>
              还有 {missing} 项必填没有填:{current.fields.filter((f) => f.required && !valueOf(current, f).trim()).map((f) => f.label).join('、')}
            </Alert>
          )}

          <Box sx={{ display: 'grid', gap: 2 }}>
            {current.fields.map((f) => {
              const v = valueOf(current, f);
              return (
                <Box key={f.key}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    <TextField
                      fullWidth
                      size="small"
                      label={f.required ? `${f.label} *` : f.label}
                      value={v}
                      multiline={f.multiline}
                      minRows={f.multiline ? 3 : undefined}
                      onChange={(e) => setValue(current.channel, f.key, e.target.value)}
                    />
                    <Tooltip title="复制">
                      <span>
                        <IconButton size="small" disabled={!v} onClick={() => copy(v)} sx={{ mt: 0.5 }}>
                          <ContentCopyRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                  {f.hint && (
                    <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5, ml: 0.5, lineHeight: 1.6 }}>
                      {f.hint}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      <Snackbar
        open={!!toast}
        autoHideDuration={2000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast?.sev ?? 'success'} onClose={() => setToast(null)} sx={{ fontSize: 13 }}>
          {toast?.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

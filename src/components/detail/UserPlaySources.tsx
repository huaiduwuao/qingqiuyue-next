'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import RadioGroup from '@mui/material/RadioGroup';
import Radio from '@mui/material/Radio';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AddLinkIcon from '@mui/icons-material/AddLinkRounded';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import { formatApiError } from '@/lib/api/client';
import { addPlaySource, listPlaySources, removePlaySource, reportPlaySource, type PlaySource } from '@/apis/play-source';

/**
 * 网友补充的观看入口:列表 + 「补充入口」+ 举报 / 撤回。
 *
 * 和抓取得来的平台入口(ExternalPlatforms 的 PlatformLinks)分开放、分开署名 —— 那些是本站
 * 收录时核对过的,这些是用户贴的、没有人工预审,得让人一眼分得清,也得人人都能举报。
 */
export default function UserPlaySources({ contentId }: { contentId: string }) {
  const qc = useQueryClient();
  const key = ['play-sources', contentId];
  const { data } = useQuery({ queryKey: key, queryFn: () => listPlaySources(contentId), enabled: !!contentId, staleTime: 60_000 });
  const sources = data?.list ?? [];

  const [adding, setAdding] = useState(false);
  const [reporting, setReporting] = useState<PlaySource | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const done = (msg: string) => {
    setToast({ msg, ok: true });
    qc.invalidateQueries({ queryKey: key });
  };
  const failed = (e: unknown) => setToast({ msg: formatApiError(e) || '操作失败,请稍后再试', ok: false });

  const remove = useMutation({ mutationFn: (id: number) => removePlaySource(id), onSuccess: () => done('已撤回'), onError: failed });

  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
          {sources.length > 0 ? '网友补充的观看入口' : '知道哪里能看?'}
        </Typography>
        <Button
          size="small"
          variant="text"
          startIcon={<AddLinkIcon sx={{ fontSize: 16 }} />}
          onClick={() => setAdding(true)}
          sx={{ textTransform: 'none', fontSize: 12, minWidth: 0, py: 0 }}
        >
          补充入口
        </Button>
      </Box>

      {sources.length > 0 && (
        <>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {sources.map((s) => (
              <Box key={s.id} sx={{ display: 'inline-flex', alignItems: 'center', border: 1, borderColor: 'divider', borderRadius: 2, pr: 0.25, maxWidth: '100%' }}>
                <Button
                  size="small"
                  variant="text"
                  href={s.url}
                  target="_blank"
                  // ugc:告诉搜索引擎这是用户贴的链接,本站不为它背书。
                  rel="noopener noreferrer nofollow ugc"
                  endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                  title={s.note || s.url}
                  sx={{ textTransform: 'none', borderRadius: 2, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {s.platform}
                  {s.episode ? ` · ${s.episode}` : ''}
                  {s.vip && (
                    <Box component="span" sx={{ ml: 0.75, px: 0.5, borderRadius: 0.5, fontSize: 10, lineHeight: '16px', bgcolor: 'warning.main', color: '#000' }}>
                      会员/付费
                    </Box>
                  )}
                </Button>
                {s.mine ? (
                  <Tooltip title="撤回我补充的这条">
                    <IconButton size="small" aria-label="撤回" disabled={remove.isPending} onClick={() => remove.mutate(s.id)}>
                      <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <Tooltip title="举报这条入口">
                    <IconButton size="small" aria-label="举报" onClick={() => setReporting(s)}>
                      <FlagOutlinedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            ))}
          </Box>
          <Typography sx={{ fontSize: 11, color: 'text.disabled', mt: 0.75, lineHeight: 1.6 }}>
            以上入口由网友提供,指向第三方平台,本站未逐条核实,也不存储或传输其内容。链接失效、与作品不符或涉及侵权,请点旁边的小旗举报,权利人投诉会先行下线再核实。
          </Typography>
        </>
      )}

      {adding && (
        <AddDialog
          contentId={contentId}
          platforms={data?.platforms ?? []}
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            done('已补充,感谢分享');
          }}
        />
      )}
      {reporting && (
        <ReportDialog
          source={reporting}
          onClose={() => setReporting(null)}
          onDone={() => {
            setReporting(null);
            done('举报已提交,我们会尽快处理');
          }}
          onError={failed}
        />
      )}

      <Snackbar open={!!toast} autoHideDuration={3500} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={toast?.ok ? 'success' : 'error'} variant="filled" onClose={() => setToast(null)}>
          {toast?.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function AddDialog({ contentId, platforms, onClose, onDone }: { contentId: string; platforms: string[]; onClose: () => void; onDone: () => void }) {
  const [url, setUrl] = useState('');
  const [episode, setEpisode] = useState('');
  const [vip, setVip] = useState(false);
  // 出错信息留在框里:用户多半要照着改链接再试一次。
  const [error, setError] = useState('');
  const add = useMutation({
    mutationFn: () => addPlaySource({ contentId, url: url.trim(), episode: episode.trim(), vip }),
    onSuccess: onDone,
    onError: (e) => setError(formatApiError(e) || '提交失败,请稍后再试'),
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontSize: 16 }}>补充观看入口</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '8px !important', overflowX: 'hidden' }}>
        <TextField
          autoFocus
          fullWidth
          size="small"
          label="播放页链接"
          placeholder="https://"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError('');
          }}
          error={!!error}
          helperText={error || (platforms.length ? `支持:${platforms.slice(0, 8).join('、')} 等正规平台` : '请贴正规平台上这部作品的播放页')}
        />
        <TextField fullWidth size="small" label="哪一集 / 哪个版本(可不填)" placeholder="如:第 3 集、国语版" value={episode} onChange={(e) => setEpisode(e.target.value)} slotProps={{ htmlInput: { maxLength: 40 } }} />
        <FormControlLabel control={<Checkbox size="small" checked={vip} onChange={(e) => setVip(e.target.checked)} />} label={<Typography sx={{ fontSize: 13 }}>需要会员或付费</Typography>} />
        <Typography sx={{ fontSize: 11, color: 'text.disabled', lineHeight: 1.6 }}>
          提交后立即展示,并记在你的账号名下。请只贴正规平台的播放页;盗版资源、网盘、广告链接会被移除。
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose} sx={{ textTransform: 'none' }}>
          取消
        </Button>
        <Button variant="contained" disabled={!url.trim() || add.isPending} onClick={() => add.mutate()} sx={{ textTransform: 'none' }}>
          提交
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const REPORT_REASONS = ['链接已失效', '和这部作品对不上', '广告 / 诱导下载', '盗版资源'];

function ReportDialog({ source, onClose, onDone, onError }: { source: PlaySource; onClose: () => void; onDone: () => void; onError: (e: unknown) => void }) {
  const [choice, setChoice] = useState(REPORT_REASONS[0]);
  const [detail, setDetail] = useState('');
  const copyright = choice === 'copyright';
  const report = useMutation({
    mutationFn: () =>
      reportPlaySource(source.id, copyright ? { kind: 'copyright', reason: detail.trim() } : { reason: [choice, detail.trim()].filter(Boolean).join(':') }),
    onSuccess: onDone,
    onError,
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontSize: 16 }}>举报「{source.platform}」入口</DialogTitle>
      <DialogContent sx={{ pt: '4px !important', overflowX: 'hidden' }}>
        <RadioGroup value={choice} onChange={(e) => setChoice(e.target.value)}>
          {REPORT_REASONS.map((r) => (
            <FormControlLabel key={r} value={r} control={<Radio size="small" />} label={<Typography sx={{ fontSize: 13 }}>{r}</Typography>} />
          ))}
          <FormControlLabel value="copyright" control={<Radio size="small" />} label={<Typography sx={{ fontSize: 13 }}>我是权利人,这条链接侵犯了我的权利</Typography>} />
        </RadioGroup>
        <TextField
          size="small"
          fullWidth
          multiline
          minRows={2}
          sx={{ mt: 1 }}
          label={copyright ? '权利说明与联系方式' : '补充说明(可不填)'}
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          slotProps={{ htmlInput: { maxLength: 300 } }}
          helperText={copyright ? '提交后这条链接会先行下线,平台核实后给你答复。' : ' '}
        />
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose} sx={{ textTransform: 'none' }}>
          取消
        </Button>
        <Button variant="contained" disabled={report.isPending || (copyright && !detail.trim())} onClick={() => report.mutate()} sx={{ textTransform: 'none' }}>
          提交举报
        </Button>
      </DialogActions>
    </Dialog>
  );
}

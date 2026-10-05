'use client';

/**
 * 当前会话的存档条(放在 /digital-human 左侧会话列表底部)。
 *
 * 「存档」= 在当前最新一条消息处打书签;「回到」= 后端从那条消息处分叉出一条新会话
 * (原会话和它后面的消息都不动),然后切过去继续聊。
 */
import React from 'react';
import { Box, Button, IconButton, Typography } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import {
  createCheckpoint,
  deleteCheckpoint,
  isServerConversationId,
  listCheckpoints,
  restoreCheckpoint,
  type RawCheckpoint,
} from './conversationApi';

export function ConversationCheckpoints({
  conversationId,
  onRestored,
}: {
  conversationId: string | null;
  /** 回到存档后的新会话 id */
  onRestored: (cid: string) => void;
}) {
  // 列表和错误都记着属于哪条会话:切会话后旧数据自然失效,不用在 effect 里同步清空
  const [loaded, setLoaded] = React.useState<{ cid: string; items: RawCheckpoint[] } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [failure, setFailure] = React.useState<{ cid: string; msg: string } | null>(null);
  const [tick, setTick] = React.useState(0);
  const serverId = isServerConversationId(conversationId) ? conversationId : null;
  const reload = () => setTick((t) => t + 1);

  React.useEffect(() => {
    if (!serverId) return;
    let cancelled = false;
    listCheckpoints(serverId)
      .then((r) => { if (!cancelled) setLoaded({ cid: serverId, items: r.checkpoints ?? [] }); })
      .catch(() => { if (!cancelled) setLoaded({ cid: serverId, items: [] }); });
    return () => { cancelled = true; };
  }, [serverId, tick]);

  if (!serverId) return null;
  const list = loaded?.cid === serverId ? loaded.items : [];
  const error = failure?.cid === serverId ? failure.msg : null;
  const setError = (msg: string | null) => setFailure(msg ? { cid: serverId, msg } : null);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const save = () => run(async () => {
    await createCheckpoint(serverId);
    reload();
  });

  const restore = (cp: RawCheckpoint) => run(async () => {
    if (!confirm(`回到「${cp.name}」?会从第 ${cp.messageSeq} 条消息处开一条新会话继续,原会话保留不动。`)) return;
    const r = await restoreCheckpoint(serverId, cp.id);
    onRestored(String(r.conversation.id));
  });

  const remove = (cp: RawCheckpoint) => run(async () => {
    if (!confirm(`删除存档「${cp.name}」?只删书签,不删消息。`)) return;
    await deleteCheckpoint(serverId, cp.id);
    reload();
  });

  return (
    <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 1, flexShrink: 0, maxHeight: 180, overflowY: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>当前会话存档</Typography>
        <Button size="small" disabled={busy} onClick={save} sx={{ fontSize: 11, color: '#25F4EE', textTransform: 'none', minWidth: 0, py: 0 }}>
          存档
        </Button>
      </Box>
      {error && (
        <Typography role="alert" sx={{ fontSize: 10, color: '#ff8a80', mb: 0.5 }}>{error}</Typography>
      )}
      {list.length === 0 ? (
        <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
          还没有存档。聊到满意的地方点「存档」,之后可以从那里重新开始。
        </Typography>
      ) : (
        list.map((cp) => (
          <Box key={cp.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.25 }}>
            <Box sx={{ flex: 1, minWidth: 0 }} title={cp.preview || ''}>
              <Typography sx={{ fontSize: 11, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cp.name}
              </Typography>
              <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>
                第 {cp.messageSeq} 条 · 共 {cp.messageCount} 条消息
              </Typography>
            </Box>
            <Button size="small" disabled={busy} onClick={() => restore(cp)} sx={{ fontSize: 10, color: '#25F4EE', textTransform: 'none', minWidth: 0, px: 0.75, py: 0 }}>
              回到存档
            </Button>
            <IconButton size="small" aria-label="删除存档" disabled={busy} onClick={() => remove(cp)} sx={{ color: 'rgba(255,255,255,0.4)', p: 0.25 }}>
              <CloseRoundedIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        ))
      )}
    </Box>
  );
}

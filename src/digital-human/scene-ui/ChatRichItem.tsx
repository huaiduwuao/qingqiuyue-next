'use client';

/**
 * 对话流里「不是文字气泡」的那些条目:作品卡片带、快捷选项。
 * 全屏页和悬浮窗共用,两边的聊天区都是深色底。
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ChatLogItem } from '../useChatAvatar';
import ContentCards, { Pill } from './ContentCards';

export function isRichItem(m: ChatLogItem): boolean {
  return (m.who === 'cards' && !!m.contents?.length) || (m.who === 'choices' && !!m.choices);
}

export default function ChatRichItem({
  item,
  active,
  onSend,
  onOpen,
}: {
  item: ChatLogItem;
  /** 只有最新的一组快捷选项还能点:旧的留着当记录,点了会把过期的话再发一遍 */
  active: boolean;
  onSend: (text: string) => void;
  onOpen: (href: string) => void;
}) {
  if (item.who === 'cards' && item.contents?.length) {
    return <ContentCards variant="chat" items={item.contents} label={item.label} onSend={onSend} onOpen={onOpen} />;
  }
  if (item.who === 'choices' && item.choices) {
    const { prompt, options } = item.choices;
    return (
      <Box sx={{ alignSelf: 'flex-start', maxWidth: '100%' }}>
        {prompt && <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', mb: 0.5 }}>{prompt}</Typography>}
        <Box role="group" aria-label={prompt || '快捷选项'} sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', opacity: active ? 1 : 0.45 }}>
          {options.map((o) => (
            <Pill key={o.label} disabled={!active} onClick={() => onSend(o.send)}>
              {o.label}
            </Pill>
          ))}
        </Box>
      </Box>
    );
  }
  return null;
}

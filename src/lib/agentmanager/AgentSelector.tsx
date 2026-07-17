'use client';

/**
 * AgentSelector — 多角色会话中的角色切换器
 *
 * 显示当前活跃角色和角色栈,支持:
 *   - 切换到其他 agent
 *   - 临时委派 (push)
 *   - 返回上一个角色 (pop)
 */

import React from 'react';
import {
  Box,
  Chip,
  Menu,
  MenuItem,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import type { HermesAgentItem } from '@/beans/system';

export interface AgentSelectorProps {
  /** 当前会话 ID */
  conversationId?: string;
  /** 当前活跃 agent ID */
  activeAgentId: string | null;
  /** 角色栈 (栈顶 = 当前活跃) */
  agentStack: string[];
  /** 可选 agent 列表 */
  availableAgents: HermesAgentItem[];
  /** 切换角色回调 */
  onSwitch: (agentId: string) => void;
  /** 返回上一个角色回调 */
  onReturn?: () => void;
  /** 尺寸 */
  size?: 'small' | 'medium';
}

export function AgentSelector({
  activeAgentId,
  agentStack,
  availableAgents,
  onSwitch,
  onReturn,
  size = 'medium',
}: AgentSelectorProps) {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const activeAgent = availableAgents.find((a) => a.agentId === activeAgentId);
  const canReturn = agentStack.length > 1;

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = (agentId: string) => {
    onSwitch(agentId);
    handleClose();
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      {canReturn && onReturn && (
        <Tooltip title="返回上一个角色">
          <IconButton size={size} onClick={onReturn}>
            <ArrowBackIcon fontSize={size} />
          </IconButton>
        </Tooltip>
      )}

      <Chip
        label={activeAgent?.name || activeAgentId || '未选择角色'}
        color="primary"
        size={size}
        onClick={handleOpen}
        onDelete={availableAgents.length > 1 ? handleOpen : undefined}
        deleteIcon={<SwapHorizIcon />}
        sx={{ cursor: 'pointer' }}
      />

      {agentStack.length > 1 && (
        <Typography variant="caption" color="text.secondary">
          栈: {agentStack.map((id) => availableAgents.find((a) => a.agentId === id)?.name || id).join(' → ')}
        </Typography>
      )}

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        {availableAgents
          .filter((a) => a.agentId !== activeAgentId)
          .map((a) => (
            <MenuItem
              key={a.agentId}
              onClick={() => handleSelect(a.agentId)}
              selected={a.agentId === activeAgentId}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.name}</Typography>
                {a.role && (
                  <Typography variant="caption" color="text.secondary">{a.role}</Typography>
                )}
              </Box>
            </MenuItem>
          ))}
      </Menu>
    </Box>
  );
}

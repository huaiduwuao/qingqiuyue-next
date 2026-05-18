'use client';

import React from 'react';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import NotificationsIcon from '@mui/icons-material/Notifications';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Typography from '@mui/material/Typography';

export default function NoticeIconView() {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const notifications: { id: string; title: string; description: string }[] = [];

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <IconButton onClick={handleOpen}>
        <Badge badgeContent={notifications.length} color="secondary">
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
        <Typography sx={{ p: 2 }}>通知</Typography>
        {notifications.length === 0 ? (
          <MenuItem>暂无通知</MenuItem>
        ) : (
          notifications.map((item) => (
            <MenuItem key={item.id} onClick={handleClose}>
              <List>
                <ListItem>
                  <Typography variant="body2">{item.title}</Typography>
                </ListItem>
              </List>
            </MenuItem>
          ))
        )}
      </Menu>
    </>
  );
}

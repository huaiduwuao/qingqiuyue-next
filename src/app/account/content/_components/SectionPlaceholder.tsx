'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Snackbar from '@mui/material/Snackbar';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import { adminClient } from '@/lib/api/client';

interface Props {
  title: string;
  description: string;
  features: string[];
  cta?: string;
}

export default function SectionPlaceholder({ title, description, features, cta = '申请内测' }: Props) {
  const [applyOpen, setApplyOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  const handleApplyOpen = () => setApplyOpen(true);
  const handleApplyClose = () => {
    setApplyOpen(false);
    setName('');
    setReason('');
  };

  const handleApplySubmit = async () => {
    if (!name.trim() || !reason.trim()) {
      setSnack('请填写完整信息');
      return;
    }
    setLoading(true);
    try {
      await adminClient('/beta/apply', { method: 'POST', data: { name: name.trim(), reason: reason.trim() } });
      setSnack('申请已提交');
      handleApplyClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '申请提交失败';
      setSnack(message);
    } finally {
      setLoading(false);
    }
  };

  const handleTutorialOpen = () => setTutorialOpen(true);
  const handleTutorialClose = () => setTutorialOpen(false);

  return (
    <>
      <Box
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 2,
          p: { xs: 3, md: 5 },
          border: '1px solid',
          borderColor: 'divider',
          position: 'relative',
          overflow: 'hidden',
          minHeight: 480,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        {/* Decorative gradient */}
        <Box
          sx={{
            position: 'absolute',
            top: -120,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 480,
            height: 240,
            background: 'radial-gradient(ellipse, rgba(254, 44, 85, 0.18) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: -80,
            right: -80,
            width: 240,
            height: 240,
            background: 'radial-gradient(circle, rgba(37, 244, 238, 0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <Box
          sx={{
            width: 96,
            height: 96,
            borderRadius: 3,
            background: 'linear-gradient(135deg, #FE2C55 0%, #25F4EE 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 3,
            position: 'relative',
          }}
        >
          <RocketLaunchIcon sx={{ fontSize: 48, color: 'text.primary' }} />
        </Box>

        <Typography sx={{ fontSize: { xs: 22, md: 28 }, fontWeight: 700, color: 'text.primary', mb: 1 }}>
          {title}
        </Typography>
        <Typography sx={{ fontSize: 14, color: 'text.secondary', maxWidth: 480, mb: 4, lineHeight: 1.6 }}>
          {description}
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
            gap: 1.5,
            mb: 4,
            maxWidth: 600,
            width: '100%',
          }}
        >
          {features.map((f, i) => (
            <Box
              key={i}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: (theme) => (theme.palette.mode === 'dark' ? '#1E2030' : '#FFFFFF'),
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  bgcolor: 'rgba(254, 44, 85, 0.15)',
                  color: 'primary.main',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </Box>
              <Typography sx={{ fontSize: 12, color: 'text.tertiary', textAlign: 'left' }}>{f}</Typography>
            </Box>
          ))}
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button
            variant="contained"
            startIcon={<RocketLaunchIcon />}
            onClick={handleApplyOpen}
            sx={{
              bgcolor: 'primary.main',
              color: 'text.primary',
              fontWeight: 600,
              px: 3,
              '&:hover': { bgcolor: 'primary.dark', transform: 'translateY(-1px)' },
            }}
          >
            {cta}
          </Button>
          <Button
            variant="outlined"
            onClick={handleTutorialOpen}
            sx={{
              borderColor: 'divider',
              color: 'text.tertiary',
              px: 3,
              '&:hover': { borderColor: 'secondary.main', color: 'secondary.main' },
            }}
          >
            查看教程
          </Button>
        </Box>
      </Box>

      <Dialog open={applyOpen} onClose={handleApplyClose} maxWidth="sm" fullWidth>
        <DialogTitle>申请内测</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="姓名/账号名"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="申请理由"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              fullWidth
              multiline
              minRows={3}
              required
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleApplyClose}>取消</Button>
          <Button variant="contained" onClick={handleApplySubmit} disabled={loading}>
            提交
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={tutorialOpen} onClose={handleTutorialClose} maxWidth="sm" fullWidth>
        <DialogTitle>使用教程</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, color: 'text.secondary', lineHeight: 1.7 }}>
            1. 点击「申请内测」填写信息并提交审核。<br />
            2. 审核通过后即可在创作者中心使用该功能。<br />
            3. 遇到问题请联系平台运营或查看帮助中心。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleTutorialClose} variant="contained">知道了</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snack}
        autoHideDuration={3000}
        onClose={() => setSnack(null)}
        message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
}

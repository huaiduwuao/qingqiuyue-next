'use client';

import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

interface PayModalProps {
  open: boolean;
  onClose: () => void;
  amount?: number;
  onPay?: () => void;
}

export default function PayModal({ open, onClose, amount = 0, onPay }: PayModalProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>支付</DialogTitle>
      <DialogContent>
        <Typography variant="h4" sx={{ textAlign: 'center', my: 2 }}>
          ¥{amount}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" onClick={onPay}>
          支付
        </Button>
      </DialogActions>
    </Dialog>
  );
}

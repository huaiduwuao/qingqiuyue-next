'use client';

import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Snackbar from '@mui/material/Snackbar';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import { demandDetail } from '@/apis/reward-demand';
import { createRealization } from '@/apis/reward-realization';
import { useApp } from '@/contexts/AppContext';
import { REWARD_STATUS_ENUM } from '@/enums/common';

interface DemandDetailProps {
  item: any;
  type?: any;
}

export default function DemandDetail({ item, type }: DemandDetailProps) {
  const { currentUser } = useApp();
  const [detail, setDetail] = useState<any>({});
  const [snack, setSnack] = useState<string | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitTitle, setSubmitTitle] = useState('');
  const [submitContent, setSubmitContent] = useState('');
  const [submitBusy, setSubmitBusy] = useState(false);
  const [selectedRealization, setSelectedRealization] = useState<any>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await demandDetail({ id: item.id });
        setDetail(res.data || {});
      } catch (err) {
        console.error('Failed to fetch demand detail:', err);
      }
    };
    if (item.id) {
      fetchDetail();
    }
  }, [item.id]);

  const goRealizationOperation = () => {
    if (!currentUser?.id) {
      setSnack('请先登录');
      return;
    }
    setSubmitTitle('');
    setSubmitContent('');
    setSubmitOpen(true);
  };

  const handleSubmitRealization = async () => {
    if (!submitTitle.trim() || !submitContent.trim() || !detail.id) {
      setSnack('请填写方案标题与说明');
      return;
    }
    setSubmitBusy(true);
    try {
      await createRealization({
        demandId: detail.id,
        title: submitTitle.trim(),
        content: submitContent.trim(),
      });
      setSubmitOpen(false);
      setSnack('方案提交成功');
      const res = await demandDetail({ id: item.id });
      setDetail(res.data || {});
    } catch (err) {
      setSnack('方案提交失败,请重试');
    } finally {
      setSubmitBusy(false);
    }
  };

  const renderSubmitButton = () => {
    if (!currentUser?.id) {
      return (
        <Button variant="contained" disabled sx={{ width: 150, my: 2 }}>
          登录后提交实现方案
        </Button>
      );
    }

    if (detail.createUser === currentUser.id) {
      return null;
    }

    if (detail.myRealizations?.length > 0) {
      return (
        <Button variant="contained" disabled sx={{ width: 150, my: 2 }}>
          已提交实现方案
        </Button>
      );
    }

    return (
      <Button variant="contained" color="primary" onClick={goRealizationOperation} sx={{ width: 150, my: 2 }}>
        提交实现方案
      </Button>
    );
  };

  return (
    <Card sx={{ m: 0, p: 0, border: 'none', minHeight: 500 }}>
      {/* Detail Top */}
      <Box
        sx={{
          p: 2.5,
          borderBottom: '1px solid #f5f5f5',
          position: 'relative',
          fontSize: 20,
          fontWeight: 700,
          color: '#000',
        }}
      >
        <Typography variant="h5" component="div" sx={{ fontWeight: 700 }}>
          {detail.title}
        </Typography>
        <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Typography
            component="span"
            sx={{
              display: 'inline-block',
              px: 1.25,
              height: 26,
              lineHeight: '26px',
              textAlign: 'center',
              fontSize: 13,
              bgcolor: '#fff2e6',
              color: '#fa8c16',
              borderRadius: 1,
            }}
          >
            赏金: {detail.pay}积分
          </Typography>
          <Typography
            component="span"
            sx={{
              display: 'inline-block',
              px: 1.25,
              height: 26,
              lineHeight: '26px',
              textAlign: 'center',
              fontSize: 13,
              bgcolor: '#e6f7ff',
              color: '#1890ff',
              borderRadius: 1,
            }}
          >
            {REWARD_STATUS_ENUM[detail.status] || detail.status}
          </Typography>
          {detail.tags?.map((tag: string) => (
            <Typography
              key={tag}
              component="span"
              sx={{
                display: 'inline-block',
                px: 1.25,
                height: 26,
                lineHeight: '26px',
                textAlign: 'center',
                fontSize: 13,
                bgcolor: '#f0f0f0',
                color: '#666',
                borderRadius: 1,
              }}
            >
              {tag}
            </Typography>
          ))}
        </Box>

        {/* Submit Button */}
        {detail.createUser !== currentUser?.id && (
          <Box sx={{ position: 'absolute', bottom: 20, right: 15 }}>
            {renderSubmitButton()}
          </Box>
        )}
      </Box>

      {/* Detail Main */}
      <Box sx={{ p: 2.5, fontSize: 14, lineHeight: 1.5, color: '#48576a' }}>
        <Typography
          component="div"
          sx={{
            fontWeight: 700,
            fontSize: 16,
            color: '#151519',
            pl: 1.25,
            borderLeft: '5px solid #1890ff',
            mb: 1,
          }}
        >
          需求描述:
        </Typography>
        <Box
          sx={{ minHeight: 100, fontSize: 14, color: '#666', lineHeight: '22px', py: 2.5 }}
          dangerouslySetInnerHTML={{ __html: detail.content?.content || '' }}
        />

        <Typography
          component="div"
          sx={{
            fontWeight: 700,
            fontSize: 16,
            color: '#151519',
            pl: 1.25,
            borderLeft: '5px solid #1890ff',
            mb: 1,
          }}
        >
          附件:
        </Typography>
        {detail.content?.exts?.map((ele: any, index: number) => (
          <Box key={index} sx={{ mb: 0.5 }}>
            <a target="_blank" href={ele.url} rel="noopener noreferrer">
              {ele.name}
            </a>
          </Box>
        ))}
      </Box>

      {/* Realizations List */}
      {detail.realizations && detail.realizations.length > 0 && (
        <Box>
          <Divider sx={{ my: 2 }}>实现列表</Divider>
          <List>
            {detail.realizations.map((realization: any) => (
              <ListItem
                key={realization.id}
                onClick={() => setSelectedRealization(realization)}
                sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
              >
                <ListItemText
                  primary={realization.title}
                  secondary={`状态: ${REWARD_STATUS_ENUM[realization.status] || realization.status}`}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* My Realizations */}
      {detail.myRealizations?.length > 0 && (
        <Box>
          <Divider sx={{ my: 2 }}>我的方案</Divider>
          <List>
            {detail.myRealizations.map((realization: any) => (
              <ListItem
                key={realization.id}
                onClick={() => setSelectedRealization(realization)}
                sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
              >
                <ListItemText
                  primary={realization.title}
                  secondary={`状态: ${REWARD_STATUS_ENUM[realization.status] || realization.status}`}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      <Dialog open={submitOpen} onClose={() => setSubmitOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>提交实现方案</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              fullWidth
              label="方案标题"
              value={submitTitle}
              onChange={(e) => setSubmitTitle(e.target.value)}
              sx={{ '& .MuiInputLabel-root': { fontSize: 13 } }}
            />
            <TextField
              fullWidth
              multiline
              minRows={4}
              label="方案说明"
              value={submitContent}
              onChange={(e) => setSubmitContent(e.target.value)}
              sx={{ '& .MuiInputLabel-root': { fontSize: 13 } }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button variant="outlined" onClick={() => setSubmitOpen(false)} sx={{ textTransform: 'none', borderRadius: 1.5 }}>取消</Button>
          <Button
            variant="contained"
            disabled={submitBusy || !submitTitle.trim() || !submitContent.trim()}
            onClick={handleSubmitRealization}
            sx={{ textTransform: 'none', borderRadius: 1.5 }}
          >
            {submitBusy ? '提交中…' : '提交方案'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!selectedRealization} onClose={() => setSelectedRealization(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>方案详情</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, fontWeight: 600, mb: 1 }}>{selectedRealization?.title}</Typography>
          <Typography sx={{ fontSize: 13, color: '#666', lineHeight: 1.6, mb: 1 }}>{selectedRealization?.content || '暂无详细说明'}</Typography>
          <Typography sx={{ fontSize: 12, color: '#999' }}>状态: {REWARD_STATUS_ENUM[selectedRealization?.status] || selectedRealization?.status}</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSelectedRealization(null)} sx={{ textTransform: 'none' }}>关闭</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snack}
        autoHideDuration={2200}
        onClose={() => setSnack(null)}
        message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Card>
  );
}
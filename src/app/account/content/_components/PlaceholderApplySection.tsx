'use client';

import { ReactNode, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { accountClient } from '@/lib/api/client';
import { AsyncState } from '@/components/common/AsyncState';

type AppStatus = { applied: boolean; reviewedAt: string | null; message: string };

export function PlaceholderApplySection({
  slug,
  title,
  description,
  features,
  cta,
  children,
}: {
  slug: 'original' | 'cocreate' | 'collection' | 'hd-publish';
  title: string;
  description: string;
  features: string[];
  cta?: string;
  children?: ReactNode;
}) {
  const qc = useQueryClient();
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false,
    msg: '',
    severity: 'success',
  });

  const query = useQuery({
    queryKey: ['account', slug, 'status'],
    queryFn: () => accountClient.get<AppStatus>(`/${slug}/status`).then((r) => r.data),
  });

  const apply = useMutation({
    mutationFn: () => accountClient.post<AppStatus>(`/${slug}/apply`, {}).then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['account', slug, 'status'] });
      setSnack({ open: true, msg: data.message || '申请已提交', severity: 'success' });
    },
    onError: () => {
      setSnack({ open: true, msg: '申请失败,请重试', severity: 'error' });
    },
  });

  return (
    <Box>
      <AsyncState query={query} skeletonCount={1} skeletonHeight={480}>
        {(data) => (
          <Box>
            <Box
              sx={{
                bgcolor: 'background.paper',
                borderRadius: 2,
                p: { xs: 3, md: 5 },
                border: '1px solid',
                borderColor: 'divider',
                position: 'relative',
                overflow: 'hidden',
                minHeight: 320,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
              }}
            >
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

              <Button
                variant="contained"
                disabled={data.applied || apply.isPending}
                onClick={() => apply.mutate()}
                sx={{
                  bgcolor: data.applied ? 'divider' : 'primary.main',
                  color: 'text.primary',
                  fontWeight: 600,
                  px: 4,
                  textTransform: 'none',
                  '&:hover': { bgcolor: data.applied ? 'divider' : 'primary.dark' },
                  '&.Mui-disabled': { bgcolor: 'divider', color: 'text.secondary' },
                }}
              >
                {data.applied ? '已申请 · 审核中' : apply.isPending ? '提交中...' : cta || '申请内测'}
              </Button>
            </Box>

            {data.message && (
              <Box sx={{ mt: 2, p: 2, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid #252836' }}>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>备注</Typography>
                <Typography sx={{ fontSize: 13, color: 'text.tertiary', mt: 0.5 }}>{data.message}</Typography>
              </Box>
            )}

            {children}
          </Box>
        )}
      </AsyncState>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          sx={{ borderRadius: 2 }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

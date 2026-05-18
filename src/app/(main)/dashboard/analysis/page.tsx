'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';

export default function DashboardAnalysisPage() {
  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ mb: 3 }}>分析</Typography>
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          <Box sx={{ flex: '1 1 45%', minWidth: 300 }}>
            <Card>
              <CardContent>
                <Typography variant="h6">数据</Typography>
                <Typography color="text.secondary">分析数据</Typography>
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Box>
    </Container>
  );
}

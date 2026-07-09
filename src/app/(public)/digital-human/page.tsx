'use client';

import ImmersiveDigitalHuman from '@/digital-human/ImmersiveDigitalHuman';
import HotRankingBar from '@/components/home/HotRankingBar';
import RecommendBoard from '@/components/home/RecommendBoard';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';


export default function DigitalHumanPage() {
  return (
    <Box>
      <ImmersiveDigitalHuman />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 360px' }, gap: 2 }}>
          <RecommendBoard
            types={['NEWS', 'VIDEO', 'MUSIC', 'ARTICLE']}
            size={12}
            title="数字人相关热门"
          />
          <HotRankingBar
            contentType="NEWS"
            title="实时热搜"
            maxItems={10}
            expandable
          />
        </Box>
      </Container>
    </Box>
  );
}
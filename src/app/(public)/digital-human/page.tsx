'use client';

import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { DigitalHumanLoginGate } from '@/digital-human/DigitalHumanLoginPrompt';
import DigitalHumanIntro from '@/digital-human/DigitalHumanIntro';
import RecommendBoard from '@/components/home/RecommendBoard';
import { useAIPrefs } from '@/lib/aiPrefs';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';

// 3D 舞台很重(three.js + VRM),只在真正进入对话时才加载
const ImmersiveDigitalHuman = dynamic(() => import('@/digital-human/ImmersiveDigitalHuman'), { ssr: false });

/**
 * 先介绍、再进入:?start=1 直接进入对话(介绍页的「开始对话」、登录回跳),
 * ?intro=1 强制看介绍(小助手的「了解」按钮);都没有时按用户的「下次直接进入」偏好。
 */
export default function DigitalHumanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [prefs] = useAIPrefs();
  // ?room=<uid>:串门链接,直接进去
  const room = searchParams.get('room');
  const started =
    searchParams.get('start') === '1' || !!room || (prefs.skipIntro && searchParams.get('intro') !== '1');

  if (!started) {
    return <DigitalHumanIntro onStart={() => router.replace('/digital-human?start=1')} />;
  }

  return (
    <Box>
      <DigitalHumanLoginGate>
        <ImmersiveDigitalHuman initialRoom={room} />
      </DigitalHumanLoginGate>
      {/* 对话界面 / 登录提示都是 position:fixed + zIndex:1 盖满整屏,这块榜单其实垫在它们下面。
          卡片上的「站内可播」标签是 position:absolute + zIndex:5,卡片本身不成层叠上下文,
          标签会越过 zIndex:1 的对话界面浮在最上面 —— 手机上一屏十几个,挡住聊天和按钮。
          isolation:isolate 把整块榜单收成一层(z 为 auto,低于 1),标签只在榜单内部比高低。 */}
      <Container maxWidth="lg" sx={{ py: 4, isolation: 'isolate' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 360px' }, gap: 2 }}>
          <RecommendBoard
            types={['NEWS', 'VIDEO', 'MUSIC', 'ARTICLE']}
            size={12}
            title="数字人相关热门"
          />
        </Box>
      </Container>
    </Box>
  );
}

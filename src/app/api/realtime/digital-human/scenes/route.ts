/**
 * /api/realtime/digital-human/scenes
 */
import sceneConcert from '@/data/seed/scenes/concert.json';
import sceneIdol from '@/data/seed/scenes/idol.json';
import sceneGarden from '@/data/seed/scenes/garden.json';
import sceneNeon from '@/data/seed/scenes/neon.json';
import sceneStudio from '@/data/seed/scenes/studio.json';
import sceneLawn from '@/data/seed/scenes/lawn.json';

export const dynamic = 'force-static';

export async function GET() {
  return Response.json({
    data: [sceneConcert, sceneIdol, sceneGarden, sceneNeon, sceneStudio, sceneLawn]
  });
}

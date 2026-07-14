/**
 * /api/realtime/digital-human/models
 */
import actionsCharacter from '@/data/seed/actions/character.json';
import dancesCharacter from '@/data/seed/dances/character.json';
import posesCharacter from '@/data/seed/poses/character.json';
import expressionsCharacter from '@/data/seed/expressions/character.json';
import visemesCharacter from '@/data/seed/visemes/character.json';
import sceneConcert from '@/data/seed/scenes/concert.json';
import sceneIdol from '@/data/seed/scenes/idol.json';
import sceneGarden from '@/data/seed/scenes/garden.json';
import sceneNeon from '@/data/seed/scenes/neon.json';
import sceneStudio from '@/data/seed/scenes/studio.json';
import sceneLawn from '@/data/seed/scenes/lawn.json';
import modelCharacter from '@/data/seed/models/character.json';

export const dynamic = 'force-static';

export async function GET() {
  return Response.json({ data: [modelCharacter] });
}

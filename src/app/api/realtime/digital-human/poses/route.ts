/**
 * /api/realtime/digital-human/poses
 */
import posesCharacter from '@/data/seed/poses/character.json';

export const dynamic = 'force-static';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const modelId = url.searchParams.get('modelId');

  let data = posesCharacter as any[];
  if (modelId) {
    data = data.filter(item => !item.modelId || item.modelId === modelId);
  }

  return Response.json({ data });
}

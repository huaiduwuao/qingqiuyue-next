/**
 * /api/realtime/digital-human/visemes
 */
import visemesCharacter from '@/data/seed/visemes/character.json';

export const dynamic = 'force-static';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const modelId = url.searchParams.get('modelId');

  let data = visemesCharacter as any[];
  if (modelId) {
    data = data.filter(item => !item.modelId || item.modelId === modelId);
  }

  return Response.json({ data });
}

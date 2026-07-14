/**
 * /api/realtime/digital-human/expression-presets
 */
import expressionsCharacter from '@/data/seed/expressions/character.json';

export const dynamic = 'force-static';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const modelId = url.searchParams.get('modelId');

  let data = expressionsCharacter as any[];
  if (modelId) {
    data = data.filter(item => !item.modelId || item.modelId === modelId);
  }

  return Response.json({ data });
}

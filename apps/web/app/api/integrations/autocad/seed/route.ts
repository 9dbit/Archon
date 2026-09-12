import {handleSeedUpload} from '../../../../../../../packages/autocad-plugin/seed-upload.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  return handleSeedUpload(request);
}

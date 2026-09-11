import { NextResponse } from 'next/server';
import { engineAdapters } from '@archon/engine-adapters';

export async function GET() {
  const entries = await Promise.all(
    Object.entries(engineAdapters).map(async ([key, adapter]) => ({
      key,
      id: adapter.id,
      label: adapter.label,
      capabilities: adapter.capabilities,
      health: await adapter.health(),
      mode: 'mock'
    }))
  );

  return NextResponse.json({ engines: entries });
}

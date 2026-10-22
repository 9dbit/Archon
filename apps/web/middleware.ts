import { NextRequest, NextResponse } from 'next/server';

/**
 * Render hot-standby safety switch. When enabled, read-only browsing and
 * health probes work but API writes and server actions cannot mutate state.
 * Railway production has no such flag and is not affected by this branch.
 */
export function middleware(request: NextRequest) {
  if (process.env.ARCHON_RENDER_STANDBY_READ_ONLY !== 'true') {
    return NextResponse.next();
  }
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return NextResponse.next();
  }
  return NextResponse.json(
    { error: 'ARCHON_STANDBY_READ_ONLY', status: 'standby' },
    { status: 423, headers: { 'Cache-Control': 'no-store' } },
  );
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

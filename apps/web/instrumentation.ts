export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.RAILWAY_SERVICE_ID) {
    const { startApsConnectionProbe } = await import('@archon/engine-adapters');
    // The optional external probe must not block application startup.
    void startApsConnectionProbe().catch(() => {
      console.error('APS_STARTUP_PROBE_FAILED');
    });
  }
}

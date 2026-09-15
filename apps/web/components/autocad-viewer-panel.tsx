'use client';

import { useEffect, useState } from 'react';
import { Eye, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react';

type ViewerStatus = {
  state: 'LOCKED' | 'READY' | 'TRANSLATION_PENDING' | 'FAILED';
  viewerEnabled: boolean;
  urnConfigured: boolean;
  translationStatus: string;
  missing: string[];
  diagnostics: string[];
  executionEnabled: false;
  externalSync: 'LOCKED';
};

export function AutoCadViewerPanel() {
  const [status, setStatus] = useState<ViewerStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadStatus() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/integrations/autocad/viewer/status', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'AUTOCAD_VIEWER_STATUS_FAILED');
      setStatus(payload as ViewerStatus);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'AUTOCAD_VIEWER_STATUS_FAILED');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void loadStatus(); }, []);

  const ready = status?.state === 'READY';
  const pending = status?.state === 'TRANSLATION_PENDING';

  return <section className="autocad-viewer-panel" aria-labelledby="autocad-viewer-title">
    <div className="autocad-viewer-head">
      <div>
        <small>AUTOCAD VIEWER / APS MODEL DERIVATIVE</small>
        <h3 id="autocad-viewer-title">DWG Review Viewport</h3>
        <p>Read-only Autodesk-style drawing review. ARCHON Building Graph remains the canonical source of truth.</p>
      </div>
      <span className={`autocad-viewer-state ${ready ? 'ready' : pending ? 'pending' : 'locked'}`}>{status?.state ?? 'CHECKING'}</span>
    </div>
    <div className="autocad-viewer-stage">
      {ready ? <div className="autocad-viewer-placeholder"><Eye size={26}/><b>Viewer resource is ready</b><small>APS Viewer session loading is the next transport step.</small></div> :
        <div className="autocad-viewer-placeholder"><LockKeyhole size={26}/><b>{pending ? 'DWG translation pending' : 'Viewer load locked'}</b><small>{pending ? 'Wait for a completed APS derivative before opening the drawing.' : 'Configure a valid translated APS URN and enable the viewer gate before any external artifact is loaded.'}</small></div>}
    </div>
    <div className="autocad-viewer-meta">
      <span><ShieldCheck size={13}/> Canonical graph protected</span>
      <span>Translation: {status?.translationStatus ?? 'CHECKING'}</span>
      <span>External sync: LOCKED</span>
      <button onClick={() => void loadStatus()} disabled={busy}><RefreshCw size={13} className={busy ? 'spin' : ''}/>Refresh</button>
    </div>
    {error && <small className="autocad-viewer-error">{error}</small>}
    {status?.missing.length ? <small className="autocad-viewer-error">Missing viewer configuration: {status.missing.join(', ')}</small> : null}
    {status?.diagnostics.length ? <small className="autocad-viewer-diagnostics">{status.diagnostics.join(' · ')}</small> : null}
  </section>;
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { Eye, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react';

declare global { interface Window { Autodesk?: any; } }

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

type ViewerSession = { state: 'READY'; urn: string; accessToken: string; expiresIn: number; diagnostics: string[]; executionEnabled: false; externalSync: 'LOCKED' };
const VIEWER_SCRIPT = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.js';

export function AutoCadViewerPanel() {
  const [status, setStatus] = useState<ViewerStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);\n  const [viewerState, setViewerState] = useState<'IDLE' | 'LOADING' | 'READY' | 'FAILED'>('IDLE');\n  const viewerContainer = useRef<HTMLDivElement>(null);\n  const viewerInstance = useRef<any>(null);

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

  useEffect(() => {
    if (status?.state !== 'READY' || !viewerContainer.current || viewerInstance.current) return;
    let disposed = false;
    const loadScript = () => new Promise<void>((resolve, reject) => {
      if (window.Autodesk?.Viewing) return resolve();
      const existing = document.querySelector('script[data-archon-autodesk-viewer]');
      if (existing) { existing.addEventListener('load', () => resolve(), { once: true }); existing.addEventListener('error', () => reject(new Error('AUTODESK_VIEWER_SCRIPT_FAILED')), { once: true }); return; }
      const script = document.createElement('script');
      script.src = VIEWER_SCRIPT; script.async = true; script.dataset.archonAutodeskViewer = 'true';
      script.onload = () => resolve(); script.onerror = () => reject(new Error('AUTODESK_VIEWER_SCRIPT_FAILED'));
      document.head.appendChild(script);
    });
    const startViewer = async () => {
      setViewerState('LOADING');
      try {
        const response = await fetch('/api/integrations/autocad/viewer/session', { cache: 'no-store' });
        const session = await response.json() as ViewerSession | { error?: string };
        if (!response.ok || !('accessToken' in session) || !session.accessToken) throw new Error(('error' in session && session.error) || 'AUTOCAD_VIEWER_SESSION_FAILED');
        await loadScript();
        if (disposed || !window.Autodesk?.Viewing || !viewerContainer.current) return;
        await new Promise<void>((resolve, reject) => {
          window.Autodesk.Viewing.Initializer({ env: 'AutodeskProduction', getAccessToken: (callback: (token: string, expiresIn: number) => void) => callback(session.accessToken, session.expiresIn) }, () => {
            if (disposed || !viewerContainer.current) return resolve();
            const viewer = new window.Autodesk.Viewing.GuiViewer3D(viewerContainer.current, { extensions: [] });
            const code = viewer.start();
            if (code > 0) return reject(new Error('AUTODESK_VIEWER_START_FAILED'));
            viewerInstance.current = viewer;
            window.Autodesk.Viewing.Document.load('urn:' + session.urn, (document: any) => {
              if (disposed || !viewerInstance.current) return resolve();
              const root = document.getRoot();
              const geometry = root.getDefaultGeometry();
              if (!geometry) return reject(new Error('AUTODESK_VIEWER_GEOMETRY_MISSING'));
              viewerInstance.current.loadDocumentNode(document, geometry).then(() => resolve()).catch(reject);
            }, (_code: unknown, message: string) => reject(new Error(message || 'AUTODESK_VIEWER_DOCUMENT_FAILED')));
          });
        });
        if (!disposed) setViewerState('READY');
      } catch (cause) {
        if (!disposed) { setViewerState('FAILED'); setError(cause instanceof Error ? cause.message : 'AUTOCAD_VIEWER_LOAD_FAILED'); }
      }
    };
    void startViewer();
    return () => { disposed = true; viewerInstance.current?.finish?.(); viewerInstance.current = null; };
  }, [status?.state]);

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
    <div className={`autocad-viewer-stage ${ready ? 'autocad-viewer-live' : ''}`}>
      {ready ? <><div ref={viewerContainer} className="autocad-viewer-canvas" aria-label="Autodesk Viewer drawing canvas" />{viewerState !== 'READY' && <div className="autocad-viewer-overlay"><Eye size={26}/><b>{viewerState === 'FAILED' ? 'Viewer failed to load' : 'Loading Autodesk Viewer'}</b><small>{viewerState === 'FAILED' ? 'Inspect the diagnostics below. The drawing remains read-only.' : 'Fetching a short-lived read-only Viewer session and translated derivative.'}</small></div>}</> :
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

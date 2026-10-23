'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Expand, RefreshCw, ShieldCheck } from 'lucide-react';

export type RevitViewerStatus = {
  state: 'READY' | 'NOT_READY' | 'TRANSLATION_PENDING';
  viewerEnabled: boolean;
  credentialsConfigured: boolean;
  urnConfigured: boolean;
  translationStatus: string;
  missing: string[];
  nativeRvtOriginVerified: boolean;
};

type ViewerSession = { state: 'READY'; urn: string; accessToken: string; expiresIn: number };
const SDK_URL = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.js';

declare global {
  interface Window { Autodesk?: any }
}

async function ensureAutodeskSdk(): Promise<void> {
  if (window.Autodesk?.Viewing) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-archon-revit-viewer]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('VIEWER_SCRIPT_FAILED')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.dataset.archonRevitViewer = 'true';
    script.async = true;
    script.src = SDK_URL;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('VIEWER_SCRIPT_FAILED'));
    document.head.appendChild(script);
  });
  if (!window.Autodesk?.Viewing) throw new Error('VIEWER_SDK_UNAVAILABLE');
}

/** Display the Autodesk-rendered derivative of a native RVT, never a fake mesh. */
export function RevitApsViewer({ status }: { status: RevitViewerStatus | null }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [phase, setPhase] = useState<'IDLE' | 'LOADING' | 'READY' | 'FAILED'>('IDLE');
  const [error, setError] = useState<string | null>(null);
  const ready = status?.state === 'READY';

  useEffect(() => {
    if (!ready) {
      setPhase('IDLE');
      setError(null);
      return;
    }
    let canceled = false;
    const load = async () => {
      setPhase('LOADING');
      setError(null);
      try {
        const response = await fetch('/api/integrations/revit/viewer/session', { cache: 'no-store' });
        if (!response.ok) throw new Error('REVIT_VIEWER_SESSION_FAILED');
        const session = await response.json() as ViewerSession;
        if (session.state !== 'READY' || !session.urn || !session.accessToken || !session.expiresIn) {
          throw new Error('REVIT_VIEWER_SESSION_INVALID');
        }
        await ensureAutodeskSdk();
        if (canceled || !canvasRef.current) return;
        await new Promise<void>((resolve, reject) => {
          window.Autodesk.Viewing.Initializer({
            env: 'AutodeskProduction',
            getAccessToken: (callback: (token: string, expiresIn: number) => void) =>
              callback(session.accessToken, session.expiresIn)
          }, () => {
            if (canceled || !canvasRef.current) { resolve(); return; }
            try {
              const viewer = new window.Autodesk.Viewing.GuiViewer3D(canvasRef.current);
              const code = viewer.start();
              if (code > 0) { reject(new Error('VIEWER_START_FAILED')); return; }
              viewerRef.current = viewer;
              window.Autodesk.Viewing.Document.load('urn:' + session.urn,
                (document: any) => {
                  if (canceled) { resolve(); return; }
                  const geometry = document.getRoot().getDefaultGeometry();
                  if (!geometry) { reject(new Error('NO_REVIT_VIEWABLE_GEOMETRY')); return; }
                  viewer.loadDocumentNode(document, geometry).then(() => resolve()).catch(() => reject(new Error('VIEWER_MODEL_LOAD_FAILED')));
                },
                () => reject(new Error('VIEWER_MODEL_NOT_AVAILABLE'))
              );
            } catch {
              reject(new Error('VIEWER_INITIALIZATION_FAILED'));
            }
          });
        });
        if (!canceled) setPhase('READY');
      } catch (cause) {
        if (!canceled) {
          setError(cause instanceof Error ? cause.message : 'VIEWER_LOAD_FAILED');
          setPhase('FAILED');
        }
      }
    };
    void load();
    return () => {
      canceled = true;
      viewerRef.current?.finish?.();
      viewerRef.current = null;
    };
  }, [ready, refreshKey]);

  function expand() {
    if (stageRef.current && document.fullscreenElement !== stageRef.current) {
      void stageRef.current.requestFullscreen?.();
    } else if (document.fullscreenElement) {
      void document.exitFullscreen?.();
    }
  }

  const statusLabel = ready ? (phase === 'READY' ? 'VIEWER ACTIVE' : 'VIEWER CONFIGURED')
    : status?.state === 'TRANSLATION_PENDING' ? 'CONVERSION PENDING'
    : status ? 'NO RVT READY' : 'CHECKING';

  return <section className="rw-model-viewer" aria-label="Autodesk Revit model viewer">
    <div className="rw-viewer-toolbar">
      <div className="rw-viewer-titles">
        <span className="rw-eyebrow">MODEL VIEWER</span>
        <h2>Native Revit <span className="rw-muted">/ Autodesk APS</span></h2>
      </div>
      <div className="rw-viewer-actions">
        <span className={phase === 'READY' ? 'rw-state is-ready' : 'rw-state'}>{statusLabel}</span>
        <button type="button" className="rw-icon-btn" aria-label="Reload Revit model" title="Reload Revit model"
          disabled={!ready} onClick={() => setRefreshKey(value => value + 1)}><RefreshCw size={17}/></button>
        <button type="button" className="rw-icon-btn" aria-label="Expand viewer" title="Expand viewer"
          disabled={phase !== 'READY'} onClick={expand}><Expand size={17}/></button>
      </div>
    </div>
    <div className="rw-viewer-stage" ref={stageRef}>
      {ready && <div ref={canvasRef} className="rw-viewer-canvas" aria-label="Autodesk Viewer 3D canvas"/>}
      {(!ready || phase !== 'READY') && <div className="rw-viewer-placeholder" role="status">
        <div className="rw-viewer-placeholder-icon"><Box size={32} strokeWidth={1.3}/></div>
        <h3>{phase === 'FAILED' ? 'The model could not be opened'
          : phase === 'LOADING' ? 'Opening Autodesk Viewer'
          : status?.state === 'TRANSLATION_PENDING' ? 'Preparing Revit viewable'
          : 'No translated RVT'}</h3>
        <p>{phase === 'FAILED' ? 'The RVT remains unchanged. Inspect the setup and try again.'
          : phase === 'LOADING' ? 'Loading the Autodesk-hosted translated model.'
          : status?.state === 'TRANSLATION_PENDING' ? 'The RVT must finish Autodesk Model Derivative translation before it can be viewed.'
          : 'Generate a native RVT through Revit Automation or attach an authorized model, then translate it with Autodesk Model Derivative.'}</p>
        {phase === 'FAILED' && <button type="button" className="rw-button rw-button-secondary" onClick={() => setRefreshKey(value => value + 1)}>Try again</button>}
        {error && <small className="rw-error-code">{error}</small>}
        {!ready && <span className="rw-placeholder-tag">No placeholder model</span>}
      </div>}
    </div>
    <div className="rw-viewer-footer"><span><ShieldCheck size={15}/> Autodesk Viewer · read-only</span><span>Orbit · Pan · Zoom · Section · Properties when model available</span></div>
  </section>;
}

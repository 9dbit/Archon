export type RevitViewerPhase = 'IDLE' | 'LOADING' | 'READY' | 'FAILED';
export type RevitViewerEvidenceStatus = {
  state: 'READY' | 'NOT_READY' | 'TRANSLATION_PENDING';
  nativeRvtOriginVerified?: boolean;
} | null;

/** A configured URN is not proof that the Autodesk Viewer actually loaded geometry. */
export function isRevitModelVisible(status: RevitViewerEvidenceStatus, phase: RevitViewerPhase): boolean {
  return status?.state === 'READY' && phase === 'READY';
}

/** Independently verified source provenance remains a separate acceptance gate. */
export function isRevitModelAccepted(status: RevitViewerEvidenceStatus, phase: RevitViewerPhase): boolean {
  return isRevitModelVisible(status, phase) && status?.nativeRvtOriginVerified === true;
}

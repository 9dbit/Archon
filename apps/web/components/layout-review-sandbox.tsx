'use client';

import { useMemo, useState } from 'react';
import {
  createLayoutReviewProposal,
  createPromptLayoutPreview,
  type LayoutCandidate,
  type LayoutRoomReviewEdit,
  type PromptLayoutPreview
} from '@archon/domain';

const DEFAULT_PROMPT = 'Buat office 18 x 24 meter, reception, 2 meeting room, director room, open office untuk 20 staff, pantry, toilet pria, toilet wanita dan storage. Corridor minimum 1.2 m, dinding 100 mm.';

const panel: React.CSSProperties = {
  background: '#171a1d',
  border: '1px solid #2b3035',
  borderRadius: 14,
  padding: 16
};

function MiniPlan({ candidate }: { candidate: LayoutCandidate }) {
  const maxX = Math.max(...candidate.rooms.map(room => room.xMm + room.widthMm), 1);
  const maxY = Math.max(...candidate.rooms.map(room => room.yMm + room.depthMm), 1);
  const width = 520;
  const height = 300;
  const margin = 12;
  const scale = Math.min((width - margin * 2) / maxX, (height - margin * 2) / maxY);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 260, background: '#0d0f11', borderRadius: 10 }}>
      {candidate.rooms.map(room => (
        <g key={room.roomId}>
          <rect
            x={margin + room.xMm * scale}
            y={margin + room.yMm * scale}
            width={Math.max(2, room.widthMm * scale)}
            height={Math.max(2, room.depthMm * scale)}
            fill="rgba(200,255,61,0.05)"
            stroke="#9aa3ad"
            strokeWidth="1"
          />
          <text
            x={margin + room.xMm * scale + 5}
            y={margin + room.yMm * scale + 14}
            fill="#c8ff3d"
            fontSize="10"
          >
            {room.roomId}
          </text>
        </g>
      ))}
    </svg>
  );
}

function numberOrUndefined(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function LayoutReviewSandbox() {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [preview, setPreview] = useState<PromptLayoutPreview | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [edits, setEdits] = useState<Record<string, LayoutRoomReviewEdit>>({});
  const [review, setReview] = useState<ReturnType<typeof createLayoutReviewProposal> | null>(null);
  const [error, setError] = useState<string>('');

  const selected = useMemo(
    () => preview?.candidates.find(candidate => candidate.id === selectedId) ?? null,
    [preview, selectedId]
  );

  function generate() {
    try {
      const next = createPromptLayoutPreview({ prompt });
      setPreview(next);
      const firstValid = next.candidates.find(candidate => candidate.valid) ?? next.candidates[0];
      setSelectedId(firstValid?.id ?? '');
      setEdits({});
      setReview(null);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'UNKNOWN_ERROR');
    }
  }

  function updateRoom(roomId: string, key: keyof Omit<LayoutRoomReviewEdit, 'roomId'>, value: string) {
    setEdits(current => ({
      ...current,
      [roomId]: {
        roomId,
        ...(current[roomId] ?? {}),
        [key]: numberOrUndefined(value)
      }
    }));
    setReview(null);
  }

  function buildReview() {
    if (!selectedId) return;
    try {
      const next = createLayoutReviewProposal({
        prompt,
        candidateId: selectedId,
        edits: Object.values(edits).filter(edit =>
          edit.xMm !== undefined || edit.yMm !== undefined || edit.widthMm !== undefined || edit.depthMm !== undefined
        )
      });
      setReview(next);
      setError('');
    } catch (cause) {
      setReview(null);
      setError(cause instanceof Error ? cause.message : 'UNKNOWN_ERROR');
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#0f1113', color: '#f4f6f8', padding: 24, fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1500, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 22, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#c8ff3d', fontSize: 12, fontWeight: 700, letterSpacing: 1.4 }}>ARCHON v0.3.1</div>
            <h1 style={{ margin: '5px 0 6px', fontSize: 30 }}>Prompt Layout Review Sandbox</h1>
            <div style={{ color: '#8e98a3', maxWidth: 760 }}>Browser-only review surface. It produces Drawing IR and a Proposed Draw ChangeSet, but cannot execute SketchUp geometry.</div>
          </div>
          <div style={{ padding: '8px 12px', borderRadius: 999, background: '#241f12', color: '#ffd27a', border: '1px solid #4a3d1d', fontSize: 12 }}>
            MUTATION LOCKED
          </div>
        </div>

        <section style={{ ...panel, marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#aab2ba', marginBottom: 7 }}>Natural-language program</label>
          <textarea
            value={prompt}
            onChange={event => setPrompt(event.target.value)}
            rows={5}
            style={{ width: '100%', resize: 'vertical', borderRadius: 10, border: '1px solid #343a40', background: '#0d0f11', color: '#fff', padding: 12, lineHeight: 1.5 }}
          />
          <button onClick={generate} style={{ marginTop: 10, border: 0, borderRadius: 9, padding: '10px 16px', background: '#c8ff3d', color: '#11150d', fontWeight: 800, cursor: 'pointer' }}>
            Generate 3 Candidates
          </button>
          {error && <div style={{ marginTop: 10, color: '#ff8e8e', fontSize: 12 }}>{error}</div>}
        </section>

        {preview && (
          <>
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14, marginBottom: 16 }}>
              {preview.candidates.map(candidate => (
                <button
                  key={candidate.id}
                  onClick={() => { setSelectedId(candidate.id); setEdits({}); setReview(null); }}
                  style={{ ...panel, textAlign: 'left', color: '#fff', cursor: 'pointer', outline: selectedId === candidate.id ? '2px solid #c8ff3d' : 'none' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 9 }}>
                    <strong>{candidate.id}</strong>
                    <span style={{ fontSize: 11, color: candidate.valid ? '#c8ff3d' : '#ff9a9a' }}>{candidate.valid ? 'VALID' : 'NEEDS REVIEW'}</span>
                  </div>
                  <MiniPlan candidate={candidate} />
                  <div style={{ marginTop: 8, color: '#9ba4ad', fontSize: 11 }}>{candidate.strategy} · {candidate.metrics.placedRoomAreaM2} m² placed</div>
                </button>
              ))}
            </section>

            {selected && (
              <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(320px,.8fr)', gap: 16, alignItems: 'start' }}>
                <div style={panel}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div>
                      <strong>Review {selected.id}</strong>
                      <div style={{ color: '#8e98a3', fontSize: 11, marginTop: 3 }}>Edit coordinates and dimensions in millimetres. Blank means keep solver value.</div>
                    </div>
                    <button onClick={buildReview} style={{ border: 0, borderRadius: 9, padding: '9px 13px', background: '#2b3239', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                      Build Proposed ChangeSet
                    </button>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ color: '#8e98a3', textAlign: 'left' }}>
                          <th style={{ padding: 8 }}>Room</th><th style={{ padding: 8 }}>X</th><th style={{ padding: 8 }}>Y</th><th style={{ padding: 8 }}>W</th><th style={{ padding: 8 }}>D</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.rooms.map(room => (
                          <tr key={room.roomId} style={{ borderTop: '1px solid #292e33' }}>
                            <td style={{ padding: 8, color: '#c8ff3d', fontWeight: 700 }}>{room.roomId}</td>
                            {(['xMm', 'yMm', 'widthMm', 'depthMm'] as const).map(key => (
                              <td key={key} style={{ padding: 6 }}>
                                <input
                                  type="number"
                                  placeholder={String(room[key])}
                                  value={edits[room.roomId]?.[key] ?? ''}
                                  onChange={event => updateRoom(room.roomId, key, event.target.value)}
                                  style={{ width: 92, maxWidth: '100%', background: '#0d0f11', color: '#fff', border: '1px solid #333a41', borderRadius: 7, padding: '7px 8px' }}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={panel}>
                  <strong>Governance Result</strong>
                  {!review ? (
                    <div style={{ color: '#8e98a3', fontSize: 12, lineHeight: 1.6, marginTop: 10 }}>Select/edit a candidate, then build the Proposed ChangeSet. No SketchUp call is made.</div>
                  ) : (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: review.state === 'REVIEW_READY' ? '#c8ff3d' : '#ff9a9a' }}>{review.state}</div>
                      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <Metric label="Operations" value={String(review.drawingIR.operationCount)} />
                        <Metric label="Fingerprint" value={review.drawingIR.deterministicFingerprint} />
                      </div>
                      <div style={{ marginTop: 12, fontSize: 11, color: '#aab2ba', wordBreak: 'break-all' }}>ChangeSet: {review.proposedChangeSet.id}</div>
                      <div style={{ marginTop: 12 }}>
                        {review.validation.map(finding => (
                          <div key={finding.code} style={{ padding: '7px 0', borderTop: '1px solid #292e33', fontSize: 11, color: finding.severity === 'BLOCKER' ? '#ff9a9a' : finding.severity === 'WARNING' ? '#ffd27a' : '#b8c0c7' }}>
                            <b>{finding.severity}</b> · {finding.message}
                          </div>
                        ))}
                      </div>
                      <button disabled style={{ width: '100%', marginTop: 14, border: '1px solid #3a4046', borderRadius: 9, padding: 10, background: '#1c2024', color: '#707981', fontWeight: 800 }}>
                        Approve & Draw · LOCKED
                      </button>
                    </div>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div style={{ background: '#0d0f11', borderRadius: 8, padding: 9 }}><div style={{ color: '#7f8992', fontSize: 10 }}>{label}</div><div style={{ marginTop: 3, fontWeight: 800, fontSize: 13 }}>{value}</div></div>;
}

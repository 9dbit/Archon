'use client';

import { useMemo, useState } from 'react';
import type { CanonicalObject } from './canonical-3d-viewport';
import type { ChangeOperation } from './changeset-bar';

export type ProjectBrief = {
  siteWidthMm?: number | null;
  siteDepthMm?: number | null;
  targetGfaSqMm?: number | null;
  levels?: number | null;
  floorToFloorHeights?: number[] | null;
  programRequirements?: Record<string, unknown> | null;
  setbacks?: Record<string, unknown> | null;
  notes?: string | null;
} | null;

export type DesignAlternative = {
  id: string;
  title: string;
  strategy: string;
  objective: string;
  score: { capacity: number; circulation: number; operations: number; cost: number };
  rationale: string[];
  constraints: string[];
  operation: ChangeOperation;
};

type Props = {
  objects: CanonicalObject[];
  brief?: ProjectBrief;
  disabled?: boolean;
  onSelect: (alternative: DesignAlternative) => Promise<void>;
};

const OBJECTIVES = ['Balanced plan', 'Maximize capacity', 'Improve operations'] as const;
type Objective = typeof OBJECTIVES[number];

type ConstraintModel = {
  siteAreaSqM: number | null;
  targetGfaSqM: number | null;
  targetSeats: number | null;
  minCirculationMm: number;
  kitchenSharePct: number;
  levels: number;
};

function tuple(value: unknown): [number, number, number] | null {
  return Array.isArray(value) && value.length === 3 && value.every(item => typeof item === 'number' && Number.isFinite(item))
    ? value as [number, number, number]
    : null;
}

function numeric(record: Record<string, unknown> | null | undefined, keys: string[]) {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

function constraintModel(brief: ProjectBrief): ConstraintModel {
  const program = brief?.programRequirements ?? {};
  const siteAreaSqM = brief?.siteWidthMm && brief?.siteDepthMm ? (brief.siteWidthMm * brief.siteDepthMm) / 1_000_000 : null;
  return {
    siteAreaSqM,
    targetGfaSqM: typeof brief?.targetGfaSqMm === 'number' ? brief.targetGfaSqMm / 1_000_000 : null,
    targetSeats: numeric(program, ['targetSeats', 'seats', 'seatTarget', 'capacity']),
    minCirculationMm: numeric(program, ['minCirculationMm', 'circulationMm', 'minimumAisleMm']) ?? 1000,
    kitchenSharePct: numeric(program, ['kitchenSharePct', 'kitchenPercent', 'bohKitchenPct']) ?? 18,
    levels: brief?.levels && brief.levels > 0 ? brief.levels : 1
  };
}

function labelOf(object: CanonicalObject) {
  const label = object.parameters?.label;
  return typeof label === 'string' ? label.toUpperCase() : object.archonId.toUpperCase();
}

function choose(objects: CanonicalObject[], patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = objects.find(object => pattern.test(labelOf(object)));
    if (match) return match;
  }
  return objects.find(object => tuple(object.parameters?.sizeMm)) ?? null;
}

function resize(object: CanonicalObject, axis: 'widthMm' | 'depthMm', factor: number): ChangeOperation | null {
  const size = tuple(object.parameters?.sizeMm);
  if (!size) return null;
  const current = axis === 'widthMm' ? size[0] : size[2];
  const next = Math.max(100, Math.min(50000, Math.round(current * factor / 10) * 10));
  if (next === current) return null;
  return { type: 'UPDATE', targetId: object.archonId, payload: { [axis]: next } };
}

function roomAreaSqM(object: CanonicalObject | null) {
  if (!object) return 0;
  const size = tuple(object.parameters?.sizeMm);
  return size ? (size[0] * size[2]) / 1_000_000 : 0;
}

function clampScore(value: number) { return Math.max(0, Math.min(100, Math.round(value))); }

function buildAlternatives(objects: CanonicalObject[], objective: Objective, brief: ProjectBrief): DesignAlternative[] {
  const model = constraintModel(brief);
  const kitchen = choose(objects, [/KITCHEN/, /DAPUR/]);
  const dining = choose(objects, [/DINING/, /RESTAURANT/, /SEATING/]);
  const service = choose(objects, [/BAR/, /SERVICE/, /STORAGE/]);
  const totalKnownArea = objects.reduce((sum, object) => sum + roomAreaSqM(object), 0);
  const kitchenArea = roomAreaSqM(kitchen);
  const inferredKitchenShare = totalKnownArea > 0 ? (kitchenArea / totalKnownArea) * 100 : model.kitchenSharePct;
  const capacityPressure = model.targetSeats ? Math.min(18, Math.max(0, (model.targetSeats - 120) / 5)) : 6;
  const kitchenPressure = Math.max(-8, Math.min(12, model.kitchenSharePct - inferredKitchenShare));
  const circulationPenalty = model.minCirculationMm > 1200 ? 7 : model.minCirculationMm > 1000 ? 3 : 0;
  const candidates: DesignAlternative[] = [];

  if (dining) {
    const factor = objective === 'Maximize capacity' ? 1.12 + capacityPressure / 250 : 1.06 + capacityPressure / 400;
    const operation = resize(dining, 'widthMm', factor);
    if (operation) candidates.push({
      id: 'capacity-forward', title: 'Capacity Forward', strategy: 'Expand primary guest zone', objective,
      score: {
        capacity: clampScore(86 + capacityPressure),
        circulation: clampScore(80 - circulationPenalty - capacityPressure / 3),
        operations: clampScore(78 - Math.max(0, kitchenPressure) / 2),
        cost: clampScore(76 - capacityPressure / 2)
      },
      rationale: [
        model.targetSeats ? `Responds to a ${model.targetSeats}-seat program target.` : 'Prioritizes usable guest-area width.',
        model.targetGfaSqM ? `Keeps the proposal aware of target GFA ${model.targetGfaSqM.toFixed(0)} m².` : 'Uses canonical geometry as the current area envelope.',
        'Requires governed validation before approved-state mutation.'
      ],
      constraints: [
        `Circulation ≥ ${model.minCirculationMm} mm`,
        model.siteAreaSqM ? `Site ${model.siteAreaSqM.toFixed(0)} m²` : 'Site area not specified',
        `Levels ${model.levels}`
      ],
      operation
    });
  }

  if (kitchen) {
    const factor = objective === 'Improve operations' ? 1.10 + Math.max(0, kitchenPressure) / 120 : 1.05 + Math.max(0, kitchenPressure) / 180;
    const operation = resize(kitchen, 'widthMm', factor);
    if (operation) candidates.push({
      id: 'operations-forward', title: 'Operations Forward', strategy: 'Strengthen back-of-house capacity', objective,
      score: {
        capacity: clampScore(76 - Math.max(0, kitchenPressure) / 2),
        circulation: clampScore(84 - circulationPenalty / 2),
        operations: clampScore(88 + Math.max(0, kitchenPressure)),
        cost: clampScore(78 - Math.max(0, kitchenPressure) / 2)
      },
      rationale: [
        `Targets kitchen share near ${model.kitchenSharePct.toFixed(0)}% of known program area.`,
        `Current geometry implies roughly ${inferredKitchenShare.toFixed(1)}% kitchen share.`,
        'Selection creates a proposal only, preserving the approval boundary.'
      ],
      constraints: [
        `Kitchen target ${model.kitchenSharePct.toFixed(0)}%`,
        `Circulation ≥ ${model.minCirculationMm} mm`,
        model.targetGfaSqM ? `Target GFA ${model.targetGfaSqM.toFixed(0)} m²` : 'Target GFA not specified'
      ],
      operation
    });
  }

  if (service) {
    const operation = resize(service, 'depthMm', objective === 'Balanced plan' ? 1.06 : 1.04);
    if (operation) candidates.push({
      id: 'balanced-flow', title: 'Balanced Flow', strategy: 'Tune service-zone depth', objective,
      score: {
        capacity: clampScore(82 - capacityPressure / 4),
        circulation: clampScore(91 - circulationPenalty),
        operations: clampScore(86 + Math.max(0, kitchenPressure) / 3),
        cost: 82
      },
      rationale: [
        'Balances guest capacity and service support with a conservative delta.',
        `Uses ${model.minCirculationMm} mm as the current circulation constraint baseline.`,
        'Downstream approval remains governed and immutable.'
      ],
      constraints: [
        model.targetSeats ? `Target seats ${model.targetSeats}` : 'Seat target not specified',
        `Circulation ≥ ${model.minCirculationMm} mm`,
        `Levels ${model.levels}`
      ],
      operation
    });
  }

  return candidates.slice(0, 3);
}

export function DesignAlternatives({ objects, brief = null, disabled = false, onSelect }: Props) {
  const [objective, setObjective] = useState<Objective>('Balanced plan');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alternatives = useMemo(() => buildAlternatives(objects, objective, brief), [objects, objective, brief]);
  const model = useMemo(() => constraintModel(brief), [brief]);

  async function select(alternative: DesignAlternative) {
    setBusyId(alternative.id);
    setError(null);
    try { await onSelect(alternative); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'ALTERNATIVE_PROPOSAL_FAILED'); }
    finally { setBusyId(null); }
  }

  return <section className="design-ai-panel">
    <div className="design-ai-head"><div><span>AI DESIGN ENGINE · E7.2</span><h3>Brief-aware governed alternatives</h3><p>Alternatives read the project brief and canonical Building Graph together. Selecting one still creates only a proposed ChangeSet.</p></div><div className="design-objectives">{OBJECTIVES.map(item => <button key={item} className={item === objective ? 'active' : ''} onClick={() => setObjective(item)}>{item}</button>)}</div></div>
    <div className="design-scores" style={{marginTop:10,maxWidth:720}}><Score label="Site m²" value={model.siteAreaSqM ? Math.round(model.siteAreaSqM) : '—'}/><Score label="Target GFA m²" value={model.targetGfaSqM ? Math.round(model.targetGfaSqM) : '—'}/><Score label="Target seats" value={model.targetSeats ?? '—'}/><Score label="Min circulation" value={`${model.minCirculationMm}mm`}/></div>
    {error && <div className="design-ai-error">{error}</div>}
    <div className="design-alternative-grid">{alternatives.length ? alternatives.map(alternative => <article key={alternative.id} className="design-alternative-card"><div><span>{alternative.strategy}</span><h4>{alternative.title}</h4></div><div className="design-scores"><Score label="Capacity" value={alternative.score.capacity}/><Score label="Circulation" value={alternative.score.circulation}/><Score label="Operations" value={alternative.score.operations}/><Score label="Cost" value={alternative.score.cost}/></div><ul>{alternative.rationale.map(item => <li key={item}>{item}</li>)}</ul><small>{alternative.constraints.join(' · ')}</small><code>{alternative.operation.type} · {alternative.operation.targetId} · {JSON.stringify(alternative.operation.payload)}</code><button disabled={disabled || Boolean(busyId)} onClick={() => void select(alternative)}>{busyId === alternative.id ? 'Creating proposal…' : disabled ? 'Resolve active ChangeSet first' : 'Select as Proposal'}</button></article>) : <div className="design-ai-empty">Canonical room geometry is required before alternatives can be generated.</div>}</div>
  </section>;
}

function Score({ label, value }: { label: string; value: number | string }) {
  return <div><small>{label}</small><b>{value}</b></div>;
}

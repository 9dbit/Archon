'use client';

import { useMemo, useState } from 'react';
import type { CanonicalObject } from './canonical-3d-viewport';
import type { ChangeOperation } from './changeset-bar';

export type DesignAlternative = {
  id: string;
  title: string;
  strategy: string;
  objective: string;
  score: { capacity: number; circulation: number; operations: number; cost: number };
  rationale: string[];
  operation: ChangeOperation;
};

type Props = {
  objects: CanonicalObject[];
  disabled?: boolean;
  onSelect: (alternative: DesignAlternative) => Promise<void>;
};

const OBJECTIVES = ['Balanced plan', 'Maximize capacity', 'Improve operations'] as const;

type Objective = typeof OBJECTIVES[number];

function tuple(value: unknown): [number, number, number] | null {
  return Array.isArray(value) && value.length === 3 && value.every(item => typeof item === 'number' && Number.isFinite(item))
    ? value as [number, number, number]
    : null;
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

function buildAlternatives(objects: CanonicalObject[], objective: Objective): DesignAlternative[] {
  const kitchen = choose(objects, [/KITCHEN/, /DAPUR/]);
  const dining = choose(objects, [/DINING/, /RESTAURANT/, /SEATING/]);
  const service = choose(objects, [/BAR/, /SERVICE/, /STORAGE/]);
  const candidates: Array<DesignAlternative | null> = [];

  if (dining) {
    const operation = resize(dining, 'widthMm', objective === 'Maximize capacity' ? 1.12 : 1.06);
    if (operation) candidates.push({
      id: 'capacity-forward', title: 'Capacity Forward', strategy: 'Expand primary guest zone', objective,
      score: { capacity: 92, circulation: 74, operations: 76, cost: 68 },
      rationale: ['Prioritizes usable guest-area width.', 'Keeps the change inside the governed canonical dimension model.', 'Requires validation before any approved-state mutation.'], operation
    });
  }

  if (kitchen) {
    const operation = resize(kitchen, 'widthMm', objective === 'Improve operations' ? 1.10 : 1.05);
    if (operation) candidates.push({
      id: 'operations-forward', title: 'Operations Forward', strategy: 'Strengthen back-of-house capacity', objective,
      score: { capacity: 76, circulation: 83, operations: 94, cost: 72 },
      rationale: ['Adds working width to the kitchen/service core.', 'Favors operational resilience over maximum seating yield.', 'Selection creates only a proposed ChangeSet.'], operation
    });
  }

  if (service) {
    const operation = resize(service, 'depthMm', objective === 'Balanced plan' ? 1.06 : 1.04);
    if (operation) candidates.push({
      id: 'balanced-flow', title: 'Balanced Flow', strategy: 'Tune service-zone depth', objective,
      score: { capacity: 82, circulation: 88, operations: 86, cost: 81 },
      rationale: ['Balances guest capacity and service support.', 'Uses a conservative geometry delta for an early design pass.', 'Downstream approval remains governed and immutable.'], operation
    });
  }

  return candidates.slice(0, 3);
}

export function DesignAlternatives({ objects, disabled = false, onSelect }: Props) {
  const [objective, setObjective] = useState<Objective>('Balanced plan');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alternatives = useMemo(() => buildAlternatives(objects, objective), [objects, objective]);

  async function select(alternative: DesignAlternative) {
    setBusyId(alternative.id);
    setError(null);
    try {
      await onSelect(alternative);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ALTERNATIVE_PROPOSAL_FAILED');
    } finally {
      setBusyId(null);
    }
  }

  return <section className="design-ai-panel">
    <div className="design-ai-head"><div><span>AI DESIGN ENGINE · E7.1</span><h3>Governed space-planning alternatives</h3><p>Alternatives stay read-only until you select one. Selection creates a normal ChangeSet, never an approval.</p></div><div className="design-objectives">{OBJECTIVES.map(item => <button key={item} className={item === objective ? 'active' : ''} onClick={() => setObjective(item)}>{item}</button>)}</div></div>
    {error && <div className="design-ai-error">{error}</div>}
    <div className="design-alternative-grid">{alternatives.length ? alternatives.map(alternative => <article key={alternative.id} className="design-alternative-card"><div><span>{alternative.strategy}</span><h4>{alternative.title}</h4></div><div className="design-scores"><Score label="Capacity" value={alternative.score.capacity}/><Score label="Circulation" value={alternative.score.circulation}/><Score label="Operations" value={alternative.score.operations}/><Score label="Cost" value={alternative.score.cost}/></div><ul>{alternative.rationale.map(item => <li key={item}>{item}</li>)}</ul><code>{alternative.operation.type} · {alternative.operation.targetId} · {JSON.stringify(alternative.operation.payload)}</code><button disabled={disabled || Boolean(busyId)} onClick={() => void select(alternative)}>{busyId === alternative.id ? 'Creating proposal…' : disabled ? 'Resolve active ChangeSet first' : 'Select as Proposal'}</button></article>) : <div className="design-ai-empty">Canonical room geometry is required before alternatives can be generated.</div>}</div>
  </section>;
}

function Score({ label, value }: { label: string; value: number }) {
  return <div><small>{label}</small><b>{value}</b></div>;
}

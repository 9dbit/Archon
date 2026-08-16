import type { BriefInterpretation } from "./interpreter";
import { interpretBriefDeterministic } from "./interpreter";

/**
 * AI boundary (docs/05 §7, docs/09).
 * All AI output is proposal, not truth: results must pass Validation + Approval
 * before becoming authoritative.
 *
 * Phase 0 policy (GitHub Issue #4 review, adjustment 1): NO real external model
 * call may occur, even when `OPENAI_API_KEY` is present. The OpenAI provider is
 * scaffolded behind an explicit feature flag that is hard-disabled in Phase 0.
 */
export const PHASE0_OPENAI_ENABLED = false as const;

export type AITaskKind =
  | "brief-interpretation"
  | "reasoning"
  | "realtime-voice"
  | "image"
  | "model-3d"
  | "retrieval"
  | "optimization";

export interface BriefInterpreterProvider {
  readonly providerId: string;
  interpretBrief(text: string): Promise<BriefInterpretation>;
}

/** Router boundary — only brief interpretation is implemented in Phase 0. */
export interface AIModelRouter {
  interpretBrief(text: string): Promise<BriefInterpretation>;
  providerFor(task: AITaskKind): string;
}

export class MockBriefInterpreter implements BriefInterpreterProvider {
  readonly providerId = "deterministic-mock-v1";
  interpretBrief(text: string): Promise<BriefInterpretation> {
    return Promise.resolve(interpretBriefDeterministic(text));
  }
}

/**
 * Scaffold only. Disabled in Phase 0 regardless of credentials.
 * Enabling requires flipping the explicit feature flag in a future milestone.
 */
export class OpenAIBriefInterpreter implements BriefInterpreterProvider {
  readonly providerId = "openai-disabled";
  constructor(private readonly enabled: boolean = PHASE0_OPENAI_ENABLED) {}
  interpretBrief(_text: string): Promise<BriefInterpretation> {
    if (!this.enabled) {
      return Promise.reject(
        new Error(
          "OpenAI brief interpreter is disabled in Phase 0 (feature flag off). Use the deterministic mock interpreter.",
        ),
      );
    }
    return Promise.reject(
      new Error("OpenAI brief interpreter is not implemented in Phase 0."),
    );
  }
}

export function createAIModelRouter(): AIModelRouter {
  const mock = new MockBriefInterpreter();
  return {
    interpretBrief: (text) => mock.interpretBrief(text),
    providerFor: (task) =>
      task === "brief-interpretation" ? mock.providerId : "unrouted-phase0",
  };
}

import type { CommerceVerdict } from "@market-radar-pl/types";
import type { EconomicsResult } from "./economics.js";

export interface CommerceGateInput {
  signalScore: number;
  evidenceCount: number;
  economics: EconomicsResult | null;
}

export interface CommerceGateResult {
  verdict: CommerceVerdict;
  score: number;
  reasons: string[];
}

export function evaluateCommerceGate(input: CommerceGateInput): CommerceGateResult {
  const reasons: string[] = [];

  if (!Number.isFinite(input.signalScore) || input.signalScore < 0 || input.signalScore > 100) {
    return { verdict: "REJECT", score: 0, reasons: ["invalid_signal_score"] };
  }

  if (input.evidenceCount < 1) {
    return { verdict: "REJECT", score: input.signalScore, reasons: ["no_evidence"] };
  }

  if (!input.economics) {
    reasons.push("economics_missing");
    return { verdict: "REVIEW", score: input.signalScore, reasons };
  }

  if (input.economics.contributionMarginPln <= 0 || input.economics.marginPct <= 0) {
    return {
      verdict: "REJECT",
      score: input.signalScore,
      reasons: ["negative_or_zero_margin"],
    };
  }

  if (input.evidenceCount < 2) reasons.push("insufficient_independent_evidence");
  if (input.signalScore < 70) reasons.push("signal_below_70");
  if (input.economics.marginPct < 30) reasons.push("margin_below_30pct");
  if (input.economics.contributionMarginPln < 25) reasons.push("contribution_below_25pln");

  if (reasons.length > 0) {
    return { verdict: "REVIEW", score: input.signalScore, reasons };
  }

  return {
    verdict: "DRAFT_READY",
    score: input.signalScore,
    reasons: ["evidence_and_economics_passed"],
  };
}

import type { CommerceVerdict, ProductCandidateStatus } from "@market-radar-pl/types";

const ALLOWED: Record<ProductCandidateStatus, ProductCandidateStatus[]> = {
  discovered: ["needs_economics", "review", "rejected"],
  needs_economics: ["review", "draft_ready", "rejected"],
  review: ["needs_economics", "draft_ready", "rejected"],
  draft_ready: ["review", "draft_created", "rejected"],
  draft_created: ["review"],
  rejected: ["review"],
};

export function statusForVerdict(verdict: CommerceVerdict): ProductCandidateStatus {
  if (verdict === "DRAFT_READY") return "draft_ready";
  if (verdict === "REJECT") return "rejected";
  return "review";
}

export function assertCandidateTransition(
  from: ProductCandidateStatus,
  to: ProductCandidateStatus,
): void {
  if (from === to) return;
  if (!ALLOWED[from].includes(to)) {
    throw new Error(`Invalid candidate transition: ${from} -> ${to}`);
  }
}

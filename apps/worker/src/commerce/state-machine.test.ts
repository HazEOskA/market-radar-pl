import { describe, expect, it } from "vitest";
import { assertCandidateTransition, statusForVerdict } from "./state-machine.js";

describe("candidate state machine", () => {
  it("maps verdicts to candidate states", () => {
    expect(statusForVerdict("DRAFT_READY")).toBe("draft_ready");
    expect(statusForVerdict("REVIEW")).toBe("review");
    expect(statusForVerdict("REJECT")).toBe("rejected");
  });

  it("allows review to draft-ready transition", () => {
    expect(() => assertCandidateTransition("review", "draft_ready")).not.toThrow();
  });

  it("blocks skipping directly from discovered to created", () => {
    expect(() => assertCandidateTransition("discovered", "draft_created")).toThrow();
  });
});

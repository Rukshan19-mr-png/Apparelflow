import { describe, expect, it } from "vitest";
import { canTransitionOrder } from "../src/lib/verification";

describe("sewing queue release", () => {
  it("only starts sewing for verified orders", () => {
    expect(canTransitionOrder("VERIFIED", "SEWING_STARTED")).toBe(true);
    expect(canTransitionOrder("PENDING_VERIFICATION", "SEWING_STARTED")).toBe(false);
  });
});

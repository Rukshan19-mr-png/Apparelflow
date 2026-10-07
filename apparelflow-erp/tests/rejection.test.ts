import { describe, expect, it } from "vitest";
import { validateRejectionNote } from "../src/lib/verification";

describe("batch rejection", () => {
  it("requires a meaningful rejection note", () => {
    expect(validateRejectionNote("").valid).toBe(false);
    expect(validateRejectionNote("Sleeve pieces are damaged").valid).toBe(true);
  });
});

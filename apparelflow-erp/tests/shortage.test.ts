import { describe, expect, it } from "vitest";
import { validateComponentCounts } from "../src/lib/verification";

describe("component shortages", () => {
  it("blocks approval when an actual count is below expected", () => {
    const result = validateComponentCounts([{ componentName: "Sleeve cuff", expectedQty: 20, actualQty: 19 }]);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/shortage/i);
  });
});

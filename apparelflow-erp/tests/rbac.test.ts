import { describe, expect, it } from "vitest";
import { canAccessRoleResource } from "../src/lib/permissions";

describe("role access", () => {
  it("keeps verification and sewing resources assigned to their roles", () => {
    expect(canAccessRoleResource("cutting_verifier", "verification")).toBe(true);
    expect(canAccessRoleResource("cutting_supervisor", "verification")).toBe(false);
    expect(canAccessRoleResource("sewing_supervisor", "sewing_queue")).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import {
  buildLimitationsByRegion,
  buildLimitationPayload,
  getRegionFill,
  SEVERITY_TOKEN,
  SEVERITY_ALPHA,
  LIMITATION_TYPES,
  SEVERITIES,
  type Limitation,
} from "@/lib/bodyLimitations";

const lim = (over: Partial<Limitation> = {}): Limitation => ({
  id: "1",
  region: "chest",
  type: "muscular",
  severity: "leve",
  note: null,
  ...over,
});

describe("buildLimitationsByRegion", () => {
  it("indexes limitations by region", () => {
    const map = buildLimitationsByRegion([
      lim({ id: "a", region: "chest" }),
      lim({ id: "b", region: "quads" }),
    ]);
    expect(map.size).toBe(2);
    expect(map.get("chest")?.id).toBe("a");
    expect(map.get("quads")?.id).toBe("b");
  });

  it("keeps a single limitation per region (last wins)", () => {
    const map = buildLimitationsByRegion([
      lim({ id: "a", region: "chest", severity: "leve" }),
      lim({ id: "b", region: "chest", severity: "severa" }),
    ]);
    expect(map.size).toBe(1);
    expect(map.get("chest")?.id).toBe("b");
    expect(map.get("chest")?.severity).toBe("severa");
  });
});

describe("buildLimitationPayload", () => {
  it("trims notes and converts empty note to null", () => {
    const payload = buildLimitationPayload({
      studentId: "s1",
      region: "shoulders",
      type: "articular",
      severity: "moderada",
      note: "   ",
      createdBy: "u1",
    });
    expect(payload).toEqual({
      student_id: "s1",
      region: "shoulders",
      type: "articular",
      severity: "moderada",
      note: null,
      created_by: "u1",
    });
  });

  it("keeps trimmed note content and propagates createdBy", () => {
    const payload = buildLimitationPayload({
      studentId: "s2",
      region: "lower_back",
      type: "neural",
      severity: "severa",
      note: "  evitar carga axial  ",
      createdBy: null,
    });
    expect(payload.note).toBe("evitar carga axial");
    expect(payload.created_by).toBeNull();
  });
});

describe("getRegionFill", () => {
  const resolver = (token: string, alpha: number) => `${token}@${alpha}`;

  it("returns undefined for regions without a limitation", () => {
    const map = buildLimitationsByRegion([lim({ region: "chest" })]);
    expect(getRegionFill(map, "quads", resolver)).toBeUndefined();
  });

  it("uses the destructive token at full alpha for severe limitations", () => {
    const map = buildLimitationsByRegion([lim({ region: "chest", severity: "severa" })]);
    expect(getRegionFill(map, "chest", resolver)).toBe("--destructive@1");
  });

  it("uses the warning token with reduced alpha for lighter severities", () => {
    const map = buildLimitationsByRegion([lim({ region: "abs", severity: "leve" })]);
    expect(getRegionFill(map, "abs", resolver)).toBe("--warning@0.4");
  });
});

describe("severity/type config integrity", () => {
  it("defines a token and alpha for every severity", () => {
    for (const s of SEVERITIES) {
      expect(SEVERITY_TOKEN[s]).toBeTruthy();
      expect(SEVERITY_ALPHA[s]).toBeGreaterThan(0);
      expect(SEVERITY_ALPHA[s]).toBeLessThanOrEqual(1);
    }
  });

  it("severe is the most intense fill", () => {
    expect(SEVERITY_ALPHA.severa).toBeGreaterThanOrEqual(SEVERITY_ALPHA.moderada);
    expect(SEVERITY_ALPHA.moderada).toBeGreaterThanOrEqual(SEVERITY_ALPHA.leve);
  });

  it("exposes exactly the three limitation types", () => {
    expect(LIMITATION_TYPES).toEqual(["muscular", "articular", "neural"]);
  });
});

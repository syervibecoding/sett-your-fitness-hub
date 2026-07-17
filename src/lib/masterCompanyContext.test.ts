import { describe, expect, it } from "vitest";
import {
  parseStoredViewingCompany,
  resolveViewingCompany,
  type ViewingCompany,
} from "./masterCompanyContext";

const stored: ViewingCompany = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "BN Performance Training",
  tier: "advanced",
  slug: "bn-performance-training",
};

describe("master company context", () => {
  it("parses only a structurally valid stored company", () => {
    expect(parseStoredViewingCompany(JSON.stringify(stored))).toEqual(stored);
    expect(parseStoredViewingCompany("not-json")).toBeNull();
    expect(parseStoredViewingCompany('{"id":"missing-name"}')).toBeNull();
    expect(parseStoredViewingCompany('{"id":"not-a-uuid","name":"BN"}')).toBeNull();
  });

  it("refreshes the stored company from an exact live id", () => {
    const live = { ...stored, name: "BN Performance", tier: "intermediate" };
    expect(resolveViewingCompany(stored, [live])).toEqual(live);
  });

  it("heals a stale id through a unique stable slug", () => {
    const live = { ...stored, id: "00000000-0000-4000-8000-000000000002" };
    expect(resolveViewingCompany(stored, [live])).toEqual(live);
  });

  it("heals a stale id through a unique exact name when no slug is available", () => {
    const withoutSlug = { ...stored, slug: null };
    const live = { ...withoutSlug, id: "00000000-0000-4000-8000-000000000002" };
    expect(resolveViewingCompany(withoutSlug, [live])).toEqual(live);
  });

  it("rejects missing or ambiguous companies instead of selecting the wrong tenant", () => {
    expect(resolveViewingCompany(stored, [])).toBeNull();
    expect(
      resolveViewingCompany(
        { ...stored, slug: null },
        [
          { ...stored, id: "00000000-0000-4000-8000-000000000002", slug: null },
          { ...stored, id: "00000000-0000-4000-8000-000000000003", slug: null },
        ],
      ),
    ).toBeNull();
  });
});

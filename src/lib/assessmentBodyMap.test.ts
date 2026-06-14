import { describe, expect, it } from "vitest";
import { assessmentToBodyRegions } from "./assessmentBodyMap";
import type { BodyRegionId, RegionLimitation } from "@/lib/bodyMap";

function regionsFor(items: RegionLimitation[], type?: RegionLimitation["type"]) {
  return items
    .filter((item) => !type || item.type === type)
    .map((item) => item.region)
    .sort();
}

describe("assessmentToBodyRegions", () => {
  it("maps shortened and weak muscles from prescription_context to muscular limitations", () => {
    const regions = assessmentToBodyRegions({
      prescription_context: {
        shortened_muscles: ["isquiotibiais", "panturrilha"],
        weak_muscles: ["glúteo médio", "vasto medial"],
      },
    });

    expect(regionsFor(regions, "muscular")).toEqual([
      "calves",
      "glutes",
      "hamstrings",
      "quads",
    ]);
  });

  it("maps movement restrictions to articular limitations", () => {
    const regions = assessmentToBodyRegions({
      prescription_context: {
        movement_restrictions: ["limitação de dorsiflexão do tornozelo", "mobilidade torácica reduzida"],
      },
    });

    expect(regions).toEqual(expect.arrayContaining([
      expect.objectContaining({ region: "calves", type: "articular" }),
      expect.objectContaining({ region: "back", type: "articular" }),
    ]));
  });

  it.each([
    ["dorsiflexion_limitation", ["calves"], "articular"],
    ["dynamic_valgus", ["glutes", "quads"], "articular"],
    ["trunk_forward_lean", ["calves", "hamstrings"], "articular"],
    ["butt_wink", ["hamstrings", "lower_back"], "articular"],
    ["pelvic_drop_trendelenburg", ["glutes"], "neural"],
    ["shoulder_protraction_kyphosis", ["chest", "shoulders", "trapezius"], "articular"],
    ["overhead_arm_asymmetry", ["back", "shoulders"], "articular"],
  ] as Array<[string, BodyRegionId[], RegionLimitation["type"]]>)(
    "maps OHS compensation %s",
    (key, expectedRegions, expectedType) => {
      const regions = assessmentToBodyRegions({
        ohs_compensations: [
          {
            key,
            presente: true,
            severidade: "moderada",
            evidencia: "achado de teste",
          },
        ],
      });

      expect(regionsFor(regions, expectedType)).toEqual(expectedRegions.slice().sort());
      expect(regions).toEqual(expect.arrayContaining(
        expectedRegions.map((region) => expect.objectContaining({
          region,
          type: expectedType,
          severity: "moderada",
        })),
      ));
    },
  );

  it("ignores absent OHS compensations", () => {
    expect(assessmentToBodyRegions({
      ohs_compensations: [
        { key: "dynamic_valgus", presente: false, severidade: "severa" },
      ],
    })).toEqual([]);
  });
});

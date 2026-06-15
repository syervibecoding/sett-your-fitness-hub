import { describe, it, expect } from "vitest";
// Caminho antigo (shim em src/lib) — o que o front sempre usou.
import { generateTrainingProgram as viaShim } from "./engine";
import { getVolumeRangeForGroup as volViaShim } from "./volumeRules";
// Fonte única Deno-safe.
import { generateTrainingProgram as viaShared } from "../../../supabase/functions/_shared/prescription/engine.ts";
import { getVolumeRangeForGroup as volViaShared } from "../../../supabase/functions/_shared/prescription/volumeRules.ts";

// B1 — Guard de fonte única: o caminho antigo (src/lib/prescription) deve re-exportar EXATAMENTE
// o engine de supabase/functions/_shared/prescription. Se alguém duplicar lógica em vez de
// re-exportar, estas asserções de identidade quebram (mesma referência de função).
describe("B1 — engine compartilhado (fonte única, sem drift)", () => {
  it("src/lib/prescription/engine re-exporta o MESMO generateTrainingProgram do _shared", () => {
    expect(Object.is(viaShim, viaShared)).toBe(true);
  });

  it("src/lib/prescription/volumeRules re-exporta o MESMO getVolumeRangeForGroup do _shared", () => {
    expect(Object.is(volViaShim, volViaShared)).toBe(true);
  });
});

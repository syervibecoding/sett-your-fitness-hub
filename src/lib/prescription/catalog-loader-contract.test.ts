// ORDEM 044 — Contrato estático do loader de catálogo da edge.
// A edge roda em Deno; este teste lê o arquivo-fonte e verifica invariantes textuais para
// prevenir regressão: catálogo COMPLETO via paginação (sem teto fixo 700), fallback/Anthropic
// preservados, resposta { id, plan } intacta, sem flag ON / cutover. NÃO importa o arquivo Deno.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const EDGE = "supabase/functions/ai-prescribe-workout/index.ts";
const src = readFileSync(EDGE, "utf8");

describe("ORDEM 044 — contrato do loader de catálogo (estático)", () => {
  it("1. não contém .limit(700)", () => {
    expect(src).not.toMatch(/\.limit\(\s*700\s*\)/);
  });

  it("2. loadExerciseCatalog usa paginação via range()", () => {
    expect(src).toMatch(/loadExerciseCatalog/);
    expect(src).toMatch(/\.range\(/);
  });

  it("3. existe constante/lógica de page size", () => {
    expect(src).toMatch(/CATALOG_PAGE_SIZE\s*=\s*\d+/);
  });

  it("4. não há limite fixo < 1000 para exercise_library (nenhum .limit(<1000))", () => {
    const limits = [...src.matchAll(/\.limit\(\s*(\d+)\s*\)/g)].map((m) => Number(m[1]));
    expect(limits.every((n) => n >= 1000)).toBe(true); // idealmente não há nenhum .limit no catálogo
    const pageSize = Number((src.match(/CATALOG_PAGE_SIZE\s*=\s*(\d+)/) || [])[1] || 0);
    expect(pageSize).toBeGreaterThanOrEqual(1000);
  });

  it("5. buildEmergencyFallbackPlan continua presente", () => {
    expect(src).toMatch(/buildEmergencyFallbackPlan/);
  });

  it("6. Anthropic continua presente (fallback de IA preservado)", () => {
    expect(src).toMatch(/ANTHROPIC_API_KEY/);
    expect(src.toLowerCase()).toMatch(/anthropic/);
  });

  it("7. resposta padrão { id, plan } não foi alterada", () => {
    // forma canônica preservada: retorna o id do plano + o plano
    expect(src).toMatch(/id:\s*planId/);
    expect(src).toMatch(/plan:\s*planJson/);
  });

  it("8. nenhuma feature flag foi ligada por padrão (default off preservado)", () => {
    // a flag do shadow segue lida do ambiente com default "off"
    expect(src).toMatch(/PRESCRIPTION_ENGINE_V1/);
    expect(src).toMatch(/\?\?\s*["']off["']/);
  });

  it("9/10. não há cutover para engine novo; shadow/off preservados", () => {
    // o engine só roda em shadow/on por flag; resposta segue do caminho legado (planJson)
    expect(src).toMatch(/engineFlag\s*===\s*["']shadow["']/);
    // não deve existir substituição incondicional do planJson pelo engine
    expect(src).not.toMatch(/planJson\s*=\s*enginePlan/);
  });

  it("paginação acumula páginas e para quando a página vem incompleta", () => {
    expect(src).toMatch(/exerciseRows\.push\(\.\.\.page\)/);
    expect(src).toMatch(/page\.length\s*<\s*CATALOG_PAGE_SIZE/);
  });
});

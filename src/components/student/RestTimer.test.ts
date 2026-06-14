import { describe, it, expect } from "vitest";
import { parseRestSeconds } from "./RestTimer";

describe("parseRestSeconds", () => {
  it("aceita segundos puros e com sufixo", () => {
    expect(parseRestSeconds("90")).toBe(90);
    expect(parseRestSeconds("90s")).toBe(90);
    expect(parseRestSeconds("60 seg")).toBe(60);
  });

  it("interpreta minutos corretamente (bug antigo: '1min' virava 1s)", () => {
    expect(parseRestSeconds("1min")).toBe(60);
    expect(parseRestSeconds("2'")).toBe(120);
    expect(parseRestSeconds("1.5 min")).toBe(90);
  });

  it("interpreta formato mm:ss", () => {
    expect(parseRestSeconds("1:30")).toBe(90);
    expect(parseRestSeconds("2:00")).toBe(120);
  });

  it("nunca retorna 0/NaN (evita divisão por zero na barra de progresso)", () => {
    expect(parseRestSeconds("")).toBe(60);
    expect(parseRestSeconds("descanso")).toBe(60);
    expect(parseRestSeconds(null)).toBe(60);
    expect(parseRestSeconds(undefined)).toBe(60);
    expect(parseRestSeconds(0)).toBeGreaterThanOrEqual(1);
  });

  it("aceita número direto", () => {
    expect(parseRestSeconds(75)).toBe(75);
  });
});

import { describe, expect, it } from "vitest";
import { businessDateYmd } from "./businessDate";

describe("businessDateYmd", () => {
  it("não vira o dia às 21h no horário de Brasília", () => {
    expect(businessDateYmd(new Date("2026-07-19T00:30:00.000Z"))).toBe("2026-07-18");
  });

  it("vira o dia à meia-noite no horário de Brasília", () => {
    expect(businessDateYmd(new Date("2026-07-19T03:00:00.000Z"))).toBe("2026-07-19");
  });
});

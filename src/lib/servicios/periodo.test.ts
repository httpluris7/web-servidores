import { describe, it, expect } from "vitest";
import { masUnMes } from "./periodo";

describe("masUnMes", () => {
  it("suma un mes natural conservando la hora", () => {
    expect(masUnMes("2026-08-29T13:55:49.577Z")).toBe("2026-09-29T13:55:49.577Z");
  });
  it("no se pasa de mes cuando el día no existe", () => {
    expect(masUnMes("2026-01-31T10:00:00.000Z")).toBe("2026-02-28T10:00:00.000Z");
    expect(masUnMes("2028-01-31T10:00:00.000Z")).toBe("2028-02-29T10:00:00.000Z");
    expect(masUnMes("2026-03-31T00:00:00.000Z")).toBe("2026-04-30T00:00:00.000Z");
  });
  it("encadena: 12 meses seguidos vuelven al mismo día del año siguiente", () => {
    let d = "2026-09-05T12:00:00.000Z";
    for (let i = 0; i < 12; i++) d = masUnMes(d);
    expect(d).toBe("2027-09-05T12:00:00.000Z");
  });
});

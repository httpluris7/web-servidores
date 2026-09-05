import { describe, it, expect } from "vitest";
import { añadirLectura, trafico24h, GB } from "./trafico-calculo";

const h = (n: number) => new Date(Date.UTC(2026, 8, 5, 12) - n * 3600_000).toISOString();

describe("trafico24h", () => {
  it("sin 12 h de historial no juzga", () => {
    expect(trafico24h([{ at: h(2), bytes: 0 }, { at: h(0), bytes: 50 * GB }], new Date(h(0)))).toBeNull();
  });
  it("resta el contador de hace 24 h al actual", () => {
    const l = [
      { at: h(30), bytes: 100 * GB },
      { at: h(25), bytes: 150 * GB },
      { at: h(12), bytes: 300 * GB },
      { at: h(0), bytes: 700 * GB },
    ];
    // base = última lectura anterior a 24 h atrás (la de hace 25 h)
    expect(trafico24h(l, new Date(h(0)))).toBe(550 * GB);
  });
  it("con menos de 24 h pero más de 12, usa todo el historial", () => {
    const l = [{ at: h(13), bytes: 10 * GB }, { at: h(0), bytes: 40 * GB }];
    expect(trafico24h(l, new Date(h(0)))).toBe(30 * GB);
  });
});

describe("añadirLectura", () => {
  it("recorta la ventana y reinicia si el contador baja", () => {
    const l = añadirLectura([{ at: h(30), bytes: 5 }, { at: h(20), bytes: 9 }], { at: h(0), bytes: 12 });
    expect(l.map((x) => x.bytes)).toEqual([9, 12]);
    expect(añadirLectura(l, { at: h(-1), bytes: 3 })).toEqual([{ at: h(-1), bytes: 3 }]);
  });
});

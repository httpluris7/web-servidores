import { describe, expect, it } from "vitest";
import { safeInternalPath } from "./utils";

describe("safeInternalPath (anti open-redirect en ?next=)", () => {
  it("acepta rutas internas", () => {
    expect(safeInternalPath("/cuenta")).toBe("/cuenta");
    expect(safeInternalPath("/contratar/vps-pro?x=1#a")).toBe("/contratar/vps-pro?x=1#a");
    expect(safeInternalPath("/es/carrito")).toBe("/es/carrito");
  });
  it("rechaza todo lo que pueda salir del origen", () => {
    for (const bad of [
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "/\\\\evil.com",
      "\\\\evil.com",
      "/%5Cevil.com\\",
      "/javascript:alert(1)",
      "//javascript:alert(1)",
      "/ /evil",
      "/x\n/y",
      "/x\u0000",
      "cuenta",
      "",
      undefined,
      null,
      42,
      "/" + "a".repeat(3000),
    ]) {
      expect(safeInternalPath(bad), String(bad)).toBeNull();
    }
  });
});

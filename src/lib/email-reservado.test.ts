import { describe, expect, it } from "vitest";
import { esDominioReservado, esEmailReservado } from "./email-reservado";

describe("emails reservados (vuln-0006)", () => {
  it("bloquea cualquier buzón del dominio propio y sus subdominios", () => {
    for (const e of [
      "admin@viahost.top",
      "Admin@ViaHost.TOP",
      "soporte+x@viahost.top",
      "billing@viahost.top",
      "abuse@viahost.top",
      "postmaster@mail.viahost.top",
      "cliente@cp.viahost.top",
      "root@viahost.top.",
      " noreply@viahost.top ",
    ]) {
      expect(esEmailReservado(e), e).toBe(true);
    }
  });
  it("deja pasar dominios ajenos, incluidos alias de rol de empresas cliente", () => {
    for (const e of ["admin@empresa.com", "soporte@holycloud.fr", "x@viahost.top.evil.com", "x@notviahost.top", "x@viahosttop"]) {
      expect(esEmailReservado(e), e).toBe(false);
    }
    expect(esDominioReservado("viahost.top")).toBe(true);
    expect(esDominioReservado("viahost.top.evil.com")).toBe(false);
  });
  it("no revienta con entradas raras", () => {
    expect(esEmailReservado("")).toBe(false);
    expect(esEmailReservado("sin-arroba")).toBe(false);
    expect(esEmailReservado("@viahost.top")).toBe(false);
  });
});

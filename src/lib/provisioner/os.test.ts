import { describe, expect, it } from "vitest";
import {
  AI_DEVELOPER_OS,
  OS_DEFAULT,
  OS_OFERTABLES,
  esOfertableParaDisco,
  esReinstalable,
  ofertablesParaPlan,
  ofertablesParaReinstalar,
  osParaPedido,
} from "./os";

const planNormal = { storage: "50 GB NVMe" };
const planAi = { storage: "60 GB NVMe", osFijo: AI_DEVELOPER_OS };

describe("imagen exclusiva de los AI Developer VPS", () => {
  it("no sale en los selectores generales ni se acepta en un plan cualquiera", () => {
    expect(OS_OFERTABLES.some((o) => o.slug === AI_DEVELOPER_OS)).toBe(false);
    expect(esOfertableParaDisco(AI_DEVELOPER_OS, 200)).toBe(false);
    expect(ofertablesParaPlan(planNormal).some((o) => o.slug === AI_DEVELOPER_OS)).toBe(false);
  });

  it("un plan con imagen fijada solo ofrece la suya", () => {
    expect(ofertablesParaPlan(planAi).map((o) => o.slug)).toEqual([AI_DEVELOPER_OS]);
  });

  it("el pedido de un plan AI se aprovisiona SIEMPRE con su imagen, pida lo que pida el navegador", () => {
    expect(osParaPedido(planAi, "debian-12")).toBe(AI_DEVELOPER_OS);
    expect(osParaPedido(planAi, "")).toBe(AI_DEVELOPER_OS);
    expect(osParaPedido(planAi, "windows-server-2022")).toBe(AI_DEVELOPER_OS);
  });

  it("un plan normal no puede pedir la imagen AI: cae al SO por defecto", () => {
    expect(osParaPedido(planNormal, AI_DEVELOPER_OS)).toBe(OS_DEFAULT);
    expect(osParaPedido(planNormal, "debian-12")).toBe("debian-12");
    expect(osParaPedido(planNormal, "no-existe")).toBe(OS_DEFAULT);
  });

  it("reinstalar: solo el servidor de un plan AI puede volver a la imagen AI", () => {
    expect(esReinstalable(AI_DEVELOPER_OS, 60, AI_DEVELOPER_OS)).toBe(true);
    expect(esReinstalable(AI_DEVELOPER_OS, 60, null)).toBe(false);
    expect(esReinstalable("debian-12", 60, AI_DEVELOPER_OS)).toBe(true);
    expect(ofertablesParaReinstalar(60, AI_DEVELOPER_OS)[0]?.slug).toBe(AI_DEVELOPER_OS);
    expect(ofertablesParaReinstalar(60).some((o) => o.slug === AI_DEVELOPER_OS)).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { ubicacionesDePlan } from "./planes-ubicaciones";

const ubic = [
  { slug: "holanda", provisionLocation: "nl-ams" },
  { slug: "germany", provisionLocation: "germany" },
  { slug: "francia", provisionLocation: "" },
];
const planes = [{ ubicacionSlug: undefined }, { ubicacionSlug: "germany" }];

describe("ubicacionesDePlan", () => {
  it("plan global: toda región con provisioner que no tenga gama propia", () => {
    expect(ubicacionesDePlan({ ubicacionSlug: undefined }, planes, ubic)).toEqual(["nl-ams"]);
  });
  it("plan exclusivo: solo su región", () => {
    expect(ubicacionesDePlan({ ubicacionSlug: "germany" }, planes, ubic)).toEqual(["germany"]);
  });
  it("sin gamas propias, el global va a todas las regiones con provisioner", () => {
    expect(ubicacionesDePlan({ ubicacionSlug: undefined }, [{ ubicacionSlug: undefined }], ubic)).toEqual(["nl-ams", "germany"]);
  });
  it("una región sin provisionLocation nunca aparece", () => {
    expect(ubicacionesDePlan({ ubicacionSlug: "francia" }, planes, ubic)).toEqual([]);
  });
});

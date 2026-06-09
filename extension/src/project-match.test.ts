import { describe, expect, it } from "vitest";
import { matchProject } from "./project-match";

describe("matchProject", () => {
  it("matches a folder name to a project exactly, case-insensitive", () => {
    expect(matchProject(["Atrium"], ["Gemmy", "Atrium", "CarGuide"])).toBe("Atrium");
    expect(matchProject(["atrium"], ["Atrium"])).toBe("Atrium");
  });

  it("falls back to a normalized match (punctuation/spacing-insensitive)", () => {
    expect(matchProject(["atrium-cockpit"], ["Atrium Cockpit"])).toBe("Atrium Cockpit");
    expect(matchProject(["car_guide"], ["CarGuide"])).toBe("CarGuide");
    expect(matchProject(["school-sync-app"], ["SchoolSync"])).toBeNull();
  });

  it("prefers an exact match in any folder over a normalized one", () => {
    expect(matchProject(["car-guide", "Atrium"], ["CarGuide", "Atrium", "Car Guide"])).toBe("Atrium");
  });

  it("checks folders in order", () => {
    expect(matchProject(["Gemmy", "Atrium"], ["Atrium", "Gemmy"])).toBe("Gemmy");
  });

  it("returns null when nothing relates", () => {
    expect(matchProject(["some-unrelated-repo"], ["Atrium", "Gemmy"])).toBeNull();
    expect(matchProject([], ["Atrium"])).toBeNull();
    expect(matchProject(["Atrium"], [])).toBeNull();
  });

  it("ignores folders that normalize to nothing", () => {
    expect(matchProject(["---"], ["Atrium"])).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { unitTypeFromAddress } from "./unit-type";

describe("unitTypeFromAddress", () => {
  it("is a Suite when the street number has a trailing letter", () => {
    expect(unitTypeFromAddress("3760B 23 AVE SW")).toBe("Suite");
    expect(unitTypeFromAddress("#105R - 1732 31 ST SW")).toBe("Suite");
  });

  it("is a Townhome for a plain street number", () => {
    expect(unitTypeFromAddress("3760 23 AVE SW")).toBe("Townhome");
    expect(unitTypeFromAddress("#105 - 1732 31 ST SW")).toBe("Townhome");
  });

  it("isn't fooled by a letter elsewhere in the address", () => {
    expect(unitTypeFromAddress("2240 37th ST SW")).toBe("Townhome");
    expect(unitTypeFromAddress("2240B 37th ST SW")).toBe("Suite");
  });
});

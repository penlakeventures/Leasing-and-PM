import { describe, it, expect } from "vitest";
import { isViewableInBrowser } from "./lease-documents";

describe("isViewableInBrowser", () => {
  it("is true for file types browsers can actually render inline", () => {
    expect(isViewableInBrowser("Move In Inspection Report.pdf")).toBe(true);
    expect(isViewableInBrowser("photo.PNG")).toBe(true);
    expect(isViewableInBrowser("photo.jpg")).toBe(true);
    expect(isViewableInBrowser("photo.jpeg")).toBe(true);
  });

  it("is false for a Word document, which always downloads regardless of headers", () => {
    expect(isViewableInBrowser("Residential Lease (Nov 23, 2020).docx")).toBe(false);
    expect(isViewableInBrowser("Addendum to Residential Lease - Galonski.doc")).toBe(false);
  });

  it("is false for anything else, including a file with no extension", () => {
    expect(isViewableInBrowser("Single Key Report")).toBe(false);
    expect(isViewableInBrowser("notes.txt")).toBe(false);
  });
});

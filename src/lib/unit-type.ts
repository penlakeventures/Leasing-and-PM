// Suite vs. Townhome isn't a stored field anywhere yet — it's encoded in
// Alina's own addressing convention instead: a letter stuck directly onto
// the end of the street number marks a suite ("3760B 23 AVE SW", "#105R -
// 1732 31 ST SW"), a plain number next to it is the townhome ("3760 23
// AVE SW", "#105 - 1732 31 ST SW"). Inferred from the address text rather
// than a real field, so it's only as reliable as that convention holds.
export function unitTypeFromAddress(unitNumber: string): "Suite" | "Townhome" {
  const firstToken = unitNumber.split(" ")[0] ?? "";
  return /\d[A-Za-z]$/.test(firstToken) ? "Suite" : "Townhome";
}

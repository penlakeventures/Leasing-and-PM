// Generated from the CMHC compliance tracking spreadsheet the user
// provided. Do not hand-edit; regenerate from source if it changes.
//
// Killarney23 and Glenbrook30 aren't here — that sheet has no
// Market/Affordable column filled in for either project's 16 units.
// Those units keep whatever designation they already had (MARKET,
// the import default) until that data is available.

export type CmhcDesignationRow = {
  project: string;
  unitNumber: string;
  designation: "MARKET" | "AFFORDABLE";
};

export const cmhcDesignations: CmhcDesignationRow[] = [
  { project: "Killarney26", unitNumber: "2640 32 ST SW", designation: "MARKET" },
  { project: "Killarney26", unitNumber: "2640B 32 ST SW", designation: "MARKET" },
  { project: "Killarney26", unitNumber: "3222 26 AVE SW", designation: "MARKET" },
  { project: "Killarney26", unitNumber: "3222B 26 AVE SW", designation: "MARKET" },
  { project: "Killarney26", unitNumber: "3220 26 AVE SW", designation: "MARKET" },
  { project: "Killarney26", unitNumber: "3220B 26 AVE SW", designation: "AFFORDABLE" },
  { project: "Killarney26", unitNumber: "3218 26 AVE SW", designation: "MARKET" },
  { project: "Killarney26", unitNumber: "3218B 26 AVE SW", designation: "AFFORDABLE" },
  { project: "Killarney25", unitNumber: "3102 25 AVE SW", designation: "MARKET" },
  { project: "Killarney25", unitNumber: "3102B 25 AVE SW", designation: "AFFORDABLE" },
  { project: "Killarney25", unitNumber: "3104 25 AVE SW", designation: "MARKET" },
  { project: "Killarney25", unitNumber: "3104B 25 AVE SW", designation: "AFFORDABLE" },
  { project: "Killarney25", unitNumber: "3106 25 AVE SW", designation: "MARKET" },
  { project: "Killarney25", unitNumber: "3106B 25 AVE SW", designation: "MARKET" },
  { project: "Killarney25", unitNumber: "3108 25 AVE SW", designation: "MARKET" },
  { project: "Killarney25", unitNumber: "3108B 25 AVE SW", designation: "MARKET" },
  { project: "Killarney27", unitNumber: "2748 23 AVE SW", designation: "MARKET" },
  { project: "Killarney27", unitNumber: "2748B 23 AVE SW", designation: "MARKET" },
  { project: "Killarney27", unitNumber: "2746 23 AVE SW", designation: "MARKET" },
  { project: "Killarney27", unitNumber: "2746B 23 AVE SW", designation: "AFFORDABLE" },
  { project: "Killarney27", unitNumber: "2744 23 AVE SW", designation: "MARKET" },
  { project: "Killarney27", unitNumber: "2744B 23 AVE SW", designation: "AFFORDABLE" },
  { project: "Killarney27", unitNumber: "2742 23 AVE SW", designation: "MARKET" },
  { project: "Killarney27", unitNumber: "2742B 23 AVE SW", designation: "MARKET" },
  { project: "Inglewood14", unitNumber: "1503 8 AVE SE", designation: "MARKET" },
  { project: "Inglewood14", unitNumber: "1503R 8 AVE SE", designation: "AFFORDABLE" },
  { project: "Inglewood14", unitNumber: "1505 8 AVE SE", designation: "MARKET" },
  { project: "Inglewood14", unitNumber: "1505R 8 AVE SE", designation: "MARKET" },
  { project: "Inglewood14", unitNumber: "1501 8 AVE SE", designation: "MARKET" },
  { project: "Inglewood14", unitNumber: "1501R 8 AVE SE", designation: "AFFORDABLE" },
  { project: "Inglewood14", unitNumber: "802 14 ST SE", designation: "MARKET" },
  { project: "Inglewood14", unitNumber: "802R 14 ST SE", designation: "AFFORDABLE" },
  { project: "Inglewood14", unitNumber: "804 14 ST SE", designation: "MARKET" },
  { project: "Inglewood14", unitNumber: "804R 14 ST SE", designation: "MARKET" },
  { project: "Inglewood14", unitNumber: "806 14 ST SE", designation: "MARKET" },
  { project: "Inglewood14", unitNumber: "806R 14 ST SE", designation: "AFFORDABLE" },
  { project: "Inglewood14", unitNumber: "808 14 ST SE", designation: "MARKET" },
  { project: "Inglewood14", unitNumber: "808R 14 ST SE", designation: "MARKET" },
  { project: "Inglewood14", unitNumber: "810 14 ST SE", designation: "MARKET" },
  { project: "Shaganappi31", unitNumber: "#101 - 1732 31 ST SW", designation: "MARKET" },
  { project: "Shaganappi31", unitNumber: "#101B - 1732 31 ST SW", designation: "AFFORDABLE" },
  { project: "Shaganappi31", unitNumber: "#102 - 1732 31 ST SW", designation: "MARKET" },
  { project: "Shaganappi31", unitNumber: "#102B - 1732 31 ST SW", designation: "AFFORDABLE" },
  { project: "Shaganappi31", unitNumber: "#103 - 1732 31 ST SW", designation: "MARKET" },
  { project: "Shaganappi31", unitNumber: "#103B - 1732 31 ST SW", designation: "MARKET" },
  { project: "Shaganappi31", unitNumber: "#104 - 1732 31 ST SW", designation: "MARKET" },
  { project: "Shaganappi31", unitNumber: "#104B - 1732 31 ST SW", designation: "MARKET" },
  { project: "Shaganappi31", unitNumber: "#105 - 1732 31 ST SW", designation: "MARKET" },
  { project: "Shaganappi31", unitNumber: "#105R - 1732 31 ST SW", designation: "MARKET" },
  { project: "Shaganappi31", unitNumber: "#201 - 1732 31 ST SW", designation: "MARKET" },
  { project: "Shaganappi31", unitNumber: "#201B - 1732 31 ST SW", designation: "MARKET" },
  { project: "Shaganappi31", unitNumber: "#202 - 1732 31 ST SW", designation: "MARKET" },
  { project: "Shaganappi31", unitNumber: "#202B - 1732 31 ST SW", designation: "AFFORDABLE" },
  { project: "Shaganappi31", unitNumber: "#203 - 1732 31 ST SW", designation: "MARKET" },
  { project: "Shaganappi31", unitNumber: "#203B - 1732 31 ST SW", designation: "AFFORDABLE" },
  { project: "Shaganappi31", unitNumber: "#204 - 1732 31 ST SW", designation: "MARKET" },
  { project: "Shaganappi31", unitNumber: "#204B - 1732 31 ST SW", designation: "AFFORDABLE" },
  { project: "Shaganappi31", unitNumber: "#205 - 1732 31 ST SW", designation: "MARKET" },
  { project: "Shaganappi31", unitNumber: "#205R - 1732 31 ST SW", designation: "MARKET" },
];

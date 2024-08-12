import * as d3 from "d3";

import { expect, test } from "vitest";
import { quarter, quarterToIso, yearToIso } from "../src/timeseries";

test("quarter", () => {
  // March 31st
  expect(quarter(new Date(2024, 2, 31))).toBe("1Q 2024");
});

test("quarterToIso", () => {
  expect(quarterToIso("1Q 2024")).toStrictEqual(d3.isoParse("2024-03-31"));
  expect(quarterToIso("1Q 24")).toStrictEqual(d3.isoParse("2024-03-31"));
  expect(quarterToIso("1Q24")).toStrictEqual(d3.isoParse("2024-03-31"));
});

test("yearToIso", () => {
  expect(yearToIso("2024")).toStrictEqual(d3.isoParse("2024-01-01"));
});

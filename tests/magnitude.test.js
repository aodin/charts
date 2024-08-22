import { expect, test } from "vitest";
import { lowerBoundDigits, divideData } from "../src/magnitude";

test("lowerBoundDigits", () => {
  expect(lowerBoundDigits(null)).toBeNull();
  expect(lowerBoundDigits([])).toBeNull();
  expect(lowerBoundDigits([-1, -1, -1, -1])).toBeNull();
  expect(lowerBoundDigits([100, 100, 1000, 1000])).toBe(2);
});

const xyz = [
  { x: "A", y: 1000, z: "A" },
  { x: "B", y: null, z: "C" },
  { x: "B", y: 0, z: "C" },
];

test("divideData", () => {
  const divided = divideData(xyz, 1000);
  expect(divided[0].y).toEqual(1.0);
});

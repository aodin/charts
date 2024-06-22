import { expect, test } from "vitest";
import { lowerBoundDigits } from "../src/magnitude";

test("lowerBoundDigits", () => {
  expect(lowerBoundDigits(null)).toBeNull();
  expect(lowerBoundDigits([])).toBeNull();
  expect(lowerBoundDigits([-1, -1, -1, -1])).toBeNull();
  expect(lowerBoundDigits([100, 100, 1000, 1000])).toBe(2);
});

import { expect, test } from "vitest";
import { quarter } from "../src/timeseries";

test("quarter", () => {
  // March 31st
  expect(quarter(new Date(2024, 2, 31))).toBe("1Q 2024");
});

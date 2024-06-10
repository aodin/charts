import { expect, test } from "vitest";
import { volume, percentChange } from "../src/formats";

test("volume", () => {
  expect(volume(0)).toBeUndefined();
  expect(volume(1e6)).toBe("1M");
  expect(volume(1e9)).toBe("1B");
  expect(volume(1000)).toBe("1,000");
});

test("percent", () => {
  expect(percentChange(1.0)).toBe("+100.00%");
  expect(percentChange(-0.01)).toBe("-1.00%");
});
import { expect, test } from "vitest";
import { volume } from "../formats";

test("volume", () => {
  expect(volume(0)).toBeUndefined();
  expect(volume(1e6)).toBe("1M");
  expect(volume(1e9)).toBe("1B");
});

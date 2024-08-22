import { expect, describe, it, beforeEach, afterEach } from "vitest";

import { className } from "../src/text";

describe("className", () => {
  it("should sanitize class names", () => {
    expect(className(" A ")).toBe("A");
    expect(className(" A TEST")).toBe("A_TEST");
    expect(className(123)).toBe("_123");
    expect(className("U.S. All Grades")).toBe("US_All_Grades");
  });
});

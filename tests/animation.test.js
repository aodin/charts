// @vitest-environment happy-dom
import { expect, describe, it } from "vitest";

import { animatedDashArray, animatedDashOffset } from "../src/animation";

describe("animatedDashArray", () => {
  it("should work with a variety of patterns", () => {
    // Empty patterns
    expect(animatedDashArray(null, 1)).toBe("1 1");
    expect(animatedDashArray([], 1)).toBe("1 1");
    expect(animatedDashArray([0], 1)).toBe("1 1");

    // Dash patterns
    expect(animatedDashArray([4, 2], 12)).toBe("4 2 4 2 0 12");

    // Odd length patterns are duplicated
    expect(animatedDashArray([1, 2, 3], 12)).toBe("1 2 3 1 2 3 0 12");

    // TODO What should be done with zero values in the pattern?
    // animatedDashArray([0, 2, 0], 12)
  });
});

describe("animatedDashOffset", () => {
  it("should work with a variety of patterns", () => {
    // Empty patterns
    expect(animatedDashOffset(null, 1)(1.0)).toBe(0);
    expect(animatedDashOffset([], 1)(1.0)).toBe(0);

    // Dash patterns
    expect(animatedDashOffset([5, 5], 100)(1.0)).toBe(0);
    expect(animatedDashOffset([5, 5], 100)(0)).toBe(100);

    // Odd length patterns are duplicated
    expect(animatedDashOffset([1, 2, 3], 100)(1.0)).toBe(0);
    expect(animatedDashOffset([1, 2, 2], 100)(0)).toBe(100);

    // TODO What should be done with zero values in the pattern?
    // animatedDashOffset([0, 2, 0], 12)
  });
});

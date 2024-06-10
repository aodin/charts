// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Window } from "happy-dom";

import { getDimensions } from "../layout";

describe("Layout", () => {
  beforeEach(() => {
    global.window = new Window();
    global.window.document.write(
      `<!DOCTYPE html><body><div id="chart"></div></body>`,
    );
    global.document = window.document;
  });

  it("should get the correct width and height using getDimensions", () => {
    // NOTE These are just the default minimum dimensions, since the happy-dom
    // layout engine just returns 0 width for all elements
    const [width, height] = getDimensions("#chart");
    expect(width).toBe(400);
    expect(height).toBe(300);
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
  });
});

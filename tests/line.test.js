// @vitest-environment happy-dom
import { expect, describe, it, beforeEach, afterEach } from "vitest";
import { Window } from "happy-dom";

import { Line } from "../src/line";
import { monthly } from "./data";

describe("Line", () => {
  beforeEach(() => {
    global.window = new Window();
    global.window.document.write(
      `<!DOCTYPE html><body><div id="chart"></div></body>`,
    );
    global.document = window.document;
  });

  it("should be rendered on the DOM", () => {
    const line = new Line(monthly);
    line.render("#chart");
    line.enableHover(
      (d) => line.highlight(d.z),
      () => line.noHighlight(),
    );
    expect(line.X.length).toBe(monthly.length);
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
  });
});

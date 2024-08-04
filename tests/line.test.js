// @vitest-environment happy-dom
import { expect, describe, it, beforeEach, afterEach } from "vitest";
import { Window } from "happy-dom";

import {
  Line,
  TimeSeries,
  parse3dArray,
  parseTimeSeries3dArray,
} from "../src/line";
import { items, monthly } from "./data";

describe("Line", () => {
  beforeEach(() => {
    global.window = new Window();
    global.window.document.write(
      `<!DOCTYPE html><body><div id="chart"></div></body>`,
    );
    global.document = window.document;
  });

  it("should be rendered on the DOM", () => {
    const line = Line(items, parse3dArray);
    line.render("#chart");
    line.onEvent(
      (d) => line.highlight(d.z),
      () => line.noHighlight(),
    );
    expect(line.data.length).toBe(monthly.length);
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
  });
});

describe("TimeSeries", () => {
  beforeEach(() => {
    global.window = new Window();
    global.window.document.write(
      `<!DOCTYPE html><body><div id="chart"></div></body>`,
    );
    global.document = window.document;
  });

  it("should be rendered on the DOM", () => {
    const ts = TimeSeries(items, parseTimeSeries3dArray);
    ts.render("#chart");
    ts.onEvent(
      (d) => ts.highlight(d.z),
      () => ts.noHighlight(),
    );
    expect(ts.data.length).toBe(monthly.length);
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
  });
});

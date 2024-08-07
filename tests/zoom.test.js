// @vitest-environment happy-dom
import { expect, describe, it, beforeEach, afterEach } from "vitest";
import { Window } from "happy-dom";

import {
  LineWithZoom,
  TimeSeriesWithZoom,
  parse3dArray,
  parseTimeSeries3dArray,
} from "../src/zoom";
import { items, monthly } from "./data";

describe("LineWithZoom", () => {
  beforeEach(() => {
    global.window = new Window();
    global.window.document.write(
      `<!DOCTYPE html><body><div id="chart"></div></body>`,
    );
    global.document = window.document;
  });

  it("should be rendered on the DOM", () => {
    const line = LineWithZoom(items, parse3dArray);
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

describe("TimeSeriesWithZoom", () => {
  beforeEach(() => {
    global.window = new Window();
    global.window.document.write(
      `<!DOCTYPE html><body><div id="chart"></div></body>`,
    );
    global.document = window.document;
  });

  it("should be rendered on the DOM", () => {
    const ts = TimeSeriesWithZoom(items, parseTimeSeries3dArray);
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

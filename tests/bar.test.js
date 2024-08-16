// @vitest-environment happy-dom
import { expect, describe, it, beforeEach, afterEach } from "vitest";
import { Window } from "happy-dom";

import { Bar, parseTimeSeries3dArray } from "../src/bar";
import { monthly } from "./data";

describe("Bar", () => {
  beforeEach(() => {
    global.window = new Window();
    global.window.document.write(
      `<!DOCTYPE html><body><div id="chart"></div></body>`,
    );
    global.document = window.document;
  });

  it("should be rendered on the DOM", () => {
    const bar = Bar(monthly, parseTimeSeries3dArray);
    bar.render("#chart");
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
  });
});

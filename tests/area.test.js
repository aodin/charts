// @vitest-environment happy-dom
import { expect, describe, it, beforeEach, afterEach } from "vitest";
import { Window } from "happy-dom";

import { Area, parseTimeSeries3dArray } from "../src/area";
import { monthly } from "./data";

describe("Area", () => {
  beforeEach(() => {
    global.window = new Window();
    global.window.document.write(
      `<!DOCTYPE html><body><div id="chart"></div></body>`,
    );
    global.document = window.document;
  });

  it("should be rendered on the DOM", () => {
    const area = Area(monthly, parseTimeSeries3dArray);
    area.render("#chart");
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
  });
});

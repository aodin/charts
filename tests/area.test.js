// @vitest-environment happy-dom
import { expect, describe, it, beforeEach, afterEach } from "vitest";
import { Window } from "happy-dom";

import { Area } from "../src/area";
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
    const area = new Area(monthly, { FONT_SIZE: "20px" });
    area.render("#chart");
    expect(area.X.length).toBe(6); // For area charts, X will only be unique X values
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
  });
});

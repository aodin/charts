// @vitest-environment happy-dom
import { expect, describe, it, beforeEach, afterEach } from "vitest";
import { Window } from "happy-dom";

import { Pie } from "../src/pie";
import { monthly } from "./data";

describe("Pie", () => {
  beforeEach(() => {
    global.window = new Window();
    global.window.document.write(
      `<!DOCTYPE html><body><div id="chart"></div></body>`,
    );
    global.document = window.document;
  });

  it("should be rendered on the DOM", () => {
    const area = Pie(monthly);
    area.render("#chart");
    expect(area.Y.length).toBe(monthly.length);
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
  });
});

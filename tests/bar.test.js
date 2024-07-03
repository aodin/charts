// @vitest-environment happy-dom
import { expect, describe, it, beforeEach, afterEach } from "vitest";
import { Window } from "happy-dom";

import { Bar } from "../src/bar";
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
    const bar = Bar(monthly);
    bar.render("#chart");
    expect(bar.X.length).toBe(6); // For bar charts, X will only be unique X values
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
  });
});

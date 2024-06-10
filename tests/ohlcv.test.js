// @vitest-environment happy-dom
import { expect, describe, it, beforeEach, afterEach } from "vitest";
import { Window } from "happy-dom";

import { OHLCV } from "../ohlcv";
import { candles } from "./data";

describe("OHLCV", () => {
  beforeEach(() => {
    global.window = new Window();
    global.window.document.write(
      `<!DOCTYPE html><body><div id="chart"></div></body>`,
    );
    global.document = window.document;
  });

  it("should be rendered on the DOM", () => {
    const ohlcv = new OHLCV(candles);
    ohlcv.render("#chart");
    expect(ohlcv.X.length).toBe(22);

    function onMove(data) {}
    function onLeave() {}
    ohlcv.enableHover(onMove, onLeave);
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
  });
});

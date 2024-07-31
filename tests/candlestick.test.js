// @vitest-environment happy-dom
import { expect, describe, it, beforeEach, afterEach } from "vitest";
import { Window } from "happy-dom";

import { OHLCV, parseArray } from "../src/candlestick";
import { candles } from "./data";

describe("Candlestick", () => {
  beforeEach(() => {
    global.window = new Window();
    global.window.document.write(
      `<!DOCTYPE html><body><div id="chart"></div></body>`,
    );
    global.document = window.document;
  });

  it("should be rendered on the DOM", () => {
    const ohlcv = OHLCV(candles, parseArray);
    ohlcv.render("#chart");
    expect(ohlcv.data.length).toBe(candles.length);

    function onMove(data) {}
    function onLeave() {}
    ohlcv.onEvent(onMove, onLeave);
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
  });
});

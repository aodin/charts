// @vitest-environment happy-dom
import { expect, describe, it, beforeEach, afterEach } from "vitest";
import { Window } from "happy-dom";

import { OHLCV, parseArrayOHLCV } from "../src/candlestick";
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
    const ohlcv = OHLCV(candles, parseArrayOHLCV);
    ohlcv.render("#chart");
    expect(ohlcv.data.length).toBe(candles.length);

    function onMove(data) {}
    function onLeave() {}
    ohlcv.onEvent(onMove, onLeave);
  });

  if (
    ("should not error if given no data",
    () => {
      const empty = OHLC([]);
      empty.render("#chart");
    })
  );

  afterEach(() => {
    delete global.window;
    delete global.document;
  });
});

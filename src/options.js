import * as d3 from "d3";

export class Options {
  constructor(options = {}) {
    this.ANIMATION_DURATION_MS = 500;

    // Allow either max number of ticks OR spacing
    this.SCREEN_HEIGHT_FRACTION = 0.65;
    this.X_TICK_MAX_COUNT = null;
    this.X_TICK_SPACE = 50; // TODO calculate largest tick space dynamically
    this.X_TICK_SIZE = 4;
    this.X_TICK_GUTTER = 3;
    this.Y_TICK_MAX_COUNT = null;
    this.Y_TICK_SPACE = 40;
    this.Y_TICK_SIZE = 0;
    this.Y_TICK_GUTTER = 5; // Space between tick label and grid
    this.FONT_SIZE = "13px";
    this.COLORS = d3.schemeCategory10;
    this.MIN_Y_AT_ZERO = false;
    this.Y_TICKS_RIGHT = false;

    // OHLC
    this.BAND_PADDING = 0.2; // As a percentage of the band
    this.VOLUME_OPACITY = 0.6;
    this.OHLC_COLORS = ["#1ebc8c", "#b2b2b2", "#f34d27"]; // [up, no change, down]
    this.VOLUME_COLORS = ["#1ebc8c", "#b2b2b2", "#f34d27"]; // [up, no change, down]
    this.HIDE_VOLUME = false;
    this.HIDE_VOLUME_TICKS = false;

    // Line
    this.STROKE_WIDTH = 1.5;
    this.HIGHLIGHT_STROKE_WIDTH = 2.0;
    this.BACKGROUND_OPACITY = 0.3; // When another line is highlighted
    this.DOT_RADIUS = 3.0;

    // Bar
    this.BAR_STROKE_WIDTH = 0.0;

    // Pie
    this.INNER_RADIUS = 0.3;
    this.OUTER_RADIUS = 0.8;

    this.INNER_RADIUS_HOVER = 0.3;
    this.OUTER_RADIUS_HOVER = 0.9;

    // TODO POINTER MOVE FPS
    this.EVENT_FPS = 48;

    // Allow user to override any of the above defaults
    Object.assign(this, options);
  }

  get eventLatency() {
    return parseInt(1000 / this.EVENT_FPS);
  }

  get showVolumeTicks() {
    return !(this.HIDE_VOLUME || this.HIDE_VOLUME_TICKS);
  }

  getYTickCount(height) {
    let count = parseInt(height / this.Y_TICK_SPACE) + 1;
    if (this.Y_TICK_MAX_COUNT && count > this.Y_TICK_MAX_COUNT) {
      count = this.Y_TICK_MAX_COUNT;
    }
    return count;
  }

  getXTickCount(width) {
    let count = parseInt(width / this.X_TICK_SPACE) + 1;
    if (this.X_TICK_MAX_COUNT && count > this.X_TICK_MAX_COUNT) {
      count = this.X_TICK_MAX_COUNT;
    }
    return count;
  }
}

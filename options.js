export class Options {
  constructor(options = {}) {
    this.ANIMATION_DURATION_MS = 500;
    // TODO Allow either number of x-ticks OR minimum x tick spacing
    this.X_TICK_SIZE = 4;
    this.X_TICK_GUTTER = 3;
    this.Y_TICK_SIZE = 0;
    this.Y_TICK_GUTTER = 5; // Space between tick label and grid
    this.FONT_SIZE = "13px";

    // OHLC
    this.BAND_PADDING = 0.2; // As a percentage of the band
    this.VOLUME_OPACITY = 0.6;
    this.OHLC_COLORS = ["#1ebc8c", "#b2b2b2", "#f34d27"]; // [up, no change, down]

    // Line
    this.STROKE_WIDTH = 1.5;
    this.HIGHLIGHT_STROKE_WIDTH = 2.0;
    this.BACKGROUND_OPACITY = 0.3; // When another line is highlighted
    this.DOT_RADIUS = 3.0;

    // Bar
    this.BAR_STROKE_WIDTH = 0.0;

    // TODO POINTER MOVE FPS
    this.EVENT_FPS = 48;

    // Allow user to override any of the above defaults
    Object.assign(this, options);
  }

  get eventLatency() {
    return parseInt(1000 / this.EVENT_FPS);
  }
}

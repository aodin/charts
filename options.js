export class Options {
  constructor(options = {}) {
    this.ANIMATION_DURATION_MS = 500;
    // TODO Allow either number of x-ticks OR minimum x tick spacing
    this.X_TICK_SIZE = 4;
    this.X_TICK_GUTTER = 3;
    this.Y_TICK_SIZE = 0;
    this.Y_TICK_GUTTER = 5; // Space between tick label and grid
    this.BAND_PADDING = 0.2; // As a percentage of the band
    this.VOLUME_OPACITY = 0.6;
    this.OHLC_COLORS = ["#1ebc8c", "#b2b2b2", "#f34d27"]; // [up, no change, down]
    this.FONT_SIZE = "13px";

    // Line charts
    this.STROKE_WIDTH = 1.5;
    this.HIGHLIGHT_STROKE_WIDTH = 2.0;
    this.UNHIGHLIGHTED_OPACITY = 0.3;
    this.DOT_RADIUS = 3.0;

    // TODO POINTER MOVE FPS

    // Allow user to override any of the above defaults
    Object.assign(this, options);
  }
}

// TODO Per chart options?

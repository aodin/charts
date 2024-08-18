import * as d3 from "d3";

import { quantizeScheme } from "./colors";

export class Chart {
  // Base class for charts
  // Currently only has some common chained config methods

  constructor(data, parser = (d) => d) {}

  /* Config chained methods */
  screenHeightPercent(value) {
    this.config.SCREEN_HEIGHT_PERCENT = value;
    return this;
  }

  animationDuration(value) {
    this.config.DURATION_MS = value;
    return this;
  }

  noAnimation() {
    return this.animationDuration(0);
  }
}

export class CategoricalChart extends Chart {
  // Adds additional chained config methods for schemes and hidden state

  constructor(data, parser = (d) => d) {
    // Items can be dynamically hidden from the chart
    super(data, parser);
    this.hidden = new d3.InternSet();
  }

  /* Chained config methods */
  backgroundOpacity(value) {
    this.config.BACKGROUND_OPACITY = value;
    return this;
  }

  yAxisRight() {
    // The y axis ticks and labels will be shown on the right of the chart
    this.config.Y_AXIS_RIGHT = true;
    return this;
  }

  useDiscreteScheme(scheme) {
    this.colors = d3.scaleOrdinal().domain(this.Z).range(scheme);
    return this;
  }

  useContinuousScheme(scheme, min = 0.0, max = 1.0) {
    return this.useDiscreteScheme(
      quantizeScheme(this.Z.length, scheme, min, max),
    );
  }

  invertScheme() {
    this.colors = this.colors.range(this.colors.range().reverse());
    return this;
  }

  startHidden() {
    // The first render will have all items hidden
    this.hidden = new d3.InternSet(this.Z);
    return this;
  }
  /* End chained config methods */

  hide(...z) {
    // Add the given z elements to the hidden set
    this.hidden = this.hidden.union(new d3.InternSet(z));
    this.toggle();
  }

  show(...z) {
    // Remove the given z elements from the hidden set
    this.hidden = this.hidden.difference(new d3.InternSet(z));
    this.toggle();
  }

  setHidden(...z) {
    this.hidden = new d3.InternSet(z);
  }

  hideAll() {
    this.hidden = new d3.InternSet(this.Z);
    this.toggle();
  }

  showAll() {
    this.hidden.clear();
    this.toggle();
  }
}

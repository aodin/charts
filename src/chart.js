import * as d3 from "d3";

import { quantizeScheme } from "./colors";

export class Chart {
  // Base class for charts
  // Currently only has some common chained config methods for layout and animation

  constructor(data, parser = (d) => d) {}

  /* Config chained methods */
  screenHeightPercent(value) {
    this.config.LAYOUT.screenHeightPercent = value;
    return this;
  }

  minHeight(value) {
    this.config.LAYOUT.minHeight = value;
    return this;
  }

  maxHeight(value) {
    this.config.LAYOUT.maxHeight = value;
    return this;
  }

  height(value) {
    return this.minHeight(value).maxHeight(value);
  }

  minWidth(value) {
    this.config.LAYOUT.minWidth = value;
    return this;
  }

  maxWidth(value) {
    this.config.LAYOUT.maxWidth = value;
    return this;
  }

  width(value) {
    return this.minWidth(value).maxWidth(value);
  }

  animationDuration(value) {
    this.config.DURATION_MS = value;
    return this;
  }

  noAnimation() {
    // Set both transition and overlay to 0
    this.config.DELAY_MS = 0;
    return this.animationDuration(0);
  }

  node() {
    // Return the chart svg node. Return null if the chart hasn't been rendered.
    return this.svg ? this.svg.node() : null;
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

  showOnly(...z) {
    // Show only the given z elements, all others will be hidden
    this.hidden = new d3.InternSet(this.Z).difference(new d3.InternSet(z));
    this.toggle();
  }
}

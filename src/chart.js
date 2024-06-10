import * as d3 from "d3";

import { Options } from "./options";
import { getDimensions } from "./layout";

export class Chart {
  // By default, tick format functions are null, which will use the default D3
  // functions. These can be overridden by sub-classes
  tickFormatX = null;
  tickFormatY = null;

  constructor(data, options = {}) {
    this.options = new Options(options);
    this.data = data; // Save the original data in case we want to recalculate
    this.parse(data);
  }

  getMargin(width, height) {
    return {
      top: 15,
      right: 15,
      bottom: 25,
      left: 45,
    };
  }

  getTickValuesX() {
    // D3.js will use the default tick values if null is used
    return null;
  }

  getTickValuesY() {
    // D3.js will use the default tick values if null is used
    return null;
  }

  parse(data) {
    // This data parse is specific to line series data
    this.X = this.parseX(data);
    this.Y = this.parseY(data);
    this.Z = this.parseZ(data);

    // Get distinct items from the set of Z values
    this.items = new Set(this.Z);

    // Is defined?
    // TODO This doesn't work for missing values, only null or undefined
    const defined = (d, i) => !isNaN(this.X[i]) && !isNaN(this.Y[i]);
    this.D = d3.map(data, defined);

    // Grouping
    this.I = d3.range(this.X.length);
    this.grouping = d3.group(this.I, (i) => this.Z[i]); // {name: [indexes...]}

    // Colors
    this.setColors(data);
  }

  formatX(value) {
    // Function for formatting X values, called before sending to hover data callbacks
    return value;
  }

  formatY(value) {
    // Function for formatting Y values, called before sending to hover data callbacks
    return value;
  }

  formatZ(key) {
    // Function for formatting Z values, called before sending to hover data callbacks
    return key;
  }

  parseX(data) {
    return d3.map(data, (d) => d3.isoParse(d[0]));
  }

  parseY(data) {
    return d3.map(data, (d) => d[1]);
  }

  parseZ(data) {
    return d3.map(data, (d) => d[2]);
  }

  getDomainX() {
    return d3.extent(this.X);
  }

  getRangeX(dimensions, margin) {
    return [margin.left, dimensions.width - margin.right];
  }

  getDomainY() {
    return d3.extent(this.Y);
  }

  getRangeY(dimensions, margin) {
    return [dimensions.height - margin.bottom, margin.top];
  }

  setColors(data) {
    this.colors = d3
      .scaleOrdinal()
      .domain(this.items)
      .range(this.options.COLORS);
  }

  getColor(z) {
    return this.colors(z);
  }

  getDimensions(elem) {
    // Given the chart's DOM element, return the desired width and height for drawing
    return getDimensions(elem, { ratio: 0.35 });
  }

  createSVG(elem, dimensions) {
    // Clear any existing chart
    d3.select(elem).selectAll("svg").remove();

    // Create a new chart
    this.svg = d3
      .select(elem)
      .append("svg")
      .attr("viewBox", [0, 0, dimensions.width, dimensions.height])
      .attr("style", "max-width: 100%; height: intrinsic;")
      .style("-webkit-tap-highlight-color", "transparent")
      .style("font-size", this.options.FONT_SIZE)
      .style("overflow", "visible");
  }

  clear() {
    // Clear all drawn elements, must have an element set
    if (this.svg) this.svg.selectAll("*").remove();
  }
}

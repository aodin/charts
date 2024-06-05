import { Options } from "./options";

export class Chart {
  // By default, tick format functions are null, which will use the default D3
  // functions. These can be overridden by sub-classes
  tickFormatX = null;
  tickFormatY = null;

  constructor(data, options = {}) {
    // TODO Or should Options also be a parent class of Chart?
    this.options = new Options(options);

    // Save the original data in case we want to recalculate
    this.data = data;
    this.parse(data);
  }

  getMargin(width, height) {
    // TODO Change default margins passed on width and height - set minima? percent?
    return margin = {
      top: 15,
      right: 15,
      bottom: 25,
      left: 45,
    };
  }

  parse(data) {
    // Parse data object, determine:
    // * x, y, z values as desired types
    // * items lookup by any property
    // * color mapping (discrete / scale)
    // Is defined lookup
    // grouping? for tooltips?

    // This data parse is specific to line series data
    this.X = this.parseX(data);
    this.Y = this.parseY(data);
    this.Z = this.parseZ(data);

    // Get distinct items from the set of Z values
    this.items = new Set(this.Z);

    // Defined?
    // TODO This doesn't work for missing values
    const defined = (d, i) => !isNaN(this.X[i]) && !isNaN(this.Y[i]);
    this.D = d3.map(data, defined);

    // grouping
    this.I = d3.range(this.X.length);
    this.grouping = d3.group(this.I, (i) => this.Z[i]); // {name: [indexes...]}
    // TODO What is grouping used for?

    // Colors
    // TODO discrete v continuous?
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
      .range(d3.schemeCategory10)
  }

  getColor(z) {
    return this.colors(z);
  }

  createSVG(elem, dimensions) {
    // Clear any existing chart
    // document.querySelector(this.elem).innerHTML = '';
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
}

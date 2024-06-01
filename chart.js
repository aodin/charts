import { Options } from "./options";

export class Chart {
  constructor(data, options = {}) {
    // TODO Or should Options also be a parent class of Chart?
    this.options = new Options(options);
    this.parse(data);
  }

  parse(data) {
    // Parse data object, determine:
    // * x, y, z values as desired types
    // * items lookup by any property
    // * color mapping (discrete / scale)
    // Is defined lookup
    // grouping? for tooltips?

    // TODO This data parse is specific to line series data
    this.X = this.parseX(data);
    this.Y = this.parseY(data);
    this.Z = this.parseZ(data);

    // TODO Get distinct z items from the list of Z values or the data if defined
    this.z = data.z;

    // Defined?
    // TODO This doesn't work for missing values
    const defined = (d, i) => !isNaN(this.X[i]) && !isNaN(this.Y[i]);
    this.D = d3.map(data.values, defined);

    // grouping
    this.I = d3.range(this.X.length);
    this.grouping = d3.group(this.I, (i) => this.Z[i]); // {name: [indexes...]}

    // Colors
    // TODO discrete v continuous?
    this.setColors(data);
  }

  parseX(data) {
    return d3.map(data.values, (d) => d3.isoParse(d[0]));
  }

  parseY(data) {
    return d3.map(data.values, (d) => d[1]);
  }

  parseZ(data) {
    return d3.map(data.values, (d) => d[2]);
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
    const z = data.z.reduce((obj, d) => {
      obj[d.name] = d.color;
      return obj;
    }, {});
    // TODO Or just use the z object?
    this.colors = d3
      .scaleOrdinal()
      .domain(Object.keys(z))
      .range(Object.values(z));
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

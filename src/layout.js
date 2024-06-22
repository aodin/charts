import * as d3 from "d3";

/*
Most of the layout operations are placing a rectangle within another rectangle.
What is the most generic way to do this?
*/

export class Padding {
  constructor(top, right, bottom, left) {
    this.top = top;
    this.right = right;
    this.bottom = bottom;
    this.left = left;
  }
}

export class Layout {
  constructor(width, height, padding) {
    this.width = width;
    this.height = height;
    this.padding = padding;
  }

  get rangeX() {
    return [this.padding.left, this.width - this.padding.right];
  }

  get rangeY() {
    return [this.height - this.padding.bottom, this.padding.top];
  }

  get innerWidth() {
    return this.width - this.padding.left - this.padding.right;
  }

  get innerHeight() {
    return this.height - this.padding.top - this.padding.bottom;
  }

  get innerMinimum() {
    return d3.min([this.innerWidth, this.innerHeight]);
  }

  get midpoint() {
    return [this.width / 2, this.height / 2];
  }
}

export function getLayout(
  elem,
  {
    minWidth = 400,
    maxWidth = undefined,
    minHeight = 300,
    maxHeight = undefined,
    screenHeightFraction = 0.5,
  } = {},
) {
  const chart = document.querySelector(elem);
  let width = d3.max([chart.offsetWidth, minWidth]);
  if (maxWidth) {
    width = d3.min([width, maxWidth]);
  }

  let height = window.innerHeight * screenHeightFraction;
  height = d3.max([height, minHeight]);
  if (maxHeight) {
    height = d3.min([height, maxHeight]);
  }
  return new Layout(width, height, new Padding(15, 15, 25, 25));
}

export function maxTickWidth(defaults, height, domain, format, options) {
  // Create a fake axis to test label tick size
  const hidden = d3
    .select("body")
    .append("svg")
    .attr("width", 100)
    .attr("height", height)
    .style("visibility", "hidden"); // "display: none" does not work

  let scale = d3
    .scaleLinear()
    .domain(domain)
    .range([height - defaults.bottom, defaults.top]);

  let axis = d3
    .axisLeft(scale)
    .tickFormat(format) // Can be null
    .tickSize(0)
    .ticks(8); // TODO Number of ticks as an option

  const g = hidden.append("g").style("font-size", options.FONT_SIZE).call(axis);

  // Measure the tick labels
  const labels = g.selectAll(".tick text");

  let width = 0;
  labels.each(function () {
    const bbox = this.getBoundingClientRect(); // TODO Or getBBox?
    if (bbox.width > width) {
      width = bbox.width;
    }
  });

  // Remove the axis
  hidden.remove();

  // Add some padding
  return width + options.X_TICK_GUTTER + 5;
}

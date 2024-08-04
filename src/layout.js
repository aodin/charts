import * as d3 from "d3";

/*
Most of the layout operations are placing a rectangle within another rectangle.
What is the most generic way to do this?
*/

export class Pad {
  constructor(top, right, bottom, left) {
    this.top = top;
    this.right = right;
    this.bottom = bottom;
    this.left = left;
  }
}

export function EqualPad(value) {
  return new Pad(value, value, value, value);
}

export function DefaultPad() {
  return new Pad(15, 15, 25, 25);
}

export class Layout {
  constructor(width, height, pad) {
    this.width = width;
    this.height = height;
    this.pad = pad || DefaultPad();
  }

  get rangeX() {
    return [this.pad.left, this.width - this.pad.right];
  }

  get rangeY() {
    return [this.height - this.pad.bottom, this.pad.top];
  }

  get innerWidth() {
    return this.width - this.pad.left - this.pad.right;
  }

  get innerHeight() {
    return this.height - this.pad.top - this.pad.bottom;
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
    screenHeightPercent = 0.5,
  } = {},
) {
  const chart = document.querySelector(elem);
  let width = d3.max([chart.offsetWidth, minWidth]);
  if (maxWidth) {
    width = d3.min([width, maxWidth]);
  }

  let height = window.innerHeight * screenHeightPercent;
  height = d3.max([height, minHeight]);
  if (maxHeight) {
    height = d3.min([height, maxHeight]);
  }
  return new Layout(width, height, DefaultPad());
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

  // Pad
  return width + options.X_TICK_GUTTER + 5;
}

export function appendSVG(selector, width, height) {
  // Append an SVG element to the selected element
  return d3
    .select(selector)
    .append("svg")
    .attr("viewBox", [0, 0, width, height])
    .attr("style", "max-width: 100%; height: intrinsic;")
    .style("-webkit-tap-highlight-color", "transparent")
    .style("overflow", "visible");
}

export function layoutSVG(selector, config) {
  // Return the SVG elements and its layout
  const elem = d3.select(selector);
  if (!elem.node()) {
    throw new Error(`Unable to find a DOM element for selector '${selector}'`);
  }

  if (elem.node().tagName === "svg") {
    const svg = elem;
    const width = +svg.attr("width");
    const height = +svg.attr("height");
    // TODO Fallback to viewbox
    if (width && height) {
      return [svg, new Layout(width, height)];
    } else {
      // TODO SVGs must have a width or height or the defaults will be returned
      const layout = getLayout(selector, {
        screenHeightPercent: config.SCREEN_HEIGHT_PERCENT,
      });
      return [svg, layout];
    }
  }

  const layout = getLayout(selector, {
    screenHeightPercent: config.SCREEN_HEIGHT_PERCENT,
  });
  const svg = appendSVG(selector, layout.width, layout.height);
  return [svg, layout];
}

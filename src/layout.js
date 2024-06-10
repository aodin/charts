import * as d3 from "d3";

export function getDimensions(
  elem,
  { ratio = 0.2, maxWidth = 1600, minWidth = 400, minHeight = 300 } = {},
) {
  const chart = document.querySelector(elem);
  let width = d3.min([chart.offsetWidth, maxWidth]);
  width = d3.max([chart.offsetWidth, minWidth]);
  let height = d3.max([parseInt(ratio * width), minHeight]);
  return [width, height];
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

  // Add some padding
  return width + options.X_TICK_GUTTER + 5;
}

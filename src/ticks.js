import * as d3 from "d3";

export function maxLabelSize(svg, layout, scale, format = null, cls = "") {
  // Create a fake axis to test label tick size
  // Does not include the tick size or padding, is just the label width
  // This access should be part of the current chart's selection and have the same
  // class values in order to correctly match any CSS that changes label sizes
  const hidden = svg
    .append("g")
    .attr("width", layout.innerWidth)
    .attr("height", layout.innerHeight)
    .attr("class", cls)
    .style("visibility", "hidden"); // "display: none" does not work

  const axis = d3.axisLeft(scale).tickFormat(format); // Can be null
  const g = hidden.call(axis);

  // Measure the tick labels
  const labels = g.selectAll(".tick text");

  let width = 0;
  let height = 0;
  labels.each(function () {
    const elem = this.getBoundingClientRect(); // TODO Or getBBox?
    if (elem.width > width) {
      width = elem.width;
    }
    if (elem.height > height) {
      height = elem.height;
    }
  });

  hidden.remove();
  return [width, height];
}

/*
In order to filter categorical ticks, we need:
1. the width of the largest tick label
2. the total available width for the axes in the layout
3. the interval that will fit that largest label without overlap
4. then filter the available tick labels by the interval
An optional offset can be provided, which will skip the ticks with a lower index
*/
export function filterTicks(ticks, layout, labelWidth, offset = 0) {
  const count = parseInt(layout.innerWidth / (labelWidth + 1)) + 1;
  const interval = d3.max([parseInt(Math.ceil(ticks.length / count)), 1]);
  return d3.filter(ticks, (d, i) => i >= offset && i % interval === 0);
}

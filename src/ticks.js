/*
To filter categorical x ticks, we need to:
1. get the width of the largest x tick label
2. get the total available width for the axes in the layout
3. get the interval that will fit that largest label without overlap
4. filter the available tick labels by the interval
*/


export function maxLabelSize(layout, scale, format=null) {
  // Create a fake axis to test label tick size
  // Does not include the tick size or padding, is just the label with 
  const hidden = d3
    .select("body")
    .append("svg")
    .attr("width", layout.innerWidth)
    .attr("height", layout.innerHeight)
    .style("visibility", "hidden"); // "display: none" does not work

  const axis = d3
    .axisLeft(scale)
    .tickFormat(format) // Can be null

  const g = hidden.append("g").call(axis);

  // Measure the tick labels
  const labels = g.selectAll(".tick text");

  let width = 0;
  let height = 0;
  labels.each(function () {
    const bbox = this.getBoundingClientRect(); // TODO Or getBBox?
    if (bbox.width > width) {
      width = bbox.width;
    }
    if (bbox.height > height) {
      height = bbox.height;
    }
  });

  // Remove the axis
  hidden.remove();
  return [width, height];
}

export function filterTicks(ticks, layout, labelWidth) {
  // TODO - allow a max to be set?
  const count = parseInt(layout.innerWidth / (labelWidth + 1)) + 1;
  const interval = d3.max([parseInt(Math.ceil(ticks.length / count)), 1]);
  return d3.filter(ticks, (d, i) => i % interval === 0);

}

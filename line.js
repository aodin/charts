/*
Line chart

Show multiple items in a line chart.
* X-axis supports any time-scale, e.g. Daily, Monthly, Quarterly, Yearly
* Y-axis supports a value with a formatter, e.g. Units, Percent, Money
* Customizable color scale
* Works with light and dark mode
* Ability to clear and refresh self without losing cached data

Options to:
* Have a tooltip displayed on the chart
* Highlight the selected line, lower the opacity of unselected lines
* Legend items, with optional show/hide controls

Settings:
* line width, highlighted line width

Data format: {}
x: range or items
y: range or items
z: [{name, slug, etc}]
values: [x, y, z]
formatters?

Have functions to automatically detect properties, but always allow them
to be overridden by settings
*/
import { getBounds } from "./bounds";
import { Chart } from "./chart";

export class Line extends Chart {
  render(elem) {
    // Determine the size of the DOM element
    const [width, height] = getBounds(elem, { ratio: 0.35 });
    const dimensions = { width, height };

    // TODO How to adjust margin based on labels?
    const margin = {
      top: 15,
      right: 15,
      bottom: 25,
      left: 45,
    };

    this.createSVG(elem, dimensions);

    // TODO pointer events
    // .on("pointerenter pointermove", throttle(pointermoved, 40)) // ~24fps
    // .on("pointerleave", pointerleft)
    // .on("touchstart", (event) => event.preventDefault());

    // X-axis
    const xScale = d3
      .scaleUtc()
      .domain(this.getDomainX())
      .range(this.getRangeX(dimensions, margin));

    let xAxis = d3
      .axisBottom(xScale)
      // .tickValues(q1s)
      .tickSizeInner(4); // TODO setting for inner tick size
    // .tickFormat(Q);  // TODO setting for tick format

    // TODO Setting for tick padding?
    this.svg
      .append("g")
      .attr(
        "transform",
        `translate(0,${dimensions.height - margin.bottom + 2})`,
      )
      .call(xAxis)
      .call((g) => g.select(".domain").remove());

    // Y-axis
    const yScale = d3
      .scaleLinear()
      .domain(this.getDomainY())
      .range(this.getRangeY(dimensions, margin));

    let yAxis = d3
      .axisLeft(yScale)
      // .tickFormat(percentAxisFormat)
      .tickSize(0)
      .ticks(8); // TODO Number of ticks

    // Grid lines
    this.svg
      .append("g")
      // TODO grid gutter
      .attr("transform", `translate(${margin.left - 10},0)`)
      .call(yAxis)
      .call((g) => g.select(".domain").remove())
      .call((g) =>
        g
          .selectAll(".tick line")
          .clone()
          .attr("x2", dimensions.width - margin.left - margin.right)
          .attr("stroke-opacity", 0.1),
      );

    // line
    const line = d3
      .line()
      .defined((i) => this.D[i])
      .x((i) => xScale(this.X[i]))
      .y((i) => yScale(this.Y[i]));

    // Plot the line
    const path = this.svg
      .append("g")
      .attr("fill", "none")
      .attr("stroke-width", 1.5) // TODO Setting for default with
      .selectAll("path")
      .data(this.grouping)
      .join("path")
      .attr("d", ([, I]) => line(I))
      .attr("stroke", ([d]) => this.getColor(d));
  }

  clear() {
    // Clear all drawn elements, must have an element set
    this.svg.selectAll("*").remove();
  }

  // TODO Where to define pointer/touch callbacks?
  // TODO Where to have legend set?
}

// All settings
// * bounds ratio, default 0.35
// * max height, max width

/*
Animation

path
  .attr("stroke-dasharray", (d, i) => `${lengths[i]} ${lengths[i]}`)
  .attr("stroke-dashoffset", (d, i) => lengths[i])
  .attr("stroke", ([d], i) => this.colors[i])
  .transition()
  .duration(ANIMATION_DURATION_MS)
  .attr("stroke-dashoffset", 0);

*/

/*
Tooltip

// Set text, then set coordinates
if (i > 0) {
  tooltip.html(
    `<strong>${item.name}</strong></br><em>${Q(
      date
    )}</em></br>${percentFormat(value)}`
  );
} else {
  tooltip.html(`<strong>${item.name}</strong></br><em>${Q(date)}</em>`);
}
*/

/*
Legend

// Create a legend with a item for each category built via template
const legend = document.querySelector(elem);
const template = document.querySelector("#legend-item");

this.categories.forEach((label) => {
  const clone = template.content.cloneNode(true);
  clone.querySelector("rect").setAttribute("fill", this.colorScale(label));
  clone.querySelector("span").textContent = label;
  legend.appendChild(clone);
*/

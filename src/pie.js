/*
Pie chart (or donut)
*/
import * as d3 from "d3";

import { Chart } from "./chart";

export class Pie extends Chart {
  render(elem) {
    // If there is no data, do not render
    if (!this.X.length) return;

    // Determine the layout
    this.layout = this.getLayout(elem);
    this.layout.padding = this.getPadding(this.layout);

    this.createSVG(elem, this.layout);

    // Only show the latest quarter of data
    const latest = d3.max(d3.map(this.data, (d) => d[0]));
    const items = d3.filter(this.data, (d) => d[0] === latest);

    const pie = d3
      .pie()
      .sort(null)
      .value((d) => d[1]);

    const arcs = pie(items);

    const arc = d3
      .arc()
      .innerRadius(0)
      .outerRadius(this.layout.innerMinimum / 2);

    const [midX, midY] = this.layout.midpoint;

    const g = this.svg
      .append("g")
      .attr("transform", `translate(${midX},${midY})`);

    const slice = g.selectAll(".slice").data(arcs).enter().append("g");

    slice
      .append("path")
      .attr("d", arc)
      .attr("fill", (d, i) => this.getColor(d.data[2]));

    // Label
    slice
      .append("text")
      .attr("transform", (d) => `translate(${arc.centroid(d)})`);
  }
}

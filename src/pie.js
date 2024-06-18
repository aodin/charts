/*
Pie chart (or donut)
*/
import * as d3 from "d3";

import { Chart } from "./chart";

export class Pie extends Chart {
  get outerRadius() {
    return this.options.OUTER_RADIUS * (this.layout.innerMinimum / 2);
  }

  get innerRadius() {
    return this.options.INNER_RADIUS * (this.layout.innerMinimum / 2);
  }

  get outerRadiusHover() {
    return this.options.OUTER_RADIUS_HOVER * (this.layout.innerMinimum / 2);
  }

  get innerRadiusHover() {
    return this.options.INNER_RADIUS_HOVER * (this.layout.innerMinimum / 2);
  }

  getX(datum) {
    return datum[0];
  }

  getY(datum) {
    return datum[1];
  }

  getZ(datum) {
    return datum[2];
  }

  render(elem) {
    // If there is no data, do not render
    if (!this.X.length) return;

    // Determine the layout
    this.layout = this.getLayout(elem);
    this.layout.padding = this.getPadding(this.layout);

    this.createSVG(elem, this.layout);

    // Only show the latest quarter of data
    const latest = d3.max(d3.map(this.data, this.getX));
    const items = d3.filter(this.data, (d) => this.getX(d) === latest);

    const pie = d3.pie().sort(null).value(this.getY);

    const arcs = pie(items);

    this.arc = d3
      .arc()
      .innerRadius(this.innerRadius)
      .outerRadius(this.outerRadius);

    // Radii when enlarged
    this.arcEnlarge = d3
      .arc()
      .innerRadius(this.innerRadiusHover)
      .outerRadius(this.outerRadiusHover);

    const [midX, midY] = this.layout.midpoint;

    const g = this.svg
      .append("g")
      .attr("transform", `translate(${midX},${midY})`);

    this.slice = g
      .selectAll(".arc")
      .data(arcs)
      .enter()
      .append("g")
      .attr("class", "arc");

    this.slice
      .append("path")
      .attr("d", this.arc)
      .attr("fill", (d, i) => this.getColor(this.getZ(d.data)));

    // Label
    this.slice
      .append("text")
      .attr("transform", (d) => `translate(${this.arc.centroid(d)})`);
  }

  enlarge(z) {
    this.slice
      .selectAll("path")
      .filter((d) => this.getZ(d.data) === z)
      .transition()
      .duration(this.options.ANIMATION_DURATION_MS)
      .attr("d", this.arcEnlarge);
  }

  reset() {
    this.slice
      .selectAll("path")
      .transition()
      .duration(this.options.ANIMATION_DURATION_MS)
      .attr("d", this.arc);
  }

  getLegend() {
    // Return the z items along with their colors
    return d3.map(new Set(this.Z), (d) => {
      return Object.assign({ color: this.getColor(d.key) }, d);
    });
  }

  noHighlight() {
    this.slice
      .transition()
      .duration(this.options.ANIMATION_DURATION_MS)
      .attr("opacity", 1.0);
  }

  highlight(z) {
    this.slice
      .transition()
      .duration(this.options.ANIMATION_DURATION_MS)
      .attr("opacity", (d) => (this.getZ(d.data) === z ? 1.0 : 0.5));
  }

  enableEvents(enter, leave) {
    const pointerenter = (evt, d) => {
      const data = {
        x: this.getX(d.data),
        y: this.getY(d.data),
        z: this.getZ(d.data),
      };

      if (enter) {
        enter.call(this, data, evt, d);
      }
    };

    const pointerleave = (evt, d) => {
      const data = {
        x: this.getX(d.data),
        y: this.getY(d.data),
        z: this.getZ(d.data),
      };

      if (leave) {
        leave.call(this, data, evt, d);
      }
    };

    this.slice
      .on("pointerenter", pointerenter)
      .on("pointerleave", pointerleave);
  }
}

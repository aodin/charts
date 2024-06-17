/*
Line chart
*/
import * as d3 from "d3";

import { Chart } from "./chart";
import { throttle } from "./throttle";

export class Line extends Chart {
  render(elem) {
    // If there is no data, do not render
    if (!this.X.length) return;

    // Determine the layout
    this.layout = this.getLayout(elem);
    this.layout.padding = this.getPadding(this.layout);

    this.createSVG(elem, this.layout);

    // X-axis
    this.xScale = d3
      .scaleUtc()
      .domain(this.getDomainX())
      .range(this.getRangeX(this.layout));

    let xAxis = d3
      .axisBottom(this.xScale)
      .tickValues(this.getTickValuesX())
      .tickFormat(this.tickFormatX)
      .tickSizeInner(this.options.X_TICK_SIZE);

    this.svg
      .append("g")
      .style("font-size", this.options.FONT_SIZE)
      .attr(
        "transform",
        `translate(0,${this.layout.height - this.layout.padding.bottom + this.options.Y_TICK_GUTTER})`,
      )
      .call(xAxis)
      .call((g) => g.select(".domain").remove());

    // Y-axis
    this.yScale = d3
      .scaleLinear()
      .domain(this.getDomainY())
      .range(this.getRangeY(this.layout));

    let yAxis = d3
      .axisLeft(this.yScale)
      .tickValues(this.getTickValuesY())
      .tickFormat(this.tickFormatY)
      .tickSize(0)
      .ticks(this.options.getYTickCount(this.layout.innerHeight));

    // Grid lines
    this.svg
      .append("g")
      .style("font-size", this.options.FONT_SIZE)
      .attr(
        "transform",
        `translate(${this.layout.padding.left - this.options.X_TICK_GUTTER},0)`,
      )
      .call(yAxis)
      .call((g) => g.select(".domain").remove())
      .call((g) =>
        g
          .selectAll(".tick line")
          .clone()
          .attr("stroke", "#888") // Works for black or white background at 40% opacity
          .attr("stroke-opacity", 0.4)
          .attr("transform", `translate(${this.options.X_TICK_GUTTER},0)`)
          .attr("x2", this.layout.innerWidth),
      );

    // Plot the line
    const line = d3
      .line()
      .defined((i) => this.D[i])
      .x((i) => this.xScale(this.X[i]))
      .y((i) => this.yScale(this.Y[i]));

    this.path = this.svg
      .append("g")
      .attr("fill", "none")
      .attr("stroke-width", this.options.STROKE_WIDTH)
      .selectAll("path")
      .data(this.grouping)
      .join("path")
      .attr("d", ([, I]) => line(I))
      .attr("stroke", ([d]) => this.getColor(d));

    // Dot - shows nearest point during pointer events
    this.dot = this.svg.append("g").style("display", "none");
    this.circle = this.dot.append("circle").attr("r", this.options.DOT_RADIUS);
  }

  getLegend() {
    // Return the z items along with their colors
    return d3.map(this.items, (d) => {
      return Object.assign({ color: this.getColor(d.key) }, d);
    });
  }

  placeDot(i) {
    // Place a dot at the given index
    const x = this.xScale(this.X[i]);
    const y = this.yScale(this.Y[i]);
    const z = this.Z[i];
    this.dot.style("display", null).attr("transform", `translate(${x},${y})`);
    this.circle.attr("fill", this.getColor(z));
  }

  hideDot() {
    this.dot.style("display", "none");
  }

  noHighlight() {
    this.path
      .attr("opacity", 1.0)
      .attr("stroke-width", this.options.STROKE_WIDTH);
  }

  highlight(z) {
    // Hide paths that aren't the currently selected path
    this.path
      .attr("opacity", ([elem]) =>
        elem === z ? 1.0 : this.options.BACKGROUND_OPACITY,
      )
      .attr("stroke-width", ([elem]) =>
        elem === z
          ? this.options.HIGHLIGHT_STROKE_WIDTH
          : this.options.STROKE_WIDTH,
      );
  }

  enableHover(move, leave) {
    let prevIndex = null;

    // Determine the closest point to the cursor
    const pointermove = (evt) => {
      const [xm, ym] = d3.pointer(evt);
      const index = d3.least(this.I, (i) =>
        Math.hypot(this.xScale(this.X[i]) - xm, this.yScale(this.Y[i]) - ym),
      );

      // Do not place a tooltip if no point was found
      if (typeof index === "undefined") return;

      // Only trigger the callback when the index changes
      if (prevIndex && prevIndex == index) return;

      this.placeDot(index);

      const x = this.X[index];
      const y = this.Y[index];
      const z = this.Z[index];

      let data = {
        x: x,
        y: y,
        z: z,
        dx: this.xScale(x),
        dy: this.yScale(y),
        fx: this.formatX(x),
        fy: this.formatY(y),
        fz: this.formatZ(z),
      };

      if (move) {
        move.call(this, data);
      }
    };

    const pointerleave = (evt) => {
      this.hideDot();
      if (leave) {
        leave.call(this);
      }
    };

    this.svg
      .on("pointermove", throttle(pointermove, this.options.eventLatency))
      .on("pointerleave", pointerleave)
      .on("touchstart", (evt) => {
        pointermove(evt);
        evt.preventDefault();
      });
  }
}

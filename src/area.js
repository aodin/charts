/*
Area chart
*/
import * as d3 from "d3";

import { Chart } from "./chart";

export class AreaChart extends Chart {
  parse(data) {
    // Get distinct items from the list of Z values
    this.Z = this.parseZ(data);
    this.items = new Set(this.Z);

    // Index the data by x, then by z for each x
    const indexed = d3.index(
      data,
      (d) => d3.isoParse(d[0]),
      (d) => d[2],
    );

    // Build the stack, one array per item, with an elem for each quarter
    this.stack = d3
      .stack()
      .keys(this.items)
      .value(([, group], key) => {
        let item = group.get(key);
        return item ? item[1] : 0;
      })(indexed);

    // Use the stack to determine the x and y-axis domains
    this.X = [...indexed.keys()];
    this.Y = [0, d3.max(this.stack[this.stack.length - 1], (d) => d[1])];

    this.setColors(data);
  }

  getDomainX() {
    return d3.extent(this.X);
  }

  getDomainY() {
    return this.Y;
  }

  render(elem) {
    // Determine the layout
    this.layout = this.getLayout(elem);
    this.layout.pad = this.getPad(this.layout);

    this.createSVG(elem, this.layout);

    // Y-axis
    const yScale = d3
      .scaleLinear()
      .domain(this.getDomainY())
      .range(this.getRangeY(this.layout));

    let yAxis = d3
      .axisLeft(yScale)
      .tickValues(this.getTickValuesY())
      .tickFormat(this.tickFormatY)
      .tickSize(0)
      .ticks(this.options.getYTickCount(this.layout.innerHeight));

    // X-axis
    const xScale = d3
      .scaleUtc()
      .domain(this.getDomainX())
      .range(this.getRangeX(this.layout));

    let xAxis = d3
      .axisBottom(xScale)
      .tickValues(this.getTickValuesX())
      .tickFormat(this.tickFormatX)
      .tickSizeInner(this.options.X_TICK_SIZE);

    // TODO If a category, use the "interval" logic as the OHLCV x-axis

    this.svg
      .append("g")
      .style("font-size", this.options.FONT_SIZE)
      .attr(
        "transform",
        `translate(0,${this.layout.height - this.layout.pad.bottom + this.options.X_TICK_GUTTER})`,
      )
      .call(xAxis)
      .call((g) => g.select(".domain").remove());

    this.svg
      .append("g")
      .style("font-size", this.options.FONT_SIZE)
      .attr(
        "transform",
        `translate(${this.layout.pad.left - this.options.Y_TICK_GUTTER},0)`,
      )
      .call(yAxis)
      .call((g) => g.select(".domain").remove())
      .call((g) =>
        g
          .selectAll(".tick line")
          .clone()
          .attr("stroke", "#888") // Works for black or white background at 40% opacity
          .attr("stroke-opacity", 0.4)
          .attr("x1", this.options.Y_TICK_GUTTER)
          .attr("x2", this.layout.innerWidth + this.options.Y_TICK_GUTTER),
      );

    // Construct an area
    const area = d3
      .area()
      .x((d) => xScale(d.data[0]))
      .y0((d) => yScale(d[0]))
      .y1((d) => yScale(d[1]));

    // Append a path for each series.
    this.svg
      .append("g")
      .selectAll()
      .data(this.stack)
      .join("path")
      .attr("fill", (d) => this.getColor(d.key))
      .attr("d", area);
  }
}

export function Area(data, options) {
  return new AreaChart(data, options);
}

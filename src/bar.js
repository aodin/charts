/*
Bar chart - stacked bars
*/
import * as d3 from "d3";

import { Chart } from "./chart";
import { makeDateFormatter } from "./timeseries";

export class BarChart extends Chart {
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

  barStrokeWidth(width) {
    this.options.BAR_STROKE_WIDTH = width;
    return this;
  }

  bandPadding(value) {
    this.options.BAND_PADDING = value;
    return this;
  }

  // Since the X data is categorical, return all unique values
  getDomainX() {
    return new Set(this.X);
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
    const yRange = this.getRangeY(this.layout);
    const drawHeight = yRange[0] - yRange[1];

    const yScale = d3.scaleLinear().domain(this.getDomainY()).range(yRange);

    let yAxis = d3
      .axisLeft(yScale)
      .tickValues(this.getTickValuesY())
      .tickFormat(this.tickFormatY)
      .tickSize(0)
      .ticks(this.options.getYTickCount(drawHeight));

    // X-axis
    const xRange = this.getRangeX(this.layout);
    const drawWidth = xRange[1] - xRange[0];

    const xScale = d3
      .scaleBand()
      .domain(this.getDomainX())
      .range(xRange)
      .padding(this.options.BAND_PAD)
      .align(0.1);

    // NOTE The date formatter needs to be created because it uses a
    // closure to determine a new year
    // TODO A method to provide custom formatting
    const dateFormatter = makeDateFormatter();
    let xAxis = d3
      .axisBottom(xScale)
      .tickFormat(dateFormatter)
      .tickSizeInner(this.options.X_TICK_SIZE)
      .ticks(this.options.getXTickCount(drawWidth));

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

    // Create a stacked bar chart
    this.svg
      .append("g")
      .selectAll()
      .data(this.stack)
      .join("g")
      .attr("fill", (d) => this.getColor(d.key))
      .selectAll("rect")
      .data((D) => D)
      .join("rect")
      .attr("stroke-width", this.options.BAR_STROKE_WIDTH)
      .attr("x", (d) => xScale(d.data[0]))
      .attr("y", (d) => yScale(d[1]))
      .attr("height", (d) => yScale(d[0]) - yScale(d[1]))
      .attr("width", xScale.bandwidth());
  }
}

export function Bar(data, options) {
  return new BarChart(data, options);
}

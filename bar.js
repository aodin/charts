/*
Area chart
*/
import { getDimensions } from "./layout";
import { Chart } from "./chart";
import { makeDateFormatter } from "./timeseries";

export class Bar extends Chart {
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

  // Since the X data is categorical, return all unique values
  getDomainX() {
    return new Set(this.X);
  }

  getDomainY() {
    return this.Y;
  }

  render(elem) {
    // Determine the size of the DOM element
    const [width, height] = getDimensions(elem, { ratio: 0.35 });
    const dimensions = { width, height };
    const margin = this.getMargin(width, height);

    this.createSVG(elem, dimensions);

    // Y-axis
    const yScale = d3
      .scaleLinear()
      .domain(this.getDomainY())
      .range(this.getRangeY(dimensions, margin));

    let yAxis = d3
      .axisLeft(yScale)
      .tickValues(this.getTickValuesY())
      .tickFormat(this.tickFormatY)
      .tickSize(0)
      .ticks(8);

    // X-axis
    console.log();
    const xScale = d3
      .scaleBand()
      .domain(this.getDomainX())
      .range(this.getRangeX(dimensions, margin))
      .padding(this.options.BAND_PADDING)
      .align(0.1);

    // NOTE The date formatter needs to be created because it uses a
    // closure to determine a new year
    // TODO A method to provide custom formatting
    const dateFormatter = makeDateFormatter();
    let xAxis = d3
      .axisBottom(xScale)
      .tickFormat(dateFormatter)
      .tickSizeInner(this.options.X_TICK_SIZE);

    this.svg
      .append("g")
      .style("font-size", this.options.FONT_SIZE)
      .attr(
        "transform",
        `translate(0,${dimensions.height - margin.bottom + this.options.X_TICK_GUTTER})`,
      )
      .call(xAxis)
      .call((g) => g.select(".domain").remove());

    this.svg
      .append("g")
      .style("font-size", this.options.FONT_SIZE)
      .attr(
        "transform",
        `translate(${margin.left - this.options.Y_TICK_GUTTER},0)`,
      )
      .call(yAxis)
      .call((g) => g.select(".domain").remove())
      .call((g) =>
        g
          .selectAll(".tick line")
          .clone()
          .attr("x1", this.options.Y_TICK_GUTTER)
          .attr(
            "x2",
            dimensions.width -
              margin.right -
              margin.left +
              this.options.Y_TICK_GUTTER,
          )
          .attr("stroke-opacity", 0.1),
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
      .attr("stroke", "white")
      .attr("stroke-width", this.options.BAR_STROKE_WIDTH)
      .attr("x", (d) => xScale(d.data[0]))
      .attr("y", (d) => yScale(d[1]))
      .attr("height", (d) => yScale(d[0]) - yScale(d[1]))
      .attr("width", xScale.bandwidth());
  }
}

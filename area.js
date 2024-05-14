/*
Area chart
*/
import { getBounds } from "./bounds";
import { Chart } from "./chart";

export class Area extends Chart {
  parse(data) {
    // TODO How to build the stack? Use the given category order?
    // TODO Unique z values vs all z values?
    this.Z = d3.map(data.z, (d) => d.name);

    // Index the data by x, then by z for each x
    const indexed = d3.index(
      data.values,
      (d) => d3.isoParse(d[0]),
      (d) => d[2],
    );

    // TODO Where to apply a magnitude?

    // Build the stack, one array per item, with an elem for each quarter
    this.stack = d3
      .stack()
      .keys(this.Z)
      .value(([, group], key) => {
        let item = group.get(key);
        return item ? item[1] : 0;
      })(indexed);

    // Use the stack to determine the x and y-axis domains
    this.X = [...indexed.keys()];
    this.Y = [0, d3.max(this.stack[this.stack.length - 1], (d) => d[1])];

    this.setColors(data);
  }

  parseZ(data) {
    return d3.map(data.values, (d) => d[2]);
  }

  getDomainX() {
    return d3.extent(this.X);
  }

  getDomainY() {
    return this.Y;
  }

  setColors(data) {
    this.colors = data.z.reduce((obj, d) => {
      obj[d.name] = d.color;
      return obj;
    }, {});
  }

  getColor(z) {
    return this.colors[z];
  }

  render(elem) {
    // Determine the size of the DOM element
    const [width, height] = getBounds(elem, { ratio: 0.35 });
    const dimensions = { width, height };

    this.createSVG(elem, dimensions);

    // TODO How to adjust margin based on labels?
    const margin = {
      top: 15,
      right: 15,
      bottom: 25,
      left: 45,
    };

    // Y-axis
    const yScale = d3
      .scaleLinear()
      .domain(this.getDomainY())
      .range(this.getRangeY(dimensions, margin));

    let yAxis = d3
      .axisLeft(yScale)
      // .tickFormat(yAxisFormat)
      .tickSize(0)
      .ticks(8);

    // X-axis
    const xScale = d3
      .scaleUtc()
      .domain(this.getDomainX())
      .range(this.getRangeX(dimensions, margin));

    let xAxis = d3
      .axisBottom(xScale)
      // .tickValues(qs)
      .tickSizeInner(4);
    // .tickFormat(ShortQ);

    this.svg
      .append("g")
      .attr(
        "transform",
        `translate(0,${dimensions.height - margin.bottom + 2})`,
      )
      .call(xAxis)
      .call((g) => g.select(".domain").remove());

    const GRID_OFFSET = 10; // TODO Setting

    this.svg
      .append("g")
      .attr("transform", `translate(${margin.left - GRID_OFFSET},0)`)
      .call(yAxis)
      .call((g) => g.select(".domain").remove())
      .call((g) =>
        g
          .selectAll(".tick line")
          .clone()
          .attr("x1", GRID_OFFSET)
          .attr(
            "x2",
            dimensions.width - margin.right - margin.left + GRID_OFFSET,
          )
          .attr("stroke-opacity", 0.1),
      );

    // Construct an area shape.
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
      .attr("d", area)
      .append("title")  // TODO Option for title
      .text((d) => d.key);
  }
}

/*
Bar chart
*/
import * as d3 from "d3";

import { quantizeScheme } from "./colors";
import { layoutSVG } from "./layout";
import { className } from "./text";
import { maxLabelSize, filterTicks } from "./ticks";
import { makeDateFormatter } from "./timeseries";
import { throttle } from "./throttle";

export function parse3dArray(d) {
  return {
    x: d[0],
    y: d[1],
    z: d[2],
  };
}

export function parseTimeSeries3dArray(d) {
  return {
    x: d3.isoParse(d[0]),
    y: d[1],
    z: d[2],
  };
}

export class BarChart {
  xFormat = null;
  yFormat = null;

  // Bar charts expect data is the format [{x, y, z}...]
  // Specify a parser or override parse() if your input data is in a different format
  constructor(data, parser = (d) => d) {
    // Default config
    this.config = {
      SCREEN_HEIGHT_PERCENT: 0.5,
      BAND_PAD: 0.2,
      BAR_STROKE_WIDTH: 1.0,
      DURATION_MS: 500,
      BACKGROUND_OPACITY: 0.3, // Opacity when another line is highlighted
      Y_AXIS_RIGHT: false,
      COLORS: d3.schemeCategory10, // TODO There's no way to change the default yet

      // Additional margins
      MARGIN_TICK: 3,
    };

    // Items can be dynamically hidden from the chart
    this.hidden = new d3.InternSet();

    this.data = this.parseData(data, parser);
    this.items = this.parseItems(data);
    this.Z = this.parseZ(data);
    this.colors = this.setColors(data);
  }

  parseData(data, parser) {
    return d3.map(data, parser);
  }

  parseItems(data) {
    // By default, items will be built from unique z values. To specify the items
    // instead (and optionally provide a color) override this method
    return Array.from(new d3.InternSet(d3.map(this.data, (d) => d.z)));
  }

  parseZ(data) {
    return this.items;
  }

  setColors(data) {
    return d3.scaleOrdinal().domain(this.Z).range(this.config.COLORS);
  }

  /* Config chained methods */
  screenHeightPercent(value) {
    this.config.SCREEN_HEIGHT_PERCENT = value;
    return this;
  }

  animationDuration(value) {
    this.config.DURATION_MS = value;
    return this;
  }

  noAnimation() {
    return this.animationDuration(0);
  }

  backgroundOpacity(value) {
    this.config.BACKGROUND_OPACITY = value;
    return this;
  }

  yAxisRight() {
    // The y axis ticks and labels will be shown on the right of the chart
    this.config.Y_AXIS_RIGHT = true;
    return this;
  }

  useDiscreteScheme(scheme) {
    this.colors = d3.scaleOrdinal().domain(this.Z).range(scheme);
    return this;
  }

  useContinuousScheme(scheme, min = 0.0, max = 1.0) {
    return this.useDiscreteScheme(
      quantizeScheme(this.Z.length, scheme, min, max),
    );
  }

  invertScheme() {
    this.colors = this.colors.range(this.colors.range().reverse());
    return this;
  }

  startHidden() {
    // The first render will have all items hidden
    this.hidden = new d3.InternSet(this.Z);
    return this;
  }

  bandPadding(value) {
    this.config.BAND_PAD = value;
    return this;
  }

  barOutline(value) {
    this.config.BAR_STROKE_WIDTH = value;
    return this;
  }

  noBarOutline() {
    return this.barOutline(0.0);
  }
  /* End config chained methods */

  getStack(data) {
    // Index the data by x, then by z for each x
    const indexed = d3.index(
      data,
      (d) => d.x,
      (d) => d.z,
    );

    // Build the stack, one array per item, with an elem for each quarter
    const stack = d3
      .stack()
      .keys(this.Z)
      .value(([, group], key) => {
        const item = group.get(key);
        return item && item.y ? item.y : 0;
      })(indexed);

    // Largest items are returned first, since the stack areas are all drawn from zero
    return stack.reverse();
  }

  get stack() {
    // Only visible data - hidden items are all zero
    return this.getStack(this.visibleData);
  }

  get fullStack() {
    // All data
    return this.getStack(this.data);
  }

  get legend() {
    // Return the z items along with their colors
    return d3.map(this.Z.slice().reverse(), (d) => {
      return { key: d, color: this.colors(d) };
    });
  }

  get visibleData() {
    // TODO memoization
    // Set hidden values to zero
    return d3.map(this.data, (d) =>
      this.hidden.has(d.z) ? { x: d.x, y: 0, z: d.z } : d,
    );
  }

  get xDomain() {
    // By default, don't re-calculate the x-axis
    // Return all unique x values
    return Array.from(new d3.InternSet(d3.map(this.data, (d) => d.x)));
  }

  get yDomain() {
    // Always show the full y Axis
    return [0, d3.max(this.fullStack[0], (d) => d[1])];
  }

  get xScale() {
    return d3
      .scaleBand()
      .domain(this.xDomain)
      .range([0, this.layout.innerWidth])
      .padding(this.config.BAND_PAD)
      .align(0.1);
  }

  get yScale() {
    return d3
      .scaleLinear()
      .domain(this.yDomain)
      .range([this.layout.innerHeight, 0])
      .nice();
  }

  defined(d, i) {
    // By default, all points are considered to be defined
    return true;
  }

  xAxis(g, x) {
    g.call(d3.axisBottom(x).tickSize(4).tickFormat(this.xFormat));
  }

  yAxis(g, y) {
    if (this.config.Y_AXIS_RIGHT) {
      g.call(d3.axisRight(y).tickSize(0).tickFormat(this.yFormat));
    } else {
      g.call(d3.axisLeft(y).tickSize(0).tickFormat(this.yFormat));
    }
  }

  grid(g, x, y) {
    // Separating the grid from the axes allows more control of its positioning
    g.call(d3.axisLeft(y).tickSize(-this.layout.innerWidth).tickFormat(""));
  }

  updateLayout() {
    // Scales are needed to calculate the axes size, which may change layout and
    // require scales to be re-calculated
    const [xLabelWidth, xLabelHeight] = maxLabelSize(
      this.svg,
      this.layout,
      this.xScale,
      this.xFormat,
      "x axis",
    );
    this.layout.pad.bottom = d3.max([this.layout.pad.bottom, xLabelHeight]);

    const [yLabelWidth, yLabelHeight] = maxLabelSize(
      this.svg,
      this.layout,
      this.yScale,
      this.yFormat,
      "y axis",
    );

    if (this.config.Y_AXIS_RIGHT) {
      this.layout.pad.right = d3.max([
        this.layout.pad.right,
        yLabelWidth + this.config.MARGIN_TICK + 5,
      ]);
      // The default axes has a pretty large left pad - if using a right axes this
      // left pad can be reduced, but we still need room for the x-scale tick labels
      this.layout.pad.left = 15;
    } else {
      this.layout.pad.left = d3.max([
        this.layout.pad.left,
        yLabelWidth + this.config.MARGIN_TICK + 5,
      ]);
    }
  }

  render(selector) {
    // If there is no data, do not render
    if (!this.data.length) return;

    // The selector can either be for an:
    // 1. SVG element with width and height attributes
    // 2. HTML element that has an intrinsic width - an SVG element will be created
    [this.svg, this.layout] = layoutSVG(selector, this.config);

    // Create fake axes to measure label sizes and update layout
    this.updateLayout();

    this.x = this.xScale;
    this.y = this.yScale;

    // Start with the SVG visible - this can be set to 0 for "fade in"
    this.svg.attr("opacity", 1.0);

    // Create a clip path to hide any overflow content
    this.svg
      .append("defs")
      .append("clipPath")
      .attr("id", "inner-clip-path")
      .append("rect")
      .attr("width", this.layout.width)
      .attr("height", this.layout.height);

    this.svg.attr("clip-path", "url(#inner-clip-path)");

    this.gx = this.svg
      .append("g")
      .attr("class", "x axis")
      .attr(
        "transform",
        `translate(${this.layout.pad.left},${this.layout.innerHeight + this.layout.pad.top})`,
      );

    let yTransform = `translate(${this.layout.pad.left - this.config.MARGIN_TICK},${this.layout.pad.top})`;
    if (this.config.Y_AXIS_RIGHT) {
      yTransform = `translate(${this.layout.pad.left + this.layout.innerWidth + this.config.MARGIN_TICK},${this.layout.pad.top})`;
    }

    this.gy = this.svg
      .append("g")
      .attr("class", "y axis")
      .attr("transform", yTransform);

    this.gGrid = this.svg
      .append("g")
      .attr("class", "grid")
      .attr(
        "transform",
        `translate(${this.layout.pad.left},${this.layout.pad.top})`,
      );

    const gInner = this.svg
      .append("g")
      .attr("class", "inner")
      .attr(
        "transform",
        `translate(${this.layout.pad.left}, ${this.layout.pad.top})`,
      );

    // Set initial state
    this.gx.call(this.xAxis.bind(this), this.x).attr("opacity", 1.0);
    this.gy.call(this.yAxis.bind(this), this.y);
    this.gGrid.call(this.grid.bind(this), this.x, this.y);

    this.slots = gInner
      .append("g")
      .selectAll()
      .data(this.stack)
      .join("g")
      .attr("fill", (d) => this.colors(d.key))
      .attr("class", (d) => className(d.key));

    this.bars = this.slots
      .selectAll("rect")
      .data((D) => D)
      .join("rect")
      .attr("stroke-width", this.config.BAR_STROKE_WIDTH)
      .attr("x", (d, i) => this.x(d.data[0]))
      .attr("y", (d) => this.layout.innerHeight)
      .attr("height", (d) => 0)
      .attr("width", this.x.bandwidth());

    this.update(this.x, this.y);
  }

  update(x, y) {
    this.slots.data(this.stack);
    this.bars
      .data((D) => D)
      .transition()
      .duration(this.config.DURATION_MS)
      .attr("stroke-width", this.config.BAR_STROKE_WIDTH)
      .attr("x", (d, i) => this.x(d.data[0]))
      .attr("y", (d) => this.y(d[1]))
      .attr("height", (d) => this.y(d[0]) - this.y(d[1]))
      .attr("width", this.x.bandwidth());
  }

  noHighlight() {}

  highlight(z) {}

  onEvent(move, leave) {
    const xs = [...d3.group(this.data, (d) => d.x).keys()];
    const coords = d3.map(xs, this.x);

    // Organize the data by key and x
    const indexed = d3.index(
      this.data,
      (d) => d.z,
      (d) => d.x,
    );

    const pointermove = (evt, d) => {
      let [xm, ym] = d3.pointer(evt);
      const index = d3.bisectCenter(coords, xm);
      const point = indexed.get(d.key).get(xs[index]);

      // Data the will provided to the callback
      const data = {
        x: point.x,
        y: point.y,
        z: point.z,
        dx: xm + this.layout.pad.left,
        dy: ym + this.layout.pad.top,
      };
      if (move) {
        move.call(this, data, evt);
      }
    };

    const pointerleave = (evt, d) => {
      if (leave) {
        leave.call(this, d.key);
      }
    };

    this.bars
      .on("pointermove", throttle(pointermove, 20.83)) // 48 fps
      .on("pointerleave", pointerleave);
  }

  hide(...z) {
    // Add the given z elements to the hidden set
    this.hidden = this.hidden.union(new d3.InternSet(z));
    this.toggle();
  }

  show(...z) {
    // Remove the given z elements from the hidden set
    this.hidden = this.hidden.difference(new d3.InternSet(z));
    this.toggle();
  }

  setHidden(...z) {
    this.hidden = new d3.InternSet(z);
  }

  hideAll() {
    this.hidden = new d3.InternSet(this.Z);
    this.toggle();
  }

  showAll() {
    this.hidden.clear();
    this.toggle();
  }

  toggle() {
    this.update(this.x, this.y);
  }
}

export function Bar(data, parser) {
  return new BarChart(data, parser);
}

export class TimeSeriesBarChart extends BarChart {
  constructor(data, parser) {
    super(data, parser);
    this.xLabelWidth = 10;
  }

  // TODO How to better integrate with xFormat?
  makeDateFormatter() {
    return makeDateFormatter();
  }

  // TODO Declaring an xFormat getter doesn't override the xFormat attribute?
  get xFormat() {
    return makeDateFormatter();
  }

  get xValues() {
    return filterTicks(this.xDomain, this.layout, this.xLabelWidth);
  }

  xAxis(g, x) {
    g.call(
      d3
        .axisBottom(x)
        .tickSize(4)
        .tickValues(this.xValues)
        .tickFormat(this.makeDateFormatter()),
    );
  }

  updateLayout() {
    // Scales are needed to calculate the axes size, which may change layout and
    // require scales to be re-calculated
    const [xLabelWidth, xLabelHeight] = maxLabelSize(
      this.svg,
      this.layout,
      this.xScale,
      this.makeDateFormatter(),
      "x axis",
    );
    this.xLabelWidth = xLabelWidth;
    this.layout.pad.bottom = d3.max([this.layout.pad.bottom, xLabelHeight]);

    const [yLabelWidth, yLabelHeight] = maxLabelSize(
      this.svg,
      this.layout,
      this.yScale,
      this.yFormat,
      "y axis",
    );

    if (this.config.Y_AXIS_RIGHT) {
      this.layout.pad.right = d3.max([
        this.layout.pad.right,
        yLabelWidth + this.config.MARGIN_TICK + 5,
      ]);
      // The default axes has a pretty large left pad - if using a right axes this
      // left pad can be reduced, but we still need room for the x-scale tick labels
      this.layout.pad.left = 15;
    } else {
      this.layout.pad.left = d3.max([
        this.layout.pad.left,
        yLabelWidth + this.config.MARGIN_TICK + 5,
      ]);
    }
  }

  sortData(data) {
    data.sort((a, b) => a.x - b.x);
    return data;
  }

  parseData(data, parser) {
    // Sort timeseries data in ascending order
    return this.sortData(super.parseData(data, parser));
  }
}

export function TimeSeriesBar(data, parser) {
  return new TimeSeriesBarChart(data, parser);
}

export class TimeSeriesBarSharesChart extends TimeSeriesBarChart {
  yFormat = d3.format(".0%");

  constructor(data, parser) {
    super(data, parser);

    // Determine the total per x
    this.totals = d3.rollup(
      this.data,
      (v) => d3.sum(v, (d) => d.y),
      (d) => d.x,
    );
  }

  // Use the stack to calculate shares
  getStack(data) {
    // Index the data by x, then by z for each x
    const indexed = d3.index(
      data,
      (d) => d.x,
      (d) => d.z,
    );

    // Build the stack, one array per item, with an elem for each quarter
    const stack = d3
      .stack()
      .keys(this.Z)
      .value(([, group], key) => {
        const item = group.get(key);
        const total = this.totals.get(item.x);
        return item && item.y && total ? item.y / total : 0;
      })(indexed);

    // Largest items are returned first, since the stack are all drawn from zero
    return stack.reverse();
  }
}

export function TimeSeriesBarShares(data, parser) {
  return new TimeSeriesBarSharesChart(data, parser);
}

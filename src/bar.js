/*
Bar chart
*/
import * as d3 from "d3";

import { CategoricalChart } from "./chart";
import { layoutSVG } from "./layout";
import { parse3dArray, parseTimeSeries3dArray } from "./parsers";
import { className } from "./text";
import { maxLabelSize, filterTicks } from "./ticks";
import { makeDateFormatter } from "./timeseries";
import { throttle } from "./throttle";

export { parse3dArray, parseTimeSeries3dArray };

function consistentOrderDiverging(fullStack) {
  // NOTE getStack() reverses the stack
  let stack = fullStack.slice().reverse();
  return function (series, order) {
    if (!((n = series.length) > 0)) return;
    for (
      var i, j = 0, prev, d, dy, yp, yn, n, m = series[order[0]].length;
      j < m;
      ++j
    ) {
      for (yp = yn = 0, i = 0; i < n; ++i) {
        if ((dy = (d = series[order[i]][j])[1] - d[0]) > 0) {
          (d[0] = yp), (d[1] = yp += dy);
        } else if (dy < 0) {
          (d[1] = yn), (d[0] = yn += dy);
        } else {
          // If the item is zero, place it on the correct stack for its full value
          if ((prev = stack[i][j][0]) > 0) {
            (d[0] = yp), (d[1] = yp += dy);
          } else if (prev < 0) {
            (d[1] = yn), (d[0] = yn += dy);
          } else {
            (d[0] = 0), (d[1] = dy);
          }
        }
      }
    }
  };
}

export class BarChart extends CategoricalChart {
  xFormat = null;
  yFormat = null;

  // Bar charts expect data is the format [{x, y, z}...]
  // Specify a parser if your input data is in a different format
  constructor(data, parser = (d) => d) {
    super(data, parser);
    // Default config
    this.config = {
      SCREEN_HEIGHT_PERCENT: 0.5,
      BAND_PAD: 0.2,
      BAR_STROKE_WIDTH: 1.0,
      DURATION_MS: 500,
      BACKGROUND_OPACITY: 0.3, // Opacity when another line is highlighted
      Y_AXIS_RIGHT: false,
      COLORS: d3.schemeCategory10,
      STACK_ORDER: d3.stackOrderNone, // E.g. stackOrderAppearance
      STACK_OFFSET: d3.stackOffsetDiverging, // E.g. stackOffsetDiverging, stackOffsetNone

      // Additional margins
      MARGIN_TICK: 3,
    };

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
      })
      .offset(this.config.STACK_OFFSET)
      .order(this.config.STACK_ORDER)(indexed);

    // Largest items are returned first, since the stack areas are all drawn from zero
    return stack.reverse();
  }

  get stack() {
    // Only visible data - hidden items are all zero
    return this.getStack(this.visibleData);
  }

  get fullStack() {
    // All data
    return this._fullStack;
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
    return d3.extent(this.fullStack.flat().flat());
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

  groupClass(d, i) {
    return className(d.key);
  }

  barClass(d, i) {
    return "";
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

    // Calculate the full stack and cache it
    this._fullStack = this.getStack(this.data);
    this.config.STACK_OFFSET = consistentOrderDiverging(this._fullStack);

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

    // First items drawn are lower layers
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

    // Set initial state
    this.gx.call(this.xAxis.bind(this), this.x).attr("opacity", 1.0);
    this.gy.call(this.yAxis.bind(this), this.y);
    this.gGrid.call(this.grid.bind(this), this.x, this.y);

    this.groups = gInner
      .append("g")
      .selectAll()
      .data(this.stack)
      .join("g")
      .attr("fill", (d) => this.colors(d.key))
      .attr("class", this.groupClass)
      .attr("opacity", 1.0);

    this.bars = this.groups
      .selectAll("rect")
      .data((D) => D)
      .join("rect")
      .attr("class", this.barClass)
      .attr("stroke-width", this.config.BAR_STROKE_WIDTH)
      .attr("x", (d) => this.x(d.data[0]))
      .attr("y", (d) => this.y(0))
      .attr("height", (d) => 0)
      .attr("width", this.x.bandwidth());

    this.update(this.x, this.y);
  }

  update(x, y) {
    this.groups.data(this.stack);
    this.bars
      .data((D) => D)
      .transition()
      .duration(this.config.DURATION_MS)
      .attr("stroke-width", this.config.BAR_STROKE_WIDTH)
      .attr("x", (d, i) => this.x(d.data[0]))
      .attr("y", (d) => (d[1] > d[0] ? this.y(d[1]) : this.y(d[0])))
      .attr("height", (d) => {
        if (d[1] > d[0]) {
          return this.y(d[0]) - this.y(d[1]);
        }
        return this.y(d[1]) - this.y(d[0]);
      });
  }

  noHighlight() {
    this.groups.attr("opacity", 1.0);
  }

  highlight(z) {
    this.groups.attr("opacity", (d) =>
      d.key === z ? 1.0 : this.config.BACKGROUND_OPACITY,
    );
  }

  onEvent(move, leave) {
    const pointermove = (evt, d) => {
      let [xm, ym] = d3.pointer(evt);

      // TODO Is this really the best way to get the data?
      const x = d.data[0];
      const y = d[1] - d[0];
      const z = d3.select(evt.srcElement.parentNode).data()[0].key;

      // Data the will provided to the callback
      const data = {
        x: x,
        y: y,
        z: z,
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
  // NOTE Although d3.stackOffsetExpand works great for static charts, we need a
  // different strategy to handle dynamic hiding and showing of data
  // Use d3.stackOffsetExpand if you want the visible items to always total 100%
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

  get yDomain() {
    // Share charts will always be 0 to 1.0
    return [0.0, 1.0];
  }
}

export function TimeSeriesBarShares(data, parser) {
  return new TimeSeriesBarSharesChart(data, parser);
}

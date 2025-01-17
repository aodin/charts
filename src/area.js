/*
Area chart
*/
import * as d3 from "d3";

import { CategoricalChart } from "./chart";
import { layoutSVG } from "./layout";
import { parse3dArray, parseTimeSeries3dArray } from "./parsers";
import { className } from "./text";
import { throttle } from "./throttle";
import { maxLabelSize } from "./ticks";
import { placeTooltip, placeTooltipTop } from "./tooltip";

export { parse3dArray, parseTimeSeries3dArray, placeTooltip, placeTooltipTop };

// Clip paths require a unique ID
let uniqueID = 0;

export class AreaChart extends CategoricalChart {
  xFormat = null;
  yFormat = null;

  // Area charts expect data is the format [{x, y, z}...]
  // Specify a parser if your input data is in a different format
  constructor(data, parser = (d) => d) {
    super(data, parser);

    // Default config
    this.config = {
      LAYOUT: {},
      DURATION_MS: 500,
      FPS: 48,
      BACKGROUND_OPACITY: 0.3, // Opacity when another line is highlighted
      Y_AXIS_RIGHT: false,
      COLORS: d3.schemeCategory10,
      OVERFLOW: false, // Allow overflow of the SVG element

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
    // TODO SHould legend order be reversed?
    return d3.map(this.Z.slice().reverse(), (d) => {
      return { key: d, color: this.colors(d) };
    });
  }

  get visibleData() {
    // TODO memoization
    // return d3.filter(this.data, (d) => !this.hidden.has(d.z));
    // Set hidden values to zero
    return d3.map(this.data, (d) =>
      this.hidden.has(d.z) ? { x: d.x, y: 0, z: d.z } : d,
    );
  }

  get xDomain() {
    // By default, don't re-calculate the x-axis
    return d3.extent(d3.map(this.data, (d) => d.x));
  }

  get yDomain() {
    // Always show the full y Axis
    return [0, d3.max(this.fullStack[0], (d) => d[1])];
  }

  get xScale() {
    return d3
      .scaleLinear()
      .domain(this.xDomain)
      .range([0, this.layout.innerWidth]);
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
    g.call(d3.axisBottom(x).tickSize(3).tickFormat(this.xFormat));
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
    g.call(d3.axisLeft(y).tickSize(-this.layout.innerWidth).tickFormat(""))
      .selectAll(".tick")
      .each(function (d) {
        d3.select(this).classed("zero", d === 0);
      });
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
    [this.svg, this.layout] = layoutSVG(
      selector,
      this.config.LAYOUT,
      this.config.OVERFLOW,
    );

    // Create fake axes to measure label sizes and update layout
    this.updateLayout();

    this.x = this.xScale;
    this.y = this.yScale;

    // Start with the SVG visible - this can be set to 0 for "fade in"
    this.svg.attr("opacity", 1.0);

    // First items drawn are lower layers
    this.gGrid = this.svg
      .append("g")
      .attr("class", "grid")
      .attr(
        "transform",
        `translate(${this.layout.pad.left},${this.layout.pad.top})`,
      );

    this.gInner = this.svg
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

    // Draw the zero state areas
    const area = d3
      .area()
      .x((d) => this.x(d.data[0]))
      .y0((d) => this.y(0))
      .y1((d) => this.y(0));

    this.areas = this.gInner
      .append("g")
      .selectAll()
      .data(this.stack)
      .join("path")
      .attr("fill", (d) => this.colors(d.key))
      .attr("class", (d) => className(d.key))
      .attr("d", area);

    this.update(this.x, this.y);
  }

  update(x, y) {
    // Draw visible areas - always from 0
    const area = d3
      .area()
      .x((d) => x(d.data[0]))
      .y0((d) => y(0))
      .y1((d) => y(d[1]));

    this.areas
      .data(this.stack)
      .transition()
      .duration(this.config.DURATION_MS)
      .attr("d", area);
  }

  noHighlight() {
    // Reset all areas to default
    // this.areas.attr("fill", (d) => this.colors(d.key));
    // this.areas.attr("opacity", 1.0);
  }

  highlight(z) {
    // TODO Make the given z more prominent - two possibilities
    // this.areas.attr("fill", (d) => d.key === z ? this.colors(d.key) : "#ddd");
    // this.areas.attr("opacity", (d) => d.key === z ? 1.0 : this.config.BACKGROUND_OPACITY);
  }

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
      let key = d.key;
      if (evt.touches) {
        evt.preventDefault(); // Prevent scroll on touch devices
        evt = evt.touches[0];
        const target = document.elementFromPoint(evt.clientX, evt.clientY);
        if (!target) return;
        const targetData = d3.select(target).datum();
        // TODO Trigger a pointerleave?
        if (!targetData) return;
        key = targetData.key;
        if (!key) return;
      }
      let [xm, ym] = d3.pointer(evt, this.gInner.node());
      const index = d3.bisectCenter(coords, xm);
      const point = indexed.get(key).get(xs[index]);

      // Data that will be provided to the callback: include the page coordinates
      // of the pointer
      const [px, py] = d3.pointer(evt, null);

      const data = {
        x: point.x,
        y: point.y,
        z: point.z,
        // NOTE: Since there's no relevant point for events, use the pointer
        dx: px,
        dy: py,
        // Pointer page coordinates
        px: px,
        py: py,
      };
      if (move) {
        move.call(this, data, evt);
      }
    };

    const pointerleave = (evt, d) => {
      if (leave) {
        leave.call(this, d.key, evt);
      }
    };

    // Separate mouse and touch events
    this.areas
      .on("mousemove", throttle(pointermove, 1000.0 / this.config.FPS))
      .on("mouseleave", pointerleave)
      .on("touchstart", pointermove, { passive: false })
      .on("touchmove", throttle(pointermove, 1000.0 / this.config.FPS), {
        passive: false,
      })
      .on("touchend", pointerleave, { passive: false });
  }

  toggle() {
    this.update(this.x, this.y);
  }
}

export function Area(data, parser) {
  return new AreaChart(data, parser);
}

export class TimeSeriesAreaChart extends AreaChart {
  get xScale() {
    // Never re-calculate the x-axis
    return d3
      .scaleUtc()
      .domain(this.xDomain)
      .range([0, this.layout.innerWidth]);
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

export function TimeSeriesArea(data, parser) {
  return new TimeSeriesAreaChart(data, parser);
}

export class TimeSeriesSharesChart extends TimeSeriesAreaChart {
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

    // Largest items are returned first, since the stack areas are all drawn from zero
    return stack.reverse();
  }

  get yDomain() {
    // Share charts will always be 0 to 1.0
    return [0.0, 1.0];
  }
}

export function TimeSeriesShares(data, parser) {
  return new TimeSeriesSharesChart(data, parser);
}

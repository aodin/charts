/*
Area chart
*/
import * as d3 from "d3";

import { quantizeScheme } from "./colors";
import { layoutSVG } from "./layout";
import { className } from "./text";
import { maxLabelSize } from "./ticks";
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

export class AreaChart {
  xFormat = null;
  yFormat = null;

  // Area charts expect data is the format [{x, y, z}...]
  // Specify a parser or override parse() if your input data is in a different format
  constructor(data, parser = (d) => d) {
    // Default config
    this.config = {
      SCREEN_HEIGHT_PERCENT: 0.5,
      DURATION_MS: 500,
      Y_AXIS_RIGHT: false,
      HIDE_EMPTY_CHART: false,
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
    // Index the data by x, then by z for each x
    this.indexed = d3.index(
      this.data,
      (d) => d.x,
      (d) => d.z,
    );

    // Build the stack, one array per item, with an elem for each quarter
    // TODO What is we hide items?
    this.stack = d3
      .stack()
      .keys(this.Z)
      .value(([, group], key) => {
        const item = group.get(key);
        return item && item.y ? item.y : 0;
      })(this.indexed);
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

  yAxisRight() {
    // The y axis ticks and labels will be shown on the right of the chart
    this.config.Y_AXIS_RIGHT = true;
    return this;
  }

  hideIfEmpty() {
    this.config.HIDE_EMPTY_CHART = true;
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

  /* End config chained methods */

  get legend() {
    // Return the z items along with their colors
    return d3.map(this.Z, (d) => {
      return { key: d, color: this.colors(d) };
    });
  }

  get zVisible() {
    const visible = new d3.InternSet(this.Z);
    this.hidden.forEach((z) => visible.delete(z));
    return Array.from(visible);
  }

  get visibleData() {
    // TODO memoization
    return d3.filter(this.data, (d) => !this.hidden.has(d.z));
  }

  get empty() {
    // Returns True if there are no visible items on the chart
    return this.zVisible.length === 0;
  }

  get xDomain() {
    // By default, don't re-calculate the x-axis
    return d3.extent(d3.map(this.data, (d) => d.x));
  }

  get yDomain() {
    return [0, d3.max(this.stack[this.stack.length - 1], (d) => d[1])];
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
      .range([this.layout.innerHeight, 0]);
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
    // Another option for "zero state" is to set the tick size to zero
    // const tickSize = this.empty ? 0 : -this.layout.innerWidth;
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
      // left pad can be reduced
      this.layout.pad.left = 5;
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

    // Construct an area
    const area = d3
      .area()
      .x((d) => this.xScale(d.data[0]))
      .y0((d) => this.yScale(0))
      .y1((d) => this.yScale(0));

    this.areas = gInner
      .append("g")
      .selectAll()
      .data(this.stack)
      .join("path")
      .attr("fill", (d) => this.colors(d.key))
      .attr("d", area);

    this.update(this.x, this.y);
  }

  update(x, y) {
    // Option to hide the chart if there's no visible data
    if (this.config.HIDE_EMPTY_CHART) {
      this.svg.transition().duration(this.config.DURATION_MS);
    }

    // Re-draw the chart with the new x and y scales
    // NOTE: with current setup, x-axis doesn't need to be updated
    this.gx
      .transition()
      .duration(this.config.DURATION_MS)
      .call(this.xAxis.bind(this), x);

    this.gy
      .transition()
      .duration(this.config.DURATION_MS)
      .call(this.yAxis.bind(this), y);

    // Grid lines have a hardcoded opacity 1, so we need to use visibility to hide them
    this.gGrid
      .transition()
      .duration(this.config.DURATION_MS)
      .call(this.grid.bind(this), x, y);

    // Construct an area
    const area = d3
      .area()
      .x((d) => this.xScale(d.data[0]))
      .y0((d) => this.yScale(d[0]))
      // .y0((d) => this.yScale(0))
      .y1((d) => this.yScale(d[1]));

    this.areas.transition().duration(this.config.DURATION_MS).attr("d", area);
  }

  noHighlight() {
    // Reset all areas to default
  }

  highlight(z) {
    // Make the given z more prominent
  }

  onEvent(move, leave) {
    // Determine the closest point to the cursor
    const pointermove = (evt) => {
      let [xm, ym] = d3.pointer(evt);
      // X and y scales use the inner element, which is padded
      xm -= this.layout.pad.left;
      ym -= this.layout.pad.top;

      // Data the will provided to the callback
      const data = {
        x: d.x,
        y: d.y,
        z: d.z,
        dx: this.x(d.x) + this.layout.pad.left,
        dy: this.y(d.y) + this.layout.pad.top,
      };

      if (move) {
        move.call(this, data);
      }
    };

    const pointerleave = (evt) => {
      if (leave) {
        leave.call(this);
      }
    };

    this.svg
      .on("pointermove", throttle(pointermove, 20.83)) // 48 fps
      .on("pointerleave", pointerleave)
      .on("touchstart", (evt) => {
        pointermove(evt);
        evt.preventDefault();
      });
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
    if (this.visibleData.length) {
      // Recalculate the y-scale based on the non-hidden items
      this.y = this.yScale;
    } else {
      // Set y-axis to zero
      // We would need the last y-axis domain in order to prevent tick labels
      // from changing during this transition
      this.y = d3
        .scaleLinear()
        .domain(this.y.domain())
        .range([this.layout.innerHeight, this.layout.innerHeight]);
    }
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

/*
Line chart
*/
import * as d3 from "d3";

import { layoutSVG } from "./layout";
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

function getLength(elem) {
  // Not all DOMs support getTotalLength
  return elem.getTotalLength ? elem.getTotalLength() : null;
}

export class LineChart {
  xFormat = null;
  yFormat = null;

  // Line charts expect data is the format [{x, y, z}...]
  // Specify a parser or override parse() if your input data is in a different format
  constructor(data, parser = (d) => d) {
    // Default config
    this.config = {
      SCREEN_HEIGHT_PERCENT: 0.5,
      DURATION_MS: 500,
      Y_AXIS_RIGHT: false,
      BACKGROUND_OPACITY: 0.3, // Opacity when another line is highlighted
      HIGHLIGHT_STROKE_WIDTH: 2.0, // Width when highlighted
      STROKE_WIDTH: 1.5, // Width when not highlighted
      DOT_RADIUS: 3.0, // Radius of the dot
      HIDE_EMPTY_CHART: false,
      COLORS: d3.schemeCategory10, // TODO There's no way to change the default yet

      // Additional margins
      MARGIN_TICK: 3,
    };

    // Items can be dynamically hidden from the chart
    this.hidden = new Set();

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
    return Array.from(new Set(d3.map(this.data, (d) => d.z)));
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
    const colors = d3.quantize(
      (t) => scheme(t * (max - min) + min),
      this.Z.length,
    );
    return this.useDiscreteScheme(colors);
  }
  /* End config chained methods */

  get legend() {
    // Return the z items along with their colors
    return d3.map(this.Z, (d) => {
      return { key: d, color: this.colors(d) };
    });
  }

  get visibleData() {
    // TODO memoization
    return d3.filter(this.data, (d) => !this.hidden.has(d.z));
  }

  get xScale() {
    // Never re-calculate the x-axis
    return d3
      .scaleLinear()
      .domain(d3.extent(d3.map(this.data, (d) => d.x)))
      .range([0, this.layout.innerWidth]);
  }

  get yScale() {
    return d3
      .scaleLinear()
      .domain(d3.extent(d3.map(this.visibleData, (d) => d.y)))
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

    const grouping = d3.group(this.data, (d) => d.z);

    this.paths = gInner
      .append("g")
      .attr("fill", "none")
      .attr("stroke-width", this.config.STROKE_WIDTH)
      .selectAll("path")
      .data(grouping)
      .join("path");

    // Dot - shows nearest point during pointer events
    this.dot = gInner.append("g").attr("class", "dot").style("display", "none");
    this.circle = this.dot.append("circle").attr("r", this.config.DOT_RADIUS);

    // The initial line drawing animation relies on manipulating stroke attributes,
    // which can change whenever we redraw lines, so we'll only do the draw animation
    // once and all subsequent updates will just use a solid stroke
    this.previousUpdate = false;

    // Set initial state
    this.gx.call(this.xAxis.bind(this), this.x).attr("opacity", 1.0);
    this.gy.call(this.yAxis.bind(this), this.y).attr("opacity", 1.0);
    this.gGrid.call(this.grid.bind(this), this.x, this.y);

    const line = d3
      .line()
      .digits(2)
      .defined(this.defined)
      .x((d) => this.x(d.x))
      .y((d) => this.y(d.y));

    this.paths
      .attr("d", ([, I]) => line(I))
      .attr("stroke", ([z]) => this.colors(z))
      .attr("class", ([z]) => z)
      .attr("opacity", 1);

    const lengths = d3.map(this.paths, (elem) => getLength(elem));

    this.paths
      .attr("stroke-dasharray", (d, i) => {
        return lengths[i] ? `${lengths[i]} ${lengths[i]}` : null;
      })
      .attr("stroke-dashoffset", (d, i) => lengths[i]);

    this.update(this.x, this.y);
  }

  update(x, y) {
    this.hideDot();

    // Option to hide the chart if there's no visible data
    if (this.config.HIDE_EMPTY_CHART) {
      this.svg
        .transition()
        .duration(this.config.DURATION_MS)
        .attr("opacity", this.visibleData.length ? 1.0 : 0.0);
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
      .call(this.yAxis.bind(this), y)
      .attr("opacity", this.visibleData.length ? 1.0 : 0.0);

    this.gGrid
      .transition()
      .duration(this.config.DURATION_MS)
      .call(this.grid.bind(this), x, y);

    // Plot the line
    const line = d3
      .line()
      .digits(2)
      .defined(this.defined)
      .x((d) => x(d.x))
      .y((d) => y(d.y));

    this.paths
      .transition()
      .duration(this.config.DURATION_MS)
      .attr("d", ([, I]) => line(I))
      // .attr("stroke-dasharray", (d, i) => `${lengths[i]} ${lengths[i]}`)
      .attr("stroke-dashoffset", 0)
      .attr("opacity", ([z]) => (this.hidden.has(z) ? 0 : 1.0));

    if (this.previousUpdate) {
      this.paths.attr("stroke-dasharray", "1 0");
    }
    this.previousUpdate = true;
  }

  placeDot(index) {
    // Place a dot at the given index
    const d = this.data[index];
    this.dot
      .style("display", null)
      .attr("transform", `translate(${this.x(d.x)},${this.y(d.y)})`);
    this.circle.attr("fill", this.colors(d.z));
  }

  hideDot() {
    this.dot.style("display", "none");
  }

  noHighlight() {
    // Reset all lines to default
    this.paths
      .attr("opacity", ([z]) => (this.hidden.has(z) ? 0 : 1.0))
      .attr("stroke-width", this.config.STROKE_WIDTH);
  }

  highlight(z) {
    // Hide paths that aren't the currently selected path
    this.paths
      .attr("opacity", ([elem]) => {
        if (this.hidden.has(elem)) return 0;
        return elem === z ? 1.0 : this.config.BACKGROUND_OPACITY;
      })
      .attr("stroke-width", ([elem]) =>
        elem === z
          ? this.config.HIGHLIGHT_STROKE_WIDTH
          : this.config.STROKE_WIDTH,
      );
  }

  onEvent(move, leave) {
    let prevIndex = null;

    // Determine the closest point to the cursor
    const pointermove = (evt) => {
      let [xm, ym] = d3.pointer(evt);
      // X and y scales use the inner element, which is padded
      xm -= this.layout.pad.left;
      ym -= this.layout.pad.top;
      const points = d3.map(this.data, (d) => {
        if (this.hidden.has(d.z)) return null;
        return Math.hypot(this.x(d.x) - xm, this.y(d.y) - ym);
      });

      const index = d3.leastIndex(points);
      if (index === -1 || points[index] === null) return;

      // Exit early if no point was found
      if (typeof index === "undefined") return;

      // Only trigger the callback when the index changes
      if (prevIndex && prevIndex == index) return;

      this.placeDot(index);

      const d = this.data[index];

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
      this.hideDot();
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
    this.hidden = this.hidden.union(new Set(z));
    this.toggle();
  }

  show(...z) {
    // Remove the given z elements from the hidden set
    this.hidden = this.hidden.difference(new Set(z));
    this.toggle();
  }

  hideAll() {
    this.hidden = new Set(this.Z);
    this.toggle();
  }

  showAll() {
    this.hidden = new Set();
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

export function Line(data, parser) {
  return new LineChart(data, parser);
}

export class TimeSeriesChart extends LineChart {
  // Never re-calculate the x-axis
  get xScale() {
    return d3
      .scaleUtc()
      .domain(d3.extent(d3.map(this.data, (d) => d.x)))
      .range([0, this.layout.innerWidth]);
  }
}

export function TimeSeries(data, parser) {
  return new TimeSeriesChart(data, parser);
}

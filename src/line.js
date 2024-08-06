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
      ZOOM_EXTENT: [0.5, 32],
      COLORS: d3.schemeCategory10, // TODO There's no way to change the default yet
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

  zoomExtent(min, max) {
    this.config.ZOOM_EXTENT = [min, max];
    return this;
  }

  disableZoom() {
    return this.zoomExtent(1, 1);
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
    return d3
      .scaleLinear()
      .domain(d3.extent(d3.map(this.visibleData, (d) => d.x)))
      .range([0, this.layout.innerWidth]);
  }

  get yScale() {
    return d3
      .scaleLinear()
      .domain(d3.extent(d3.map(this.visibleData, (d) => d.y)))
      .range([this.layout.innerHeight, 0]);
  }

  get zoomIsDisabled() {
    return this.config.ZOOM_EXTENT[0] === 1 && this.config.ZOOM_EXTENT[1] === 1;
  }

  xAxis(g, x) {
    g.call(d3.axisBottom(x).tickSize(3).tickFormat(this.xFormat));
  }

  yAxis(g, y) {
    g.call(
      d3.axisLeft(y).tickSize(-this.layout.innerWidth).tickFormat(this.yFormat),
    );
  }

  render(selector) {
    // If there is no data, do not render
    if (!this.data.length) return;

    // The selector can either be for an:
    // 1. SVG element with width and height attributes
    // 2. HTML element that has an intrinsic width - an SVG element will be created
    [this.svg, this.layout] = layoutSVG(selector, this.config);

    const x = this.xScale;
    const y = this.yScale;

    const [xLabelWidth, xLabelHeight] = maxLabelSize(
      this.layout,
      x,
      this.xFormat,
    );
    this.layout.pad.bottom = d3.max([this.layout.pad.bottom, xLabelHeight]);

    const [yLabelWidth, yLabelHeight] = maxLabelSize(
      this.layout,
      y,
      this.yFormat,
    );
    this.layout.pad.left = d3.max([this.layout.pad.left, yLabelWidth]);

    // Create a clip path for the inner data element to hide any overflow content
    this.svg
      .append("defs")
      .append("clipPath")
      .attr("id", "inner-clip-path")
      .append("rect")
      .attr("width", this.layout.innerWidth)
      .attr("height", this.layout.innerHeight);

    this.gx = this.svg
      .append("g")
      .attr("class", "x axis")
      .attr(
        "transform",
        `translate(${this.layout.pad.left},${this.layout.innerHeight + this.layout.pad.top})`,
      );
    this.gy = this.svg
      .append("g")
      .attr("class", "y axis")
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
      )
      .attr("clip-path", "url(#inner-clip-path)");

    const grouping = d3.group(this.data, (d) => d.z);

    this.paths = gInner
      .append("g")
      .attr("fill", "none")
      .attr("stroke-width", this.config.STROKE_WIDTH)
      .selectAll("path")
      .data(grouping)
      .join("path");

    const zoomed = ({ transform }) => {
      this.x = transform.rescaleX(x).interpolate(d3.interpolateRound);
      this.y = transform.rescaleY(y).interpolate(d3.interpolateRound);
      this.update(this.x, this.y);
    };

    this.zoom = d3
      .zoom()
      .scaleExtent(this.config.ZOOM_EXTENT)
      .on("zoom", zoomed.bind(this));

    // Dot - shows nearest point during pointer events
    this.dot = gInner.append("g").attr("class", "dot").style("display", "none");
    this.circle = this.dot.append("circle").attr("r", this.config.DOT_RADIUS);

    this.reset();
  }

  update(x, y) {
    // Hide the chart if there's no visible data
    if (!this.visibleData.length) {
      this.gx.attr("opacity", 0.0);
      this.gy.attr("opacity", 0.0);
      this.paths.attr("opacity", 0.0);
      return;
    }

    // Re-draw the chart with the new x and y scales
    this.hideDot();
    this.gx.attr("opacity", 1.0).call(this.xAxis.bind(this), x);
    this.gy.attr("opacity", 1.0).call(this.yAxis.bind(this), y);

    // Plot the line
    const line = d3
      .line()
      .digits(2)
      // .defined((d) => ) // TODO defined function
      .x((d) => x(d.x))
      .y((d) => y(d.y));

    this.paths
      .attr("d", ([, I]) => line(I))
      .attr("stroke", ([z]) => this.colors(z))
      .attr("class", ([z]) => z)
      .attr("opacity", ([z]) => (this.hidden.has(z) ? 0 : 1.0));
  }

  reset() {
    const z = this.svg
      .call(this.zoom)
      .call(this.zoom.transform, d3.zoomIdentity);
    if (this.zoomIsDisabled) {
      // Disable zoom completely if requested
      z.on("mousedown.zoom", null)
        .on("touchstart.zoom", null)
        .on("touchmove.zoom", null)
        .on("touchend.zoom", null);
    }
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
      .attr("opacity", 1.0)
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
      const [xm, ym] = d3.pointer(evt);
      const points = d3.map(this.data, (d) => {
        if (this.hidden.has(d.z)) return Infinity;
        return Math.hypot(this.x(d.x) - xm, this.y(d.y) - ym);
      });

      const index = d3.leastIndex(points);
      if (index === -1 || points[index] === Infinity) return;

      // Exit early if no point was found
      if (typeof index === "undefined") return;

      // Only trigger the callback when the index changes
      if (prevIndex && prevIndex == index) return;

      this.placeDot(index);

      const d = this.data[index];

      let data = {
        x: d.x,
        y: d.y,
        z: d.z,
        dx: this.x(d.x),
        dy: this.y(d.y),
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
    this.hidden = this.hidden.union(new Set(z));
    this.toggle();
  }

  show(...z) {
    this.hidden = this.hidden.difference(new Set(z));
    this.toggle();
  }

  showAll() {
    this.hidden = new Set();
    this.toggle();
  }

  toggle() {
    // Recalculate the scales based on the non-hidden items
    this.x = this.xScale;
    this.y = this.yScale;
    this.update(this.x, this.y);
  }

  // TODO method to append a data point
  append() {}
}

export function Line(data, parser) {
  return new LineChart(data, parser);
}

class TimeSeriesChart extends LineChart {
  get xScale() {
    return d3
      .scaleUtc()
      .domain(d3.extent(d3.map(this.visibleData, (d) => d.x)))
      .range([0, this.layout.innerWidth]);
  }
}

export function TimeSeries(data, parser) {
  return new TimeSeriesChart(data, parser);
}

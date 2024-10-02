/*
Line chart with zoom
*/
import * as d3 from "d3";

import { CategoricalChart } from "./chart";
import { layoutSVG } from "./layout";
import { parse3dArray, parseTimeSeries3dArray } from "./parsers";
import { className } from "./text";
import { throttle } from "./throttle";
import { maxLabelSize } from "./ticks";
import { placeTooltip, placeTooltipTop, pageXY } from "./tooltip";

export { parse3dArray, parseTimeSeries3dArray, placeTooltip, placeTooltipTop };

// Clip paths require a unique ID
let uniqueID = 0;

export class LineChartWithZoom extends CategoricalChart {
  xFormat = null;
  yFormat = null;

  // Line charts expect data is the format [{x, y, z}...]
  // Specify a parser if your input data is in a different format
  constructor(data, parser = (d) => d) {
    super(data, parser);
    // Default config
    this.config = {
      LAYOUT: {},
      DURATION_MS: 500,
      FPS: 48,
      BACKGROUND_OPACITY: 0.3, // Opacity when another line is highlighted
      HIGHLIGHT_STROKE_WIDTH: 2.0, // Width when highlighted
      STROKE_WIDTH: 1.5, // Width when not highlighted
      DOT_RADIUS: 3.0, // Radius of the dot
      ZOOM_EXTENT: [0.5, 32],
      COLORS: d3.schemeCategory10,

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
    return Array.from(new Set(d3.map(this.data, (d) => d.z)));
  }

  parseZ(data) {
    return this.items;
  }

  setColors(data) {
    return d3.scaleOrdinal().domain(this.Z).range(this.config.COLORS);
  }

  /* Config chained methods */
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

  get xDomain() {
    return d3.extent(d3.map(this.visibleData, (d) => d.x));
  }

  get yDomain() {
    return d3.extent(d3.map(this.visibleData, (d) => d.y));
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

  get zoomIsDisabled() {
    return this.config.ZOOM_EXTENT[0] === 1 && this.config.ZOOM_EXTENT[1] === 1;
  }

  defined(d, i) {
    // By default, all points are considered to be defined
    return true;
  }

  xAxis(g, x) {
    g.call(d3.axisBottom(x).tickSize(3).tickFormat(this.xFormat));
  }

  yAxis(g, y) {
    g.call(d3.axisLeft(y).tickSize(0).tickFormat(this.yFormat));
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

    this.layout.pad.left = d3.max([
      this.layout.pad.left,
      yLabelWidth + this.config.MARGIN_TICK + 5,
    ]);
  }

  render(selector) {
    // If there is no data, do not render
    if (!this.data.length) return;

    // Set a new clip path ID whenever the chart is rendered
    const clipPathID = `zoom-clip-path-${uniqueID++}`;

    // The selector can either be for an:
    // 1. SVG element with width and height attributes
    // 2. HTML element that has an intrinsic width - an SVG element will be created
    [this.svg, this.layout] = layoutSVG(selector, this.config.LAYOUT);

    // Create fake axes to measure label sizes and update layout
    this.updateLayout();

    const x = this.xScale;
    const y = this.yScale;

    // Create a clip path for the inner data element to hide any overflow content
    this.svg
      .append("defs")
      .append("clipPath")
      .attr("id", clipPathID)
      .append("rect")
      .attr("width", this.layout.width)
      .attr("height", this.layout.height);

    this.svg.attr("clip-path", `url(#${clipPathID})`);

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

    this.gy = this.svg
      .append("g")
      .attr("class", "y axis")
      .attr(
        "transform",
        `translate(${this.layout.pad.left},${this.layout.pad.top})`,
      );

    const grouping = d3.group(this.data, (d) => d.z);

    this.paths = this.gInner
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
    this.dot = this.gInner
      .append("g")
      .attr("class", "dot")
      .style("display", "none");
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
    this.gx.call(this.xAxis.bind(this), x).attr("opacity", 1.0);
    this.gy.call(this.yAxis.bind(this), y).attr("opacity", 1.0);
    this.gGrid.call(this.grid.bind(this), x, y);

    // Plot the line
    const line = d3
      .line()
      .digits(2)
      .defined(this.defined)
      .x((d) => x(d.x))
      .y((d) => y(d.y));

    this.paths
      .attr("d", ([, I]) => line(I))
      .attr("stroke", ([z]) => this.colors(z))
      .attr("class", ([z]) => className(z))
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
    // let prevIndex = null;

    const pointermove = (evt) => {
      if (evt.touches) {
        // Prevent scroll on touch devices
        evt.preventDefault();
        evt = evt.touches[0];
      }

      const [xm, ym] = d3.pointer(evt, this.gInner.node());

      // Determine the closest point to the cursor
      // TODO Points could be memoized based on hidden z items
      const points = d3.map(this.data, (d) => {
        if (this.hidden.has(d.z)) return null;
        return Math.hypot(this.x(d.x) - xm, this.y(d.y) - ym);
      });

      const index = d3.leastIndex(points);
      if (index === -1 || points[index] === null) return;

      // Exit early if no point was found
      if (typeof index === "undefined") return;

      // TODO To only trigger the callback when the index changes
      // if (prevIndex && prevIndex == index) return;

      this.placeDot(index);

      const d = this.data[index];

      // Data that will be provided to the callback: include both the coordinates
      // of the dot and the pointer, both in relation to the page
      const [dx, dy] = pageXY(this.dot.node());
      const [px, py] = d3.pointer(evt, null);

      let data = {
        x: d.x,
        y: d.y,
        z: d.z,
        // Dot page coordinates
        dx: dx,
        dy: dy,
        // Pointer page coordinates
        px: px,
        py: py,
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

    // Separate mouse and touch events
    this.svg
      .on("mousemove", throttle(pointermove, 1000.0 / this.config.FPS))
      .on("mouseleave", pointerleave)
      .on("touchstart", pointermove, { passive: false })
      .on("touchmove", throttle(pointermove, 1000.0 / this.config.FPS), {
        passive: false,
      })
      .on("touchend", pointerleave, { passive: false });
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
    // Recalculate the scales based on the non-hidden items
    this.x = this.xScale;
    this.y = this.yScale;
    this.update(this.x, this.y);
  }

  // TODO method to append a data point
  append() {}
}

export function LineWithZoom(data, parser) {
  return new LineChartWithZoom(data, parser);
}

export class TimeSeriesChartWithZoom extends LineChartWithZoom {
  get xScale() {
    return d3
      .scaleUtc()
      .domain(this.xDomain)
      .range([0, this.layout.innerWidth]);
  }
}

export function TimeSeriesWithZoom(data, parser) {
  return new TimeSeriesChartWithZoom(data, parser);
}

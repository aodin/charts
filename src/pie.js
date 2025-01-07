/*
Pie chart (or donut)
*/
import * as d3 from "d3";

import { CategoricalChart } from "./chart";
import { layoutSVG } from "./layout";
import { parse3dArray, parseTimeSeries3dArray, parseArrayYZ } from "./parsers";
import { throttle } from "./throttle";
import { placeTooltip, placeTooltipTop } from "./tooltip";

export {
  parse3dArray,
  parseTimeSeries3dArray,
  parseArrayYZ,
  placeTooltip,
  placeTooltipTop,
};

export class PieChart extends CategoricalChart {
  // Pie charts expect data is the format [{x, y, z}...]
  // Specify a parser if your input data is in a different format
  constructor(data, parser = (d) => d) {
    super(data, parser);

    // Default config
    this.config = {
      LAYOUT: {},
      DURATION_MS: 500,
      INNER_RADIUS: 0.3,
      OUTER_RADIUS: 0.8,
      INNER_RADIUS_HOVER: 0.3,
      OUTER_RADIUS_HOVER: 0.9,
      BACKGROUND_OPACITY: 0.5, // Opacity when another slice is highlighted
      START_ANGLE: 0,
      END_ANGLE: 2 * Math.PI,
      INITIAL_CLOSED: false,
      SKIP_ENTER_ANIMATION: false,
      COLORS: d3.schemeCategory10,
      OVERFLOW: false, // Allow overflow of the SVG element
    };

    this.data = d3.map(data, parser);

    this.X = Array.from(new d3.InternSet(d3.map(this.data, (d) => d.x)));
    this.Z = Array.from(new d3.InternSet(d3.map(this.data, (d) => d.z)));

    // Group data by x - these are the individual data sets that will render the pie
    this.byX = d3.group(this.data, (d) => d.x);

    this.colors = d3.scaleOrdinal().domain(this.Z).range(this.config.COLORS);
  }

  /* Config chained methods */
  radii(inner, outer) {
    // Set radii
    this.config.INNER_RADIUS = inner;
    this.config.OUTER_RADIUS = outer;
    return this;
  }

  hoverRadii(inner, outer) {
    // Set radii on hover
    this.config.INNER_RADIUS_HOVER = inner;
    this.config.OUTER_RADIUS_HOVER = outer;
    return this;
  }

  angles(start, end) {
    this.config.START_ANGLE = start;
    this.config.END_ANGLE = end;
    return this;
  }

  renderClosed() {
    // The initial render of the pie chart will be all zero, aka closed
    this.config.INITIAL_CLOSED = true;
    return this;
  }

  skipEnterAnimation() {
    this.config.SKIP_ENTER_ANIMATION = true;
    return this;
  }
  /* End config chained methods */

  get legend() {
    // Return the z items along with their colors
    return d3.map(new Set(this.Z), (d) => {
      return { key: d, color: this.color(d) };
    });
  }

  get outerRadius() {
    return this.config.OUTER_RADIUS * (this.layout.innerMinimum / 2);
  }

  get innerRadius() {
    return this.config.INNER_RADIUS * (this.layout.innerMinimum / 2);
  }

  get outerRadiusHover() {
    return this.config.OUTER_RADIUS_HOVER * (this.layout.innerMinimum / 2);
  }

  get innerRadiusHover() {
    return this.config.INNER_RADIUS_HOVER * (this.layout.innerMinimum / 2);
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

    // By default, show the latest quarter of data
    // TODO Option to change default - or just use update()?
    const latest = this.X[this.X.length - 1];

    this.pie = d3
      .pie()
      .sort(null)
      .value((d) => d.y)
      .startAngle(this.config.START_ANGLE)
      .endAngle(this.config.END_ANGLE);

    this.arc = d3
      .arc()
      .innerRadius(this.innerRadius)
      .outerRadius(this.outerRadius);

    // Radii when enlarged
    this.arcEnlarge = d3
      .arc()
      .innerRadius(this.innerRadiusHover)
      .outerRadius(this.outerRadiusHover);

    const [midX, midY] = this.layout.midpoint;

    this.slices = this.svg
      .append("g")
      .attr("transform", `translate(${midX},${midY})`);

    // Center value display
    this.gDisplay = this.svg
      .append("g")
      .attr("transform", `translate(${midX},${midY})`)
      .attr("class", "display")
      .append("text");

    // Optional label
    // this.slices
    //   .append("text")
    //   .attr("class", "label")
    //   .attr("transform", (d) => `translate(${this.arc.centroid(d)})`)
    //   .text(d => this.getLabel(d));

    if (!this.config.INITIAL_CLOSED) {
      this.update(latest);
    }
  }

  update(x) {
    // Update the pie chart with the data at the given x value
    const items = this.byX.get(x);

    // TODO All Z items should be represented in the new data - it makes updates easier
    const arcs = this.pie(items);
    const path = this.slices.selectAll("path").data(arcs, (d) => d.data.z);

    // Need to use a closure because the attrTween uses this
    const arc = this.arc;

    // Update existing arcs
    path
      .transition()
      .duration(this.config.DURATION_MS)
      .attrTween("d", function (d) {
        const interpolate = d3.interpolate(this._current, d);
        this._current = interpolate(0);
        return (t) => arc(interpolate(t));
      });

    // Enter new arcs
    path
      .enter()
      .append("g")
      .attr("class", "slice")
      .attr("opacity", 1.0)
      .append("path")
      .attr("fill", (d) => this.colors(d.data.z))
      .each(function (d) {
        this._current = d;
      })
      .transition()
      .duration(this.config.DURATION_MS)
      .attrTween("d", (d) => {
        if (this.config.SKIP_ENTER_ANIMATION) {
          return () => arc(d);
        }
        const interpolate = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
        return (t) => arc(interpolate(t));
      });
  }

  getLabel(d) {
    // Custom method to return a label from the joined pie data
    return "";
  }

  set display(value) {
    this.gDisplay.text(value);
  }

  enlarge(z) {
    this.slices
      .selectAll("path")
      .filter((d) => d.data.z === z)
      .transition()
      .duration(this.config.DURATION_MS)
      .attr("d", this.arcEnlarge);
  }

  reset() {
    this.slices
      .selectAll("path")
      .transition()
      .duration(this.config.DURATION_MS)
      .attr("d", this.arc);
  }

  noHighlight() {
    this.slices
      .selectAll("g")
      .transition()
      .duration(this.config.DURATION_MS)
      .attr("opacity", 1.0);
  }

  highlight(z) {
    this.slices
      .selectAll("g")
      .transition()
      .duration(this.config.DURATION_MS)
      .attr("opacity", (d) =>
        d.data.z === z ? 1.0 : this.config.BACKGROUND_OPACITY,
      );
  }

  onEvent(enter, move, leave) {
    const pointerenter = (evt, d) => {
      if (enter) {
        enter.call(this, d.data, evt);
      }
    };

    const pointermove = (evt, d) => {
      // Touch events keep the target where the touch event started
      let target = evt.target;

      if (evt.touches) {
        evt.preventDefault(); // Prevent scroll on touch devices
        evt = evt.touches[0];
        // Get the element at the current touch event
        target = document.elementFromPoint(evt.clientX, evt.clientY);
        // If the target element doesn't have a parent or data, exit early
        // This likely means it is a non-slice element
        // TODO Trigger a pointerleave?
        if (!target || !target.parentNode) return;
        d = d3.select(target).datum();
        if (!d || !d.data) return;
      }

      // TODO Why doesn't pageXY work with the rectangle?
      const rect = target.getBoundingClientRect();
      const [px, py] = d3.pointer(evt, null);

      // TODO Return the centroid?

      const data = {
        x: d.data.x,
        y: d.data.y,
        z: d.data.z,
        // Slice page coordinates
        dx: rect.x + window.scrollX,
        dy: rect.y + window.scrollY,
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
        leave.call(this, d.data, evt);
      }
    };

    this.slices
      .selectAll("path")
      .on("mouseenter", pointerenter)
      .on("mousemove", throttle(pointermove, 20.83))
      .on("mouseleave", pointerleave)
      .on("touchstart", pointerenter, { passive: false })
      .on("touchmove", throttle(pointermove, 20.83), { passive: false })
      .on("touchend", pointerleave, { passive: false });
  }
}

export function Donut(data, parser) {
  return new PieChart(data, parser);
}

export function Pie(data, parser) {
  return new PieChart(data, parser).radii(0, 0.8).hoverRadii(0, 0.9);
}

export function Gauge(data, parser) {
  return new PieChart(data, parser)
    .angles(-Math.PI * 0.65, Math.PI * 0.65)
    .radii(0.5, 0.8)
    .hoverRadii(0.55, 0.9);
}

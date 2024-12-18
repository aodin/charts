import * as d3 from "d3";

import { animatedDashArray, animatedDashOffset } from "./animation";
import { Chart } from "./chart";
import { volume } from "./formats";
import { layoutSVG } from "./layout";
import { parseArrayOHLCV, parseVerboseOHLCV } from "./parsers";
import { throttle } from "./throttle";
import {
  maxLabelSize,
  filterTicksAutoOffset,
  invertBand,
  zoomRange,
} from "./ticks";
import { makeDateFormatter } from "./timeseries";
import { placeTooltip, placeTooltipTop } from "./tooltip";

export { parseArrayOHLCV, parseVerboseOHLCV, placeTooltip, placeTooltipTop };

// Clip paths require a unique ID
let uniqueID = 0;

function signOf(d) {
  // TODO Assumes both open and close are defined
  return 1 + Math.sign(d.o - d.c);
}

const classes = ["up", "even", "down"];

function deltaClass(d) {
  // Return's a class depending on the day's delta
  return classes[signOf(d)];
}

function extentData(data, start = 0, end) {
  // Calculate the extent of the price data, optionally with a slice of the data
  if (end) {
    data = data.slice(start, end + 1);
  }
  const minY = d3.min(d3.map(data, (d) => d.l));
  return [minY, d3.max(d3.map(data, (d) => d.h))];
}

export class CandlestickChart extends Chart {
  // Allow a custom formatting of prices, setting null will use default formats
  priceFormat = d3.format(",~f");

  // CandlestickChart expects data in the format [{x, o, h, l, c, v}...]
  // Specify a parser if your input data is in a different format
  constructor(data, parser = (d) => d) {
    super(data, parser);

    // Default config
    this.config = {
      VOLUME_RATIO: 0.0,
      LOG_Y: false, // We need to know which scale is used for proper tick formats
      BAND_PAD: 0.1,
      FPS: 48,
      DURATION_MS: 750,
      DELAY_MS: 0,
      DELAY_ONCE: false,
      DISABLE_BRUSH: false,
      PRICE_AXIS_RIGHT: false,
      VOLUME_AXIS_RIGHT: true,
      HIDE_VOLUME_AXIS: false,
      VOLUME_TICK_COUNT: 1,
      RESCALE_Y: true,
      CLAMP: false, // Axes clamps are disabled by default
      LAYOUT: {},

      // For rendered lines
      STROKE_WIDTH: 1.5,

      // Additional layout padding
      // TODO Specify an additional layout?
      MARGIN_RIGHT: 10,
      MARGIN_LEFT: 10,
      MARGIN_LABEL: 10,
      MARGIN_AXES: 5,
      MARGIN_TICK: 2,
    };

    this.opened = false; // Set true after the initial animation

    // Get data in a {x, o, h, l, c, v} format
    this.data = d3.map(data, parser);

    // Config and rendered elements for lines
    this.lines = {};
    this.lineElements = {};

    // Also save the X axis, since it is used for filtering tick labels
    this.X = d3.map(this.data, (d) => d.x);

    // Zoom works by setting the start and end indices
    // By default, all data is shown
    this.start = 0;
    this.end = this.data.length - 1;
  }

  /* Config chained methods */
  doNotRescaleY() {
    // Do not rescale the Y axis on zoom
    this.config.RESCALE_Y = false;
    return this;
  }

  bandPadding(value) {
    this.config.BAND_PAD = value;
    return this;
  }

  priceAxisRight() {
    // The price axis ticks and labels will be shown on the right of the chart
    this.config.PRICE_AXIS_RIGHT = true;
    return this;
  }

  showVolume(ratio = 0.1) {
    // TODO Allow to be called dynamically?
    this.config.VOLUME_RATIO = ratio;
    return this;
  }

  hideVolume() {
    // TODO Allow to be called dynamically?
    return this.showVolume(0.0);
  }

  hideVolumeAxis() {
    // The volume chart will still be shown, but without a label
    this.config.HIDE_VOLUME_AXIS = true;
    return this;
  }

  volumeTickCount(value = 1) {
    // Number of volume axis ticks that should be shown
    this.config.VOLUME_TICK_COUNT = value;
    return this;
  }

  defaultLog() {
    this.config.LOG_Y = true;
    return this;
  }

  defaultLinear() {
    this.config.LOG_Y = false;
    return this;
  }

  disableZoom() {
    // Do not trigger zoom on brush events
    this.config.DISABLE_BRUSH = true;
    return this;
  }

  enableClamp() {
    this.config.CLAMP = true;
    return this;
  }

  disableClamp() {
    this.config.CLAMP = false;
    return this;
  }

  staggerOpening(value = 0) {
    // Stagger only the opening animation
    this.config.DELAY_ONCE = true;
    return this.staggerAnimation(value);
  }

  staggerAnimation(value = 0) {
    // If not value is provided, stagger by a fraction of the total animation
    if (!value && this.X.length) {
      value = this.config.DURATION_MS / (2 * this.X.length);
    }
    this.config.DELAY_MS = value;
    return this;
  }

  noStaggerAnimation() {
    this.config.DELAY_MS = 0;
    return this;
  }
  /* End config chained methods */

  duration(d, i) {
    if (this.config.DELAY_ONCE && this.opened) {
      return this.config.DURATION_MS;
    }
    return this.config.DURATION_MS / 2;
  }

  delay(d, i) {
    return this.config.DELAY_ONCE && this.opened ? 0 : i * this.config.DELAY_MS;
  }

  get volumeAxesIsVisible() {
    return Boolean(this.config.VOLUME_RATIO) && !this.config.HIDE_VOLUME_AXIS;
  }

  get volumeAxesVisibility() {
    return this.volumeAxesIsVisible ? "visible" : "hidden";
  }

  get priceTickFormat() {
    // Linear axes can use the priceFormat directly, but log axes need additional config
    if (this.config.LOG_Y) {
      const numTicks = d3.max([this.scaleLinear.ticks().length, 2]);
      return this.scaleLog.tickFormat(numTicks, this.priceFormat);
    } else {
      return this.priceFormat;
    }
  }

  get priceAxisIndex() {
    if (this.config.PRICE_AXIS_RIGHT) {
      return d3.axisRight(this.scaleY).tickFormat(this.priceTickFormat);
    }
    return d3.axisLeft(this.scaleY).tickFormat(this.priceTickFormat);
  }

  get gridWidth() {
    return -this.layout.innerWidth - this.config.MARGIN_AXES;
  }

  get wickThickness() {
    // Wick thickness should at least 1px, but no greater than 3% of the band or 10px
    return d3.min([d3.max([this.scaleX.bandwidth() * 0.03, 1.0]), 10]);
  }

  makeDateFormatter() {
    return makeDateFormatter();
  }

  get xValues() {
    return filterTicksAutoOffset(
      this.X.slice(this.start, this.end + 1),
      this.layout,
      this.labelWidthX,
    );
  }

  updateLayout() {}

  addLineAbove(name, color = "currentColor", pattern, strokeWidth) {
    return this.addLine(name, color, true, pattern, strokeWidth);
  }

  addLineBelow(name, color = "currentColor", pattern, strokeWidth) {
    return this.addLine(name, color, false, pattern, strokeWidth);
  }

  addLine(name, color = "currentColor", above = false, pattern, strokeWidth) {
    // Add a new line to the chart - the key must match a property in the data elements
    this.lines[name] = {
      color: color,
      above: above,
      pattern: pattern,
      strokeWidth: strokeWidth || this.config.STROKE_WIDTH,
    };
    return this;
  }

  // Line methods - all methods return the line's path D3 element
  getLine(name) {
    return this.lineElements[name];
  }

  setLineOpacity(name, opacity = 1.0) {
    return this.getLine(name).attr("opacity", opacity);
  }

  showLine(name) {
    return this.setLineOpacity(name, 1.0);
  }

  hideLine(name) {
    return this.setLineOpacity(name, 0);
  }

  moveLineBelow(name) {
    const path = this.getLine(name);
    this.lineBelow.append(() => path.node().parentNode);
    return path;
  }

  moveLineAbove(name) {
    const path = this.getLine(name);
    this.lineAbove.append(() => path.node().parentNode);
    return path;
  }

  renderLine(name, x, y) {
    // Adds a line to be rendered. The name should match the key in the data object
    const config = this.lines[name];
    const g = config.above
      ? this.lineAbove.append("g")
      : this.lineBelow.append("g");
    const grouping = d3.group(this.data, () => name);

    const line = d3
      .line()
      .digits(3)
      .defined((d) => d.x && d[name])
      .x((d) => x(d.x) + x.step() / 2)
      .y((d) => y(d[name]));

    const path = g
      .attr("fill", "none")
      .attr("stroke-width", config.strokeWidth)
      .attr("stroke", config.color)
      .attr("opacity", 1)
      .selectAll("path")
      .data(grouping)
      .join("path")
      .attr("d", ([, I]) => line(I));

    this.lineElements[name] = path;
    return path;
  }

  updateLine(name, x, y) {
    const path = this.getLine(name);
    const config = this.lines[name];
    const p = config.pattern || [];

    const line = d3
      .line()
      .digits(3)
      .defined((d) => d.x && d[name])
      .x((d) => x(d.x) + x.step() / 2)
      .y((d) => y(d[name]));

    // If a path was previously updated, remove the offset and set its pattern
    if (this.opened) {
      path
        .attr("stroke-dasharray", p.length ? p.join(" ") : null)
        .attr("stroke-dashoffset", 0); // NOTE should already be 0, but just in case
    }

    const transition = path.transition().duration(this.config.DURATION_MS);
    transition.attr("d", ([, I]) => line(I));

    // If a path hasn't been previously updated, add its opening animation
    if (!this.opened) {
      const l = Math.ceil(path.node().getTotalLength());
      path.attr("stroke-dasharray", animatedDashArray(config.pattern, l));
      transition.attrTween("stroke-dashoffset", () => animatedDashOffset(p, l));
    }
    return path;
  }

  render(selector) {
    // If there is no data, do not render
    if (!this.data.length) return;

    // Set a new clip path ID whenever the chart is rendered
    const clipPathID = `candlestick-clip-path-${uniqueID++}`;

    // The selector can either be for an:
    // 1. SVG element with width and height attributes
    // 2. HTML element that has an intrinsic width - an SVG element will be created
    [this.svg, this.layout] = layoutSVG(selector, this.config.LAYOUT);

    // The price and volume portions of the chart will share an x-axis
    const volumeHeight = this.layout.innerHeight * this.config.VOLUME_RATIO;
    const priceHeight = this.layout.innerHeight - volumeHeight;

    const maxVolume = d3.max(d3.map(this.data, (d) => d.v));

    this.scaleVolume = d3
      .scaleLinear()
      .domain([0, maxVolume])
      .range([volumeHeight, 0])
      .clamp(this.config.CLAMP)
      .nice();

    // Right pad the volume ticks
    if (this.volumeAxesIsVisible) {
      const [volWidth, volHeight] = maxLabelSize(
        this.svg,
        this.layout,
        this.scaleVolume.copy(),
        volume,
        "v axis",
      );
      this.layout.pad.right = volWidth + this.config.MARGIN_RIGHT;
    }

    let domainY = extentData(this.data);
    const minY = domainY[0];
    const rangeY = [priceHeight, 0];

    // Axes
    this.scaleLinear = d3
      .scaleLinear()
      .domain(domainY)
      .range(rangeY)
      .clamp(this.config.CLAMP);

    this.scaleLog = d3
      .scaleLog()
      .domain(domainY)
      .range(rangeY)
      .clamp(this.config.CLAMP);

    // Get the max tick label width for the y-axis on both linear and log scales
    const [logWidth, logHeight] = maxLabelSize(
      this.svg,
      this.layout,
      this.scaleLog.copy(),
      this.priceFormat,
      "y axis",
    );
    const [linearWidth, linearHeight] = maxLabelSize(
      this.svg,
      this.layout,
      this.scaleLinear.copy(),
      this.priceFormat,
      "y axis",
    );
    const labelWidthY = d3.max([logWidth, linearWidth]);

    // Left pad the the y-axis labels
    // TODO Option for additional padding
    if (this.config.PRICE_AXIS_RIGHT) {
      this.layout.pad.left = this.config.MARGIN_LEFT;
      this.layout.pad.right = d3.max([
        this.layout.pad.right,
        labelWidthY + this.config.MARGIN_RIGHT,
      ]);
    } else {
      this.layout.pad.left = d3.max([
        this.layout.pad.left,
        labelWidthY + this.config.MARGIN_LEFT,
      ]);
    }

    // Create a clip path for the inner data element to hide any overflow content
    this.svg
      .append("defs")
      .append("clipPath")
      .attr("id", clipPathID)
      .append("rect")
      .attr("width", this.layout.innerWidth)
      .attr("height", this.layout.innerHeight);

    // Set the inner display
    this.inner = this.svg
      .append("g")
      .attr(
        "transform",
        `translate(${this.layout.pad.left}, ${this.layout.pad.top})`,
      );

    this.scaleX = d3
      .scaleBand(this.X, [0, this.layout.innerWidth])
      .paddingInner(this.config.BAND_PAD)
      .paddingOuter(this.config.BAND_PAD / 2);

    // NOTE The date formatter needs to be created because it uses a
    // closure to determine a new year
    // TODO Reset the date formatter whenever the x-axis is called
    let dates = this.makeDateFormatter();

    // Get the max tick label width for the x-axis
    const [labelWidthX, labelHeight] = maxLabelSize(
      this.svg,
      this.layout,
      this.scaleX.copy(),
      dates,
      "x axis",
    );
    this.labelWidthX = labelWidthX + this.config.MARGIN_LABEL;

    let yTransform = "transform(0,0)";
    if (this.config.PRICE_AXIS_RIGHT) {
      yTransform = `translate(${this.layout.innerWidth + this.config.MARGIN_AXES},0)`;
    }

    // Reset the date formatter
    dates = this.makeDateFormatter();

    // Set the zero state
    this.scaleY = this.config.LOG_Y ? this.scaleLog : this.scaleLinear;
    const axisY = this.priceAxisIndex;

    this.grid = this.inner
      .append("g")
      .attr("transform", yTransform)
      .attr("class", "grid")
      .call(axisY.tickSize(this.gridWidth));

    this.axisX = d3
      .axisBottom(this.scaleX)
      .tickValues(this.xValues)
      .tickFormat(dates)
      .tickSize(4);

    this.gPrice = this.inner
      .append("g")
      .attr("transform", yTransform)
      .attr("class", "y axis")
      .call(axisY.tickSize(0));

    // Volume elements are always rendered even if their height is zero
    this.axisVolume = d3
      .axisRight(this.scaleVolume)
      .ticks(this.config.VOLUME_TICK_COUNT)
      .tickFormat(volume)
      .tickSize(3);

    this.volume = this.inner
      .append("g")
      .attr("class", "volume")
      .attr(
        "transform",
        `translate(0,${this.layout.innerHeight - volumeHeight})`,
      );

    this.gVolume = this.volume
      .append("g")
      .attr("class", "v axis")
      .attr(
        "transform",
        `translate(${this.layout.innerWidth + this.config.MARGIN_TICK},0)`,
      )
      .call(this.axisVolume)
      .attr("visibility", this.volumeAxesVisibility);

    this.volumeSlots = this.volume
      .append("g")
      .attr("clip-path", `url(#${clipPathID})`)
      .attr("stroke", "currentColor")
      .attr("stroke-linecap", "butt") // NOTE using 'square' distorts size
      .selectAll("g")
      .data(this.data)
      .join("g")
      .attr(
        "transform",
        (d) => `translate(${this.scaleX(d.x) + this.scaleX.bandwidth() / 2},0)`,
      );

    this.volumeBars = this.volumeSlots
      .append("line")
      .attr("y1", this.scaleVolume(0))
      .attr("y2", this.scaleVolume(0))
      .attr("stroke-width", this.scaleX.bandwidth())
      .attr("class", deltaClass);

    // For rendering lines underneath the candlesticks
    this.lineBelow = this.inner
      .append("g")
      .attr("clip-path", `url(#${clipPathID})`)
      .attr("class", "lineBelow");

    this.price = this.inner.append("g").attr("class", "price");

    this.candles = this.price
      .append("g")
      .attr("clip-path", `url(#${clipPathID})`)
      .attr("stroke-linecap", "butt") // NOTE using 'square' distorts size
      .attr("stroke", "currentColor")
      .selectAll("g")
      .data(this.data)
      .join("g")
      .attr("class", deltaClass)
      .attr(
        "transform",
        (d) => `translate(${this.scaleX(d.x) + this.scaleX.bandwidth() / 2},0)`,
      );

    this.wicks = this.candles
      .append("line")
      .attr("stroke-width", this.wickThickness)
      .attr("class", "wick")
      .attr("y1", this.scaleY(minY))
      .attr("y2", this.scaleY(minY));

    this.bars = this.candles
      .append("line")
      .attr("stroke-width", this.scaleX.bandwidth())
      .attr("class", "bar")
      .attr("y1", this.scaleY(minY))
      .attr("y2", this.scaleY(minY));

    // For rendering line above the candlesticks
    this.lineAbove = this.inner
      .append("g")
      .attr("clip-path", `url(#${clipPathID})`)
      .attr("class", "lineAbove");

    // Elements drawn last will appear on top
    this.gx = this.inner
      .append("g")
      .attr("class", "x axis")
      .attr("transform", `translate(0,${this.layout.innerHeight})`)
      .call(this.axisX);

    // Draw any lines
    for (let key in this.lines) {
      this.renderLine(key, this.scaleX, this.scaleY);
    }

    // Brush for zoom
    this.brush = d3.brushX().extent([
      [0, 0],
      [this.layout.innerWidth, this.layout.innerHeight],
    ]);

    this.gBrush = this.inner.append("g").attr("class", "brush");

    if (!this.config.DISABLE_BRUSH) {
      this.brush.on("end", this.zoom.bind(this));
      this.gBrush.call(this.brush.bind(this));
    }

    // Optional spotlight of a bar
    // Don't call the class "tooltip" - that interferes with Bootstrap
    this.spotlightBar = this.inner
      .append("g")
      .lower() // The spotlight should always be the lowest layer of the SVG
      .attr("class", "spotlight")
      .append("rect")
      .style("display", "none")
      .style("pointer-events", "none");

    // Set the initial prices with the default axes
    this.update();
  }

  update() {
    // Update the chart to start and end on the given x-axis indices
    // The y-axis will also be updated to the min and max of the data for the given xs
    const zRange = zoomRange(
      this.scaleX.domain(),
      this.layout.innerWidth,
      this.start,
      this.end,
    );

    // Do not update the domain - just the range
    this.scaleX.range(zRange);

    // Update the axisY according to the new min and max of the data
    if (this.config.RESCALE_Y) {
      let domainY = extentData(this.data, this.start, this.end);
      this.scaleLinear.domain(domainY);
      this.scaleLog.domain(domainY); // TODO .nice() can be called here
    }

    this.scaleY = this.config.LOG_Y ? this.scaleLog : this.scaleLinear;
    const axisY = this.priceAxisIndex;

    // Reset the date formatter and re-filter the X-axis date labels
    const dates = this.makeDateFormatter();
    this.axisX.tickValues(this.xValues).tickFormat(dates);

    // Update the x-axis
    this.gx
      .transition()
      .duration(this.config.DURATION_MS)
      .attr("transform", `translate(0,${this.layout.innerHeight})`)
      .call(this.axisX);

    // Update the y-axis
    this.gPrice
      .transition()
      .duration(this.config.DURATION_MS)
      .call(axisY.tickSize(0));

    // Update the grid
    this.grid
      .transition()
      .duration(this.config.DURATION_MS)
      .call(axisY.tickFormat("").tickSize(this.gridWidth));

    // Update the candles
    this.candles
      .transition()
      .duration(this.config.DURATION_MS)
      .attr(
        "transform",
        (d) => `translate(${this.scaleX(d.x) + this.scaleX.bandwidth() / 2},0)`,
      );

    this.bars
      .transition()
      .delay(this.delay.bind(this))
      .duration(this.duration.bind(this))
      .attr("stroke-width", this.scaleX.bandwidth())
      .attr("y1", (d) => this.scaleY(d.o))
      .attr("y2", (d) => this.scaleY(d.c));

    this.wicks
      .transition()
      .delay(this.delay.bind(this))
      .duration(this.duration.bind(this))
      .attr("stroke-width", this.wickThickness)
      .attr("y1", (d) => this.scaleY(d.l))
      .attr("y2", (d) => this.scaleY(d.h));

    // Hide the spotlight on update - it will reactivate on next hover
    this.noSpotlight();

    // Update the spotlight width
    this.spotlightBar
      .transition()
      .duration(this.config.DURATION_MS)
      .attr("width", this.scaleX.step());

    // Update the volume
    this.volumeSlots
      .transition()
      .duration(this.config.DURATION_MS)
      .attr(
        "transform",
        (d) => `translate(${this.scaleX(d.x) + this.scaleX.bandwidth() / 2},0)`,
      );

    this.volumeBars
      .transition()
      .delay(this.delay.bind(this))
      .duration(this.duration.bind(this))
      .attr("stroke-width", this.scaleX.bandwidth())
      .attr("y2", (d) => this.scaleVolume(d.v || 0));

    // Update any lines
    for (let key in this.lines) {
      this.updateLine(key, this.scaleX, this.scaleY);
    }

    this.opened = true;
  }

  zoom({ selection }) {
    if (!selection) return;
    // Get the closest indices to the selection
    const [x0, x1] = selection;
    [this.start, this.end] = [
      invertBand(this.scaleX, x0),
      invertBand(this.scaleX, x1),
    ];
    this.update();

    // Reset the brush
    this.gBrush.call(this.brush.move, null);
  }

  reset() {
    this.start = 0;
    this.end = this.data.length - 1;
    this.update();
  }

  useLog() {
    this.config.LOG_Y = true;
    this.update();
  }

  useLinear() {
    this.config.LOG_Y = false;
    this.update();
  }

  spotlight(index) {
    // TODO We only need to pad if width is set to bandwidth instead of step
    // const pad = this.scaleX.bandwidth() * this.scaleX.paddingInner() * 0.5;
    const offset = this.scaleX.step() * this.scaleX.paddingOuter();
    this.spotlightBar
      .attr("x", this.scaleX(this.data[index].x) - offset)
      .attr("width", this.scaleX.step())
      .attr("y", 0)
      .attr("height", this.layout.innerHeight)
      .style("display", "block");
  }

  noSpotlight() {
    this.spotlightBar.style("display", "none");
  }

  onEvent(move, leave) {
    // Enable events for the chart. On move, determine which band is being
    // hovered over and send an object of its OHLCV data to the move callback.
    // The leave callback is triggered when the pointer leaves the SVG elem.
    let prevIndex = null;

    const pointermove = (evt) => {
      if (evt.touches) {
        // Prevent scroll on touch devices
        evt.preventDefault();
        evt = evt.touches[0];
      }
      const [xm] = d3.pointer(evt);
      const index = invertBand(this.scaleX, xm - this.layout.pad.left);

      // TODO To only trigger the callback when the index changes
      // if (prevIndex && prevIndex == index) {
      //   return;
      // }

      prevIndex = index;

      // Include the index's OHLCV data and a change from the last close
      let data = structuredClone(this.data[index]);
      data.index = index;

      [data.px, data.py] = d3.pointer(evt, null);

      if (index > 0) {
        const prev = this.data[index - 1];
        if (prev && prev.c) {
          data.prev = prev.c;
          data.delta = data.c - prev.c;
          data.percent = data.delta / prev.c;
        }
      }

      if (move) {
        move.call(this, data, evt);
      }
    };

    const pointerleave = (evt) => {
      prevIndex = null;
      if (leave) {
        leave.call(this, evt);
      }
    };

    this.svg
      .on("mousemove", throttle(pointermove, 1000.0 / this.config.FPS))
      .on("mouseleave", pointerleave)
      .on("touchstart", pointermove, { passive: false })
      .on("touchmove", throttle(pointermove, 1000.0 / this.config.FPS), {
        passive: false,
      })
      .on("touchend", pointerleave, { passive: false });
  }

  // TODO method to append a data point
  append() {}
}

export function OHLC(data, parser) {
  return new CandlestickChart(data, parser);
}

export function OHLCV(data, parser) {
  return new CandlestickChart(data, parser).showVolume();
}

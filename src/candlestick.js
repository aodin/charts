import * as d3 from "d3";

import { Layout, getLayout, appendSVG } from "./layout";
import { maxLabelSize, filterTicks } from "./ticks";
import { makeDateFormatter } from "./timeseries";
import { throttle } from "./throttle";
import { volume } from "./formats";

function signOf(d) {
  // TODO Assumes both open and close are defined
  return 1 + Math.sign(d.o - d.c);
}

function barClass(d) {
  // Append a class to the bar depending on its delta
  const c = ["up", "even", "down"][signOf(d)];
  return ["bar", c].join(" ");
}

function zoomRange(domain, width, start, end) {
  // Return the range extent needed to zoom to the start and end indices of the domain
  let w = end - start + 1;
  let ratio = 1;
  if (w < domain.length) {
    ratio = domain.length / w;
  }
  const offset = start / domain.length;
  const zWidth = width * ratio;
  const offsetX = offset * zWidth;
  return [0 - offsetX, zWidth - offsetX];
}

function extentData(data, start = 0, end) {
  // Calculate the extent of the price data, optionally with a slice of the data
  if (end) {
    data = data.slice(start, end + 1);
  }
  const minY = d3.min(d3.map(data, (d) => d.l));
  return [minY, d3.max(d3.map(data, (d) => d.h))];
}

function invertBand(scale, x) {
  const domain = scale.domain();
  const padOuter = scale(domain[0]);
  const eachBand = scale.step();
  const index = Math.floor((x - padOuter) / eachBand);
  return Math.max(0, Math.min(index, domain.length - 1));
}

export class Candlestick {
  // Candlestick expects data in the format [{x, o, h, l, c, v}...]
  // Specify a parser if your input data is in a different format
  formatX = "%m %d, %Y";

  constructor(data, parser = (d) => d) {
    // Default config
    this.config = {
      VOLUME_RATIO: 0.0,
      LOG_Y: false,
      SCREEN_HEIGHT_FRACTION: 0.5,
      BAND_PAD: 0.2,
      DURATION_MS: 500,
      VOLUME_AXIS_RIGHT: true,
      HIDE_VOLUME_AXIS: false,
    };

    // Get data in a {x, o, h, l, c, v} format
    this.data = d3.map(data, parser);

    // Also save the X axis, since it is used for filtering tick labels
    this.X = d3.map(this.data, (d) => d.x);

    // Zoom works by setting the start and end indices
    // By default, all data is shown
    this.start = 0;
    this.end = this.data.length - 1;
  }

  get volumeAxesIsVisible() {
    return Boolean(this.config.VOLUME_RATIO) && !this.config.HIDE_VOLUME_AXIS;
  }

  get volumeAxesVisibility() {
    return this.volumeAxesIsVisible ? "visible" : "hidden";
  }

  // TODO method to append a data point
  append() {
    // TODO Apply data formatter function?
  }

  animationDuration(value) {
    this.config.DURATION_MS = value;
    return this;
  }

  noAnimation() {
    return this.animationDuration(0);
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

  defaultLog() {
    this.config.LOG_Y = true;
    return this;
  }

  defaultLinear() {
    this.config.LOG_Y = false;
    return this;
  }

  screenHeightFraction(value) {
    this.config.SCREEN_HEIGHT_FRACTION = value;
    return this;
  }

  // Render has three basic states
  // 1. No SVG element - use width of parent and height of screen
  // 2. SVG element without size attributes - use width of parent and height of screen
  //    - But SVG elements don't have a width???
  // 3. SVG element with size attributes - use those
  render(selector) {
    const elem = d3.select(selector);
    if (!elem.node()) {
      throw new Error(
        `Unable to find a DOM element for selector '${selector}'`,
      );
    }

    if (elem.node().tagName === "svg") {
      this.svg = elem;
      const width = +this.svg.attr("width");
      const height = +this.svg.attr("height");
      // TODO fallback to viewbox?

      if (width && height) {
        this.layout = new Layout(width, height);
      } else {
        // TODO SVGs must have a width or height or the defaults will be returned
        this.layout = getLayout(selector, {
          screenHeightFraction: this.config.SCREEN_HEIGHT_FRACTION,
        });
      }
    } else {
      this.layout = getLayout(selector, {
        screenHeightFraction: this.config.SCREEN_HEIGHT_FRACTION,
      });
      this.svg = appendSVG(selector, this.layout.width, this.layout.height);
    }

    // The price and volume portions of the chart will share an x-axis
    const volumeHeight = this.layout.innerHeight * this.config.VOLUME_RATIO;
    const priceHeight = this.layout.innerHeight - volumeHeight;

    const maxVolume = d3.max(d3.map(this.data, (d) => d.v));

    this.scaleVolume = d3
      .scaleLinear()
      .domain([0, maxVolume])
      .range([volumeHeight, 0])
      .clamp(true)
      .nice();

    // Right pad the volume ticks
    if (this.volumeAxesIsVisible) {
      const [volWidth, volHeight] = maxLabelSize(
        this.layout,
        this.scaleVolume,
        volume,
      );
      this.layout.pad.right = volWidth + 5;
    }

    let domainY = extentData(this.data);
    const minY = domainY[0];

    // TODO Pad the price domain? Just use nice()?
    // const domainPadY = (domainY[1] - domainY[0]) * 0.1;
    // domainY = [domainY[0] - domainPadY, domainY[1] + domainPadY];

    const rangeY = [priceHeight, 0];

    // Axes
    this.scaleLog = d3.scaleLog().domain(domainY).range(rangeY).clamp(true);
    this.scaleLinear = d3
      .scaleLinear()
      .domain(domainY)
      .range(rangeY)
      .clamp(true);

    // Get the max tick label width for the y-axis on both linear and log scales
    const [logWidth, logHeight] = maxLabelSize(this.layout, this.scaleLog);
    const [linearWidth, linearHeight] = maxLabelSize(
      this.layout,
      this.scaleLinear,
    );
    const labelWidthY = d3.max([logWidth, linearWidth]);

    // Left pad the the y-axis labels
    this.layout.pad.left = labelWidthY + 5;

    // Create a clip path for the inner data element to hide any overflow content
    this.svg
      .append("defs")
      .append("clipPath")
      .attr("id", "inner-clip-path")
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
      .align(0.5);
    // NOTE do not use round

    // NOTE The date formatter needs to be created because it uses a
    // closure to determine a new year
    let dates = makeDateFormatter();

    // Get the max tick label width for the x-axis
    const [labelWidthX, labelHeight] = maxLabelSize(
      this.layout,
      this.scaleX,
      dates,
    );
    this.labelWidthX = labelWidthX;
    const filteredX = filterTicks(this.X, this.layout, labelWidthX);

    // Reset the date formatter
    dates = makeDateFormatter();

    // Set the zero state
    this.scaleY = this.config.LOG_Y ? this.scaleLog : this.scaleLinear;

    const axisY = d3.axisLeft(this.scaleY).tickSize(0);
    this.axisX = d3
      .axisBottom(this.scaleX)
      .tickValues(filteredX)
      .tickFormat(dates)
      .tickSize(3);

    this.gPrice = this.inner.append("g").attr("class", "y axis").call(axisY);

    this.grid = this.inner.append("g").attr("class", "grid");

    const bandPad = (this.scaleX.bandwidth() * this.config.BAND_PAD) / 2;

    this.gx = this.inner
      .append("g")
      .attr("class", "x axis")
      .attr(
        "transform",
        `translate(${bandPad + 0.5},${this.layout.innerHeight})`,
      )
      .call(this.axisX);

    this.candles = this.inner
      .append("g")
      .attr("clip-path", "url(#inner-clip-path)")
      .attr("stroke", "currentColor")
      .attr("stroke-linecap", "butt") // NOTE using 'square' distorts size
      .selectAll("g")
      .data(this.data)
      .join("g")
      .attr(
        "transform",
        (d) => `translate(${this.scaleX(d.x) + this.scaleX.step() / 2.0},0)`,
      );

    this.wicks = this.candles
      .append("line")
      .attr("stroke", "currentColor")
      .attr("stroke-width", 1)
      .attr("class", "wick")
      .attr("opacity", 0.8)
      .attr("y1", this.scaleY(minY))
      .attr("y2", this.scaleY(minY));

    this.bars = this.candles
      .append("line")
      .attr("stroke-width", this.scaleX.bandwidth())
      .attr("class", (d) => barClass(d))
      .attr("y1", this.scaleY(minY))
      .attr("y2", this.scaleY(minY));

    // Volume elements are always rendered even if their height is zero
    this.axisVolume = d3
      .axisRight(this.scaleVolume)
      .ticks(1) // Never show more than 1 non-zero tick for the volume
      .tickFormat(volume)
      .tickSize(3);

    this.volume = this.inner
      .append("g")
      .attr("class", "volume")
      .attr("clip-path", "url(#inner-clip-path)")
      .attr(
        "transform",
        `translate(0,${this.layout.innerHeight - volumeHeight})`,
      );

    this.volume
      .append("g")
      .attr("transform", `translate(${this.layout.innerWidth},0)`)
      .call(this.axisVolume)
      .attr("visibility", this.volumeAxesVisibility);

    this.volumeSlots = this.volume
      .append("g")
      .attr("stroke", "currentColor")
      .attr("stroke-linecap", "butt") // NOTE using 'square' distorts size
      .selectAll("g")
      .data(this.data)
      .join("g")
      .attr(
        "transform",
        (d) => `translate(${this.scaleX(d.x) + this.scaleX.step() / 2.0},0)`,
      );

    this.volumeBars = this.volumeSlots
      .append("line")
      .attr("y1", this.scaleVolume(0))
      .attr("y2", this.scaleVolume(0))
      .attr("stroke-width", this.scaleX.bandwidth())
      .attr("class", (d) => barClass(d));

    // Brush for zoom
    this.brush = d3
      .brushX()
      .extent([
        [0, 0],
        [this.layout.innerWidth, this.layout.innerHeight],
      ])
      .on("end", this.zoom.bind(this));

    this.gBrush = this.inner
      .append("g")
      .attr("class", "brush")
      .call(this.brush.bind(this));

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

  useLog() {
    this.scaleY = this.scaleLog;
    this.update();
  }

  useLinear() {
    this.scaleY = this.scaleLinear;
    this.update();
  }

  spotlight(index) {
    // TODO We only need to pad if width is set to bandwidth instead of step
    // const pad = this.scaleX.bandwidth() * this.scaleX.paddingInner() * 0.5;

    this.spotlightBar
      .attr("x", this.scaleX(this.data[index].x))
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
      const [xm] = d3.pointer(evt);
      const index = invertBand(this.scaleX, xm - this.layout.pad.left);

      // Only trigger the callback when the index changes
      if (prevIndex && prevIndex == index) {
        return;
      }

      prevIndex = index;

      // Include the index's OHLCV data and a change from the last close
      let data = structuredClone(this.data[index]);
      data.index = index;

      if (index > 0) {
        const prev = this.data[index - 1];
        if (prev && prev.c) {
          data.prev = prev.c;
          data.delta = data.c - prev.c;
          data.percent = data.delta / prev.c;
        }
      }

      if (move) {
        move.call(this, data);
      }
    };

    const pointerleave = (evt) => {
      prevIndex = null;
      if (leave) {
        leave.call(this);
      }
    };

    this.svg
      .on("pointermove", throttle(pointermove, 20.83))
      .on("pointerleave", pointerleave);
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
    let domainY = extentData(this.data, this.start, this.end);

    this.scaleLog.domain(domainY);
    this.scaleLinear.domain(domainY);

    const axisY = d3.axisLeft(this.scaleY);

    // Re-filter the X-axis date labels
    const filteredX = filterTicks(
      this.X.slice(this.start, this.end + 1),
      this.layout,
      this.labelWidthX,
    );

    // Reset the date formatter
    const dates = makeDateFormatter();
    this.axisX.tickValues(filteredX).tickFormat(dates);

    // Update the x-axis
    const bandPad = (this.scaleX.bandwidth() * this.config.BAND_PAD) / 2;
    this.gx
      .transition()
      .duration(this.config.DURATION_MS)
      .attr(
        "transform",
        `translate(${bandPad + 0.5},${this.layout.innerHeight})`,
      )
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
      .call(axisY.ticks().tickFormat("").tickSize(-this.layout.innerWidth));

    // Update the candles
    this.candles
      .transition()
      .duration(this.config.DURATION_MS)
      .attr(
        "transform",
        (d) => `translate(${this.scaleX(d.x) + this.scaleX.step() / 2.0},0)`,
      );
    this.bars
      .transition()
      .duration(this.config.DURATION_MS)
      .attr("stroke-width", this.scaleX.bandwidth())
      .attr("y1", (d) => this.scaleY(d.o))
      .attr("y2", (d) => this.scaleY(d.c));

    this.wicks
      .transition()
      .duration(this.config.DURATION_MS)
      .attr("y1", (d) => this.scaleY(d.l))
      .attr("y2", (d) => this.scaleY(d.h));

    // Update the spotlight - ticks will move anyway, so no need to be perfect
    // TODO Instead of this.end index, it should be the last hovered index
    this.spotlightBar
      .transition()
      .duration(this.config.DURATION_MS)
      .attr("x", this.scaleX(this.data[this.end].x))
      .attr("width", this.scaleX.step());

    // Update the volume
    this.volumeSlots
      .transition()
      .duration(this.config.DURATION_MS)
      .attr(
        "transform",
        (d) => `translate(${this.scaleX(d.x) + this.scaleX.step() / 2.0},0)`,
      );

    this.volumeBars
      .transition()
      .duration(this.config.DURATION_MS)
      .attr("stroke-width", this.scaleX.bandwidth())
      .attr("y2", (d) => this.scaleVolume(d.v || 0));
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
}

export function OHLC(data, options) {
  return new Candlestick(data, options);
}

export function OHLCV(data, options) {
  return new Candlestick(data, options).showVolume();
}

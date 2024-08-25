import * as d3 from "d3";

import { Chart } from "./chart";
import { volume } from "./formats";
import { layoutSVG } from "./layout";
import { parseArrayOHLCV, parseVerboseOHLCV } from "./parsers";
import { throttle } from "./throttle";
import { maxLabelSize, filterTicksAutoOffset } from "./ticks";
import { makeDateFormatter } from "./timeseries";
import { placeTooltip } from "./tooltip";

export { parseArrayOHLCV, parseVerboseOHLCV };

function signOf(d) {
  // TODO Assumes both open and close are defined
  return 1 + Math.sign(d.o - d.c);
}

const classes = ["up", "even", "down"];

function deltaClass(d) {
  // Return's a class depending on the day's delta
  return classes[signOf(d)];
}

function zoomRange(domain, width, start, end) {
  // Return the range extent needed to zoom to the start and end indices of the domain
  let w = end - start + 1;
  let ratio = 1;
  if (w < domain.length) {
    ratio = domain.length / w;
  }
  const zoomWidth = width * ratio;
  const offsetX = (start / domain.length) * zoomWidth;
  return [0 - offsetX, zoomWidth - offsetX];
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
      DURATION_MS: 500,
      PRICE_AXIS_RIGHT: false,
      VOLUME_AXIS_RIGHT: true,
      HIDE_VOLUME_AXIS: false,
      VOLUME_TICK_COUNT: 1,
      RESCALE_Y: true,
      LAYOUT: {},

      // Additional layout padding
      // TODO Specify an additional layout?
      MARGIN_RIGHT: 10,
      MARGIN_LEFT: 10,
      MARGIN_LABEL: 10,
      MARGIN_AXES: 5,
      MARGIN_TICK: 2,
    };

    // Get data in a {x, o, h, l, c, v} format
    // TODO Warn if data wasn't parsed correctly
    this.data = d3.map(data, parser);

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
  /* End config chained methods */

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
    // Wick thickness should at least one pixel, but no greater than 1% of the band
    return d3.max([this.scaleX.bandwidth() * 0.01, 1.0]);
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

  render(selector) {
    // If there is no data, do not render
    if (!this.data.length) return;

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
      .clamp(true)
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
      .clamp(true);
    this.scaleLog = d3.scaleLog().domain(domainY).range(rangeY).clamp(true);

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

    // Reset the date formatter
    dates = this.makeDateFormatter();

    // Set the zero state
    this.scaleY = this.config.LOG_Y ? this.scaleLog : this.scaleLinear;
    const axisY = this.priceAxisIndex;

    this.axisX = d3
      .axisBottom(this.scaleX)
      .tickValues(this.xValues)
      .tickFormat(dates)
      .tickSize(3);

    let yTransform = "transform(0,0)";
    if (this.config.PRICE_AXIS_RIGHT) {
      yTransform = `translate(${this.layout.innerWidth + this.config.MARGIN_AXES},0)`;
    }

    this.gPrice = this.inner
      .append("g")
      .attr("transform", yTransform)
      .attr("class", "y axis")
      .call(axisY.tickSize(0));

    this.grid = this.inner
      .append("g")
      .attr("transform", yTransform)
      .attr("class", "grid")
      .call(axisY.tickSize(this.gridWidth));

    const bandPad = (this.scaleX.bandwidth() * this.config.BAND_PAD) / 2;

    this.price = this.inner.append("g").attr("class", "price");

    this.candles = this.price
      .append("g")
      .attr("clip-path", "url(#inner-clip-path)")
      .attr("stroke-linecap", "butt") // NOTE using 'square' distorts size
      .attr("stroke", "currentColor")
      .selectAll("g")
      .data(this.data)
      .join("g")
      .attr("class", deltaClass)
      .attr(
        "transform",
        (d) => `translate(${this.scaleX(d.x) + this.scaleX.step() / 2.0},0)`,
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

    this.volumeBars = this.volumeSlots
      .append("line")
      .attr("y1", this.scaleVolume(0))
      .attr("y2", this.scaleVolume(0))
      .attr("stroke-width", this.scaleX.bandwidth())
      .attr("class", deltaClass);

    // Elements drawn last will appear on top
    this.gx = this.inner
      .append("g")
      .attr("class", "x axis")
      .attr(
        "transform",
        `translate(${bandPad + 0.5},${this.layout.innerHeight})`,
      )
      .call(this.axisX);

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
      .call(axisY.tickFormat("").tickSize(this.gridWidth));

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
      .on("pointermove", throttle(pointermove, 20.83)) // 48 fps
      .on("pointerleave", pointerleave);
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

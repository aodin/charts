import * as d3 from "d3";

import { Layout, getLayout, appendSVG } from "./layout";
import { maxLabelSize, filterTicks } from "./ticks";
import { makeDateFormatter } from "./timeseries";
import { throttle } from "./throttle";
import { volume } from "./formats";

function signOf(d) {
  // TODO Assumes both are defined
  return 1 + Math.sign(d.o - d.c);
}

function barClass(d) {
  // Append a class to the bar depending on its delta
  const c = ["up", "even", "down"][signOf(d)];
  return ["bar", c].join(" ");
}

export function parseArray(d) {
  return {
    x: d3.isoParse(d[0]),
    o: d[1],
    h: d[2],
    l: d[3],
    c: d[4],
    v: d[5],
  };
}

export function parseVerboseObject(d) {
  return {
    x: d3.isoParse(d.date),
    o: d.open,
    h: d.high,
    l: d.low,
    c: d.close,
    v: d.volume,
  };
}

export class Candlestick {
  formatX = "%m %d, %Y";

  constructor(data, parser = (d) => d) {
    // Default config
    this.config = {
      VOLUME_RATIO: 0.0,
      LOG_Y: false,
      SCREEN_HEIGHT_FRACTION: 0.5,
      BAND_PADDING: 0.2,
      DURATION_MS: 500,
      VOLUME_AXIS_RIGHT: true,
      HIDE_VOLUME_AXIS: false,
    };

    // Get data in a {x, o, h, l, c, v} format
    this.data = d3.map(data, parser);
    // TODO Save min / max?
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

    // Determine right padding from volume ticks
    if (!this.config.HIDE_VOLUME_AXIS) {
      const [volWidth, volHeight] = maxLabelSize(
        this.layout,
        this.scaleVolume,
        volume,
      );
      this.layout.padding.right = volWidth + 5;
    }

    const minY = d3.min(d3.map(this.data, (d) => d.l));
    let domainY = [minY, d3.max(d3.map(this.data, (d) => d.h))];

    // TODO Add padding to price domain? Just use nice()?
    // const domainPaddingY = (domainY[1] - domainY[0]) * 0.1;
    // domainY = [domainY[0] - domainPaddingY, domainY[1] + domainPaddingY];

    const rangeY = [priceHeight, 0];

    // Axes
    this.scaleLog = d3.scaleLog().domain(domainY).range(rangeY).clamp(true);
    this.scaleLinear = d3
      .scaleLinear()
      .domain(domainY)
      .range(rangeY)
      .clamp(true);

    const rangeX = d3.map(this.data, (d) => d.x);

    // Get the max tick label width for the y-axis on both linear and log scales
    const [logWidth, logHeight] = maxLabelSize(this.layout, this.scaleLog);
    const [linearWidth, linearHeight] = maxLabelSize(
      this.layout,
      this.scaleLinear,
    );
    const labelWidthY = d3.max([logWidth, linearWidth]);

    // Update the left padding to fit the y-axis labels
    this.layout.padding.left = labelWidthY + 5;

    // Set the inner display
    this.inner = this.svg
      .append("g")
      .attr(
        "transform",
        `translate(${this.layout.padding.left}, ${this.layout.padding.top})`,
      );

    // Add g elements for the price and volume portions
    this.price = this.inner.append("g").attr("class", "price");

    this.volume = this.inner
      .append("g")
      .attr(
        "transform",
        `translate(0,${this.layout.innerHeight - volumeHeight})`,
      )
      .attr("class", "volume");

    this.scaleX = d3
      .scaleBand(rangeX, [0, this.layout.innerWidth])
      .paddingInner(this.config.BAND_PADDING)
      .align(0.5);
    // NOTE do not use round

    // NOTE The date formatter needs to be created because it uses a
    // closure to determine a new year
    let dates = makeDateFormatter();

    // Get the max tick label width for the x-axis
    const [labelWidth, labelHeight] = maxLabelSize(
      this.layout,
      this.scaleX,
      dates,
    );

    const X = d3.map(this.data, (d) => d.x);
    const filteredX = filterTicks(X, this.layout, labelWidth);

    // Reset the date formatter
    dates = makeDateFormatter();

    // Set the default scale
    // TODO Pass a render option? Include zoom?
    const scaleY = this.config.LOG_Y ? this.scaleLog : this.scaleLinear;

    const axisY = d3.axisLeft(scaleY).tickSize(0);
    const axisX = d3
      .axisBottom(this.scaleX)
      .tickValues(filteredX)
      .tickFormat(dates)
      .tickSize(3);

    this.elemAxisPrice = this.inner
      .append("g")
      .attr("class", "y axis")
      .attr("transform", `translate(0,0)`)
      .call(axisY)
      .call((g) =>
        g
          .selectAll(".tick line")
          .clone()
          .attr("stroke", "#bbb") // Works for black or white background at 50% opacity
          .attr("stroke-opacity", 0.5)
          .attr("x1", 0)
          .attr("x2", this.layout.innerWidth),
      );

    const bandPadding =
      (this.scaleX.bandwidth() * this.config.BAND_PADDING) / 2;

    const elemAxisX = this.inner
      .append("g")
      .attr("class", "x axis")
      .attr(
        "transform",
        `translate(${bandPadding + 0.5},${this.layout.innerHeight})`,
      )
      .call(axisX);

    this.candles = this.inner
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

    this.wicks = this.candles
      .append("line")
      .attr("stroke", "currentColor")
      .attr("stroke-width", 1)
      .attr("class", "wick")
      .attr("opacity", 0.8)
      .attr("y1", scaleY(minY))
      .attr("y2", scaleY(minY));

    this.bars = this.candles
      .append("line")
      .attr("stroke-width", this.scaleX.bandwidth())
      .attr("class", (d) => barClass(d))
      .attr("y1", scaleY(minY))
      .attr("y2", scaleY(minY));

    this.updateScale(scaleY);

    // Optional volume
    if (volumeHeight) {
      this.axisVolume = d3
        .axisRight(this.scaleVolume)
        .ticks(1) // Never show more than 1 non-zero tick for the volume
        .tickFormat(volume)
        .tickSize(3);

      if (!this.config.HIDE_VOLUME_AXIS) {
        this.volume
          .append("g")
          .attr("transform", `translate(${this.layout.innerWidth},0)`)
          .call(this.axisVolume);
      }

      this.volumeBars = this.volume
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

      this.volumeBars
        .append("line")
        .attr("y1", this.scaleVolume(0))
        .attr("y2", this.scaleVolume(0))
        .attr("stroke-width", this.scaleX.bandwidth())
        .attr("class", (d) => barClass(d))
        .transition()
        .duration(this.config.DURATION_MS)
        .attr("y2", (d) => this.scaleVolume(d.v || 0));
    }

    // Optional spotlight of a bar
    // Don't call the class "tooltip" - that interferes with Bootstrap
    this.spotlightBar = this.inner
      .append("g")
      .lower()
      .attr("class", "spotlight")
      .append("rect")
      .style("display", "none")
      .style("pointer-events", "none");
  }

  updateScale(scale) {
    this.elemAxisPrice
      .transition()
      .duration(this.config.DURATION_MS)
      .call(d3.axisLeft(scale).tickSize(0));

    this.bars
      .transition()
      .duration(this.config.DURATION_MS)
      .attr("y1", (d) => scale(d.o))
      .attr("y2", (d) => scale(d.c));

    this.wicks
      .transition()
      .duration(this.config.DURATION_MS)
      .attr("y1", (d) => scale(d.l))
      .attr("y2", (d) => scale(d.h));
  }

  useLog() {
    this.updateScale(this.scaleLog);
  }

  useLinear() {
    this.updateScale(this.scaleLinear);
  }

  spotlight(index) {
    // TODO The padding is only needed if width is set to bandwidth instead of step
    // const padding = this.scaleX.bandwidth() * this.scaleX.paddingInner() * 0.5;

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
    // The leave callback is triggered when the pointer leaves the SVG elem
    // Calculate the Voronoi of a single line of x-coordinates

    // TODO Points need to be re-calculated with scaleX changes
    const points = d3.map(this.data, (d) => [
      this.scaleX(d.x) + this.scaleX.step() / 2 + this.layout.padding.left,
      1,
    ]);
    const delaunay = d3.Delaunay.from(points);

    let prevIndex = null;

    const pointermove = (evt) => {
      const [xm] = d3.pointer(evt);
      const index = delaunay.find(xm, 1);

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
          // data.color = this.options.OHLC_COLORS[1 + Math.sign(-data.delta)];
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
}

export function OHLC(data, options) {
  return new Candlestick(data, options);
}

export function OHLCV(data, options) {
  return new Candlestick(data, options).showVolume();
}

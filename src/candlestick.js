import * as d3 from "d3";

import { Layout, getLayout } from "./layout";
import { maxLabelSize, filterTicks} from "./ticks";
import { makeDateFormatter } from "./timeseries";


function signOf(d) {
  // TODO Assumes both are defined
  return 1 + Math.sign(d.o - d.c);
}

function barClass(d) {
  // Append a class to the bar depending on its delta
  const c = ["up", "even", "down"][signOf(d)]
  return ["bar", c].join(" ");
}

export class Candlestick {

  formatX = "%m %d, %Y"

  constructor(data) {
    // Default config
    this.config = {
      VOLUME_RATIO: 0.0,
      LOG_Y: false,
      SCREEN_HEIGHT_FRACTION: 0.5,
      BAND_PADDING: 0.2,
      DURATION_MS: 500,
    };
    
    
    // TODO How to do extensible data parsing?
    // Get data in a {d, o, h, l, c, v} format
    this.data = d3.map(data, d => {
      return {
        d: d3.isoParse(d[0]),
        o: d[1],
        h: d[2],
        l: d[3],
        c: d[4],
        v: d[5],
      };
    });

    // Save min / max?

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
    this.config.VOLUME_RATIO = ratio;
    return this;
  }

  hideVolume() {
    return this.showVolume(0.0);
  }

  defaultLog() {
    this.config.LOG_Y = true;
    return this;
  }

  defaultLinear() {
    this.config.LOG_Y = false;
    return this;
  }

  // Render has three basic states
  // 1. No SVG element - use width of parent and height of screen
  // 2. SVG element without size attributes - use width of parent and height of screen
  //    - But SVG elements don't have a width???
  // 3. SVG element with size attributes - use those
  render(selector) {
    // TODO Detect SVG?
    this.svg = d3.select(selector);

    const width = +this.svg.attr("width");
    const height = +this.svg.attr("height");

    if (width && height) {
      this.layout = new Layout(width, height);
    } else {
      this.layout = getLayout(selector, {
        screenHeightFraction: this.config.SCREEN_HEIGHT_FRACTION,
      });
      console.log(this.layout.width, this.layout.height)
    }

    const volumeHeight = this.layout.innerHeight * this.config.VOLUME_RATIO;
    const priceHeight = this.layout.innerHeight - volumeHeight;

    const minY = d3.min(d3.map(this.data, d => d.l));
    let domainY = [minY, d3.max(d3.map(this.data, d => d.h))];

    // TODO Add padding to price domain?
    // TODO Just use nice?
    const domainPaddingY = (domainY[1] - domainY[0]) * 0.1;
    console.log("domainPaddingY", domainPaddingY)
    domainY = [domainY[0] - domainPaddingY, domainY[1] + domainPaddingY];

    const rangeY = [priceHeight, 0];

    // Axes
    this.scaleLog = d3.scaleLog().domain(domainY).range(rangeY).clamp(true);
    this.scaleLinear = d3.scaleLinear().domain(domainY).range(rangeY).clamp(true);

    const rangeX = d3.map(this.data, d => d.d);
    console.log("rangeX", rangeX)

    // Get the max tick label width for the y-axis on both linear and log scales

    const [logWidth, logHeight] = maxLabelSize(this.layout, this.scaleLog)
    const [linearWidth, linearHeight] = maxLabelSize(this.layout, this.scaleLinear)
    const labelWidthY = d3.max([logWidth, linearWidth]);

    console.log("Y size:", labelWidthY)

    // Update the left padding to fit the y-axis labels
    this.layout.padding.left = labelWidthY + 10;

    // Set the inner display
    this.inner = this.svg
      .append("g")
      .attr("transform", `translate(${this.layout.padding.left}, ${this.layout.padding.top})`);

    // Add g elements for the price and volume portions
    this.price = this.inner
      .append("g")
      .attr("transform", `translate(0,0)`);

    this.volume = this.inner
      .append("g")
      .attr("transform", `translate(0,${volumeHeight})`);

    this.scaleX = d3
      .scaleBand(rangeX, [0, this.layout.innerWidth])
      .paddingInner(this.config.BAND_PADDING)
      .align(0.5)
      .round(true);

    // NOTE The date formatter needs to be created because it uses a
    // closure to determine a new year
    let dates = makeDateFormatter();

    // Get the max tick label width for the x-axis
    const [labelWidth, labelHeight] = maxLabelSize(this.layout, this.scaleX, dates)
    console.log("labelWidth", labelWidth)

    const X = d3.map(this.data, d => d.d)
    const filteredX = filterTicks(X, this.layout, labelWidth);
    console.log("TICKS", filteredX)

    // Reset the date formatter
    dates = makeDateFormatter();

    // Set the default scale
    // TODO Pass a render option? Include zoom?
    const scaleY = this.config.LOG_Y ? this.scaleLog : this.scaleLinear;

    const axisY = d3.axisLeft(scaleY).tickSize(0);
    const axisX = d3.axisBottom(this.scaleX).tickValues(filteredX).tickFormat(dates);

    this.elemAxisY = this.inner
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

    const bandPadding = (this.scaleX.bandwidth() * this.config.BAND_PADDING) / 2;

    const elemAxisX = this.inner
      .append("g")
      .attr("class", "x axis")
      .attr("transform", `translate(${bandPadding+0.5},${this.layout.innerHeight})`)
      .call(axisX)

    console.log("this.scaleX.step()", this.scaleX.step())
    console.log("this.scaleX.bandwidth()", this.scaleX.bandwidth())

    this.candles = this.inner
      .append("g")
      .attr("stroke", "currentColor")
      .attr("stroke-linecap", "butt") // NOTE using 'square' distorts size
      .selectAll("g")
      .data(this.data)
      .join("g")
      .attr(
        "transform",
        (d) => `translate(${this.scaleX(d.d) + this.scaleX.step() / 2.0},0)`,
      );

    this.wicks = this.candles.append("line")
      .attr("stroke", "currentColor")
      .attr("stroke-width", 1)
      .attr("class", "wick")
      .attr("opacity", 0.8)
      .attr("y1", scaleY(minY))
      .attr("y2", scaleY(minY))

    this.bars = this.candles.append("line")
      .attr("stroke-width", this.scaleX.bandwidth())
      .attr("class", (d) => barClass(d))
      .attr("y1", scaleY(minY))
      .attr("y2", scaleY(minY))

    this.updateScale(scaleY);

    // Optional spotlight of a bar
    // Don't call the class "tooltip" - that interferes with Bootstrap
    this.spotlightBar = this.svg
      .append("g")
      .lower()
      .attr("class", "spotlight")
      .append("rect")
      .style("display", "none")
      .style("pointer-events", "none");
  }

  updateScale(scale) {
    this.elemAxisY.transition()
      .duration(this.config.DURATION_MS)
      .call(d3.axisLeft(scale).tickSize(0));

    this.bars.transition()
      .duration(this.config.DURATION_MS)
      .attr("y1", (d) => scale(d.o))
      .attr("y2", (d) => scale(d.c));

    this.wicks.transition()
      .duration(this.config.DURATION_MS)
      .attr("y1", (d) => scale(d.l))
      .attr("y2", (d) => scale(d.h));
  }

  useLog() {
    this.updateScale(this.scaleLog)
  }

  useLinear() {
    this.updateScale(this.scaleLinear)
  }

  spotlight(index) {
    this.spotlightBar
      .attr("x", this.scaleX(this.data[index].d))
      .attr("width", this.scaleX.bandwidth())
      .attr("y", this.layout.padding.top)
      .attr("height", this.layout.innerHeight)
      .style("display", "block");
  }

  noSpotlight() {
    this.spotlightBar.style("display", "none");
  }
}

export function OHLC(data, options) {
  return new Candlestick(data, options);
}

export function OHLCV(data, options) {
  return new Candlestick(data, options).showVolume();
}

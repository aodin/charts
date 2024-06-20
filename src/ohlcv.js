/*
OHLCV chart
*/
import * as d3 from "d3";

import { maxTickWidth, Padding } from "./layout";
import { Chart } from "./chart";
import { makeDateFormatter } from "./timeseries";
import { throttle } from "./throttle";
import { volume } from "./formats";

export class OHLCV extends Chart {
  parse(data) {
    this.X = d3.map(data, (d) => d3.isoParse(d[0]));
    this.Yo = d3.map(data, (d) => d[1]);
    this.Yh = d3.map(data, (d) => d[2]);
    this.Yl = d3.map(data, (d) => d[3]);
    this.Yc = d3.map(data, (d) => d[4]);
    this.Yv = d3.map(data, (d) => d[5]);
    this.I = d3.range(this.X.length);
  }

  getPadding(layout) {
    const padding = new Padding(15, 25, 25, 40);

    // Adjust the left padding to accommodate the price ticks
    padding.left = maxTickWidth(
      padding,
      this.layout.height,
      this.getDomainY(),
      this.tickFormatY,
      this.options,
    );

    // Adjust the right padding to accommodate the volume tick
    padding.right = maxTickWidth(
      padding,
      this.layout.height,
      this.yDomainVolume,
      volume,
      this.options,
    );
    return padding;
  }

  getDomainX() {
    return d3.extent(this.X);
  }

  getDomainY() {
    // TODO How to pad?
    // TODO How to set multiple domains? Data object
    this.minPrice = d3.min(this.Yl); // Sets the initial animation y-coord
    const maxPrice = d3.max(this.Yh);
    this.yDomain = [
      this.minPrice,
      maxPrice + (maxPrice - this.minPrice) * 0.05,
    ];
    this.yDomainVolume = [0, d3.max(this.Yv)];
    return this.yDomain;
  }

  getColor(index) {
    return this.options.OHLC_COLORS[
      1 + Math.sign(this.Yo[index] - this.Yc[index])
    ];
  }

  getXTicks() {
    // For categorical data, it is useful to filter the displayed X ticks
    // NOTE If dates are missing, we can't use the timeWeek ranges without
    // checking if the tick has values
    const xTickCount = this.options.getXTickCount(this.layout.innerWidth);
    let interval = parseInt(this.X.length / xTickCount);
    if (interval < 1) {
      interval = 1;
    }
    return d3.filter(this.X, (d, i) => i % interval === 0);
  }

  render(elem, useLog) {
    // Determine the size of the DOM element
    this.layout = this.getLayout(elem);
    this.layout.padding = this.getPadding(this.layout);

    const pricePortion = 0.9;
    const priceHeight = this.layout.innerHeight * pricePortion;

    const yRange = [
      this.layout.padding.top + priceHeight,
      this.layout.padding.top,
    ];

    const yRangeVolume = [
      this.layout.padding.top + this.layout.innerHeight,
      this.layout.padding.top + priceHeight,
    ];

    // Construct scales and axes
    // NOTE scaleBand takes all 'categorical' x-axis items - not just extent
    this.xScale = d3
      .scaleBand(this.X, this.getRangeX(this.layout))
      .padding(this.options.BAND_PADDING)
      .align(0.1);

    const yScale = useLog
      ? d3.scaleLog(this.getDomainY(), yRange)
      : d3.scaleLinear(this.getDomainY(), yRange);
    const yScaleVolume = d3.scaleLinear(this.yDomainVolume, yRangeVolume);

    // NOTE The date formatter needs to be created because it uses a
    // closure to determine a new year
    const dateFormatter = makeDateFormatter();
    const xAxis = d3
      .axisBottom(this.xScale)
      .tickFormat(dateFormatter)
      .tickValues(this.getXTicks())
      .tickSize(this.options.X_TICK_SIZE);

    // The band width will be used for correctly positioning the tooltip
    this.bandWidth = this.xScale.step();

    const yAxis = d3
      .axisLeft(yScale)
      .tickValues(this.getTickValuesY())
      .tickFormat(this.tickFormatY)
      .tickSize(this.options.Y_TICK_SIZE);

    // TODO Tick count just hides tick labels
    // .ticks(this.options.getYTickCount(priceHeight))

    const yAxisVolume = d3
      .axisRight(yScaleVolume)
      .ticks(1) // Never show more than 1 non-zero tick for the volume
      .tickFormat(volume)
      .tickSize(3);

    // Create SVG
    this.createSVG(elem, this.layout);

    const bandPadding = (this.bandWidth * this.options.BAND_PADDING) / 2;

    // X-axis
    this.svg
      .append("g")
      .style("font-size", this.options.FONT_SIZE)
      .attr(
        "transform",
        `translate(${bandPadding},${this.layout.height - this.layout.padding.bottom + this.options.X_TICK_GUTTER})`,
      )
      .call(xAxis)
      .call((g) => g.select(".domain").remove());

    // Price y-axis
    this.svg
      .append("g")
      .style("font-size", this.options.FONT_SIZE)
      .attr(
        "transform",
        `translate(${this.layout.padding.left - this.options.Y_TICK_GUTTER},0)`,
      )
      .call(yAxis)
      .call((g) => g.select(".domain").remove())
      .call((g) =>
        g
          .selectAll(".tick line")
          .clone()
          .attr("stroke", "#bbb") // Works for black or white background at 50% opacity
          .attr("stroke-opacity", 0.5)
          .attr("x1", this.options.Y_TICK_GUTTER)
          .attr("x2", this.layout.innerWidth + this.options.Y_TICK_GUTTER),
      );

    // Volume y-axis
    this.svg
      .append("g")
      .style("font-size", this.options.FONT_SIZE)
      .attr(
        "transform",
        `translate(${this.layout.width - this.layout.padding.right},0)`,
      )
      .call(yAxisVolume)
      .call((g) => g.select(".domain").remove());

    // Plot OHLC candle sticks
    const g = this.svg
      .append("g")
      .attr("stroke", "currentColor")
      .attr("stroke-linecap", "butt") // NOTE using 'square' distorts size
      .selectAll("g")
      .data(this.I)
      .join("g")
      .attr(
        "transform",
        (i) => `translate(${this.xScale(this.X[i]) + this.bandWidth / 2.0},0)`,
      );

    g.append("line")
      .attr("stroke", "currentColor")
      .attr("stroke-width", 1)
      .attr("opacity", 0.8)
      .attr("y1", yScale(this.minPrice))
      .attr("y2", yScale(this.minPrice))
      .transition()
      .duration(this.options.ANIMATION_DURATION_MS)
      .attr("y1", (i) => yScale(this.Yl[i]))
      .attr("y2", (i) => yScale(this.Yh[i]));

    g.append("line")
      .attr("stroke-width", this.xScale.bandwidth())
      .attr("stroke", (i) => this.getColor(i))
      .attr("y1", yScale(this.minPrice))
      .attr("y2", yScale(this.minPrice))
      .transition()
      .duration(this.options.ANIMATION_DURATION_MS)
      .attr("y1", (i) => yScale(this.Yo[i]))
      .attr("y2", (i) => yScale(this.Yc[i]));

    // Plot volume
    const vol = this.svg
      .append("g")
      .attr("stroke", "currentColor")
      .attr("stroke-linecap", "butt") // NOTE using 'square' distorts length
      .selectAll("g")
      .data(this.I)
      .join("g")
      .attr(
        "transform",
        (i) => `translate(${this.xScale(this.X[i]) + this.bandWidth / 2.0},0)`,
      );

    vol
      .append("line")
      .attr("y1", yScaleVolume(0))
      .attr("y2", yScaleVolume(0))
      .attr("stroke-width", this.xScale.bandwidth())
      .attr("stroke", (i) => this.getColor(i))
      .style("opacity", this.options.VOLUME_OPACITY)
      .transition()
      .duration(this.options.ANIMATION_DURATION_MS)
      .attr("y2", (i) => yScaleVolume(this.Yv[i]));

    // Optional tooltip / highlighting of day
    // TODO Give the tooltip a class
    this.tooltip = this.svg
      .append("g")
      .lower()
      .attr("class", "tooltip")
      .append("rect")
      .attr("fill", "#bbb")
      .style("display", "none")
      .style("opacity", 0.2)
      .style("pointer-events", "none");
  }

  highlight(index) {
    // Update tooltip
    this.tooltip
      .attr("x", this.xScale(this.X[index]))
      .attr("width", this.bandWidth)
      .attr("y", this.layout.padding.top)
      .attr("height", this.layout.innerHeight)
      .style("display", "block");
  }

  noHighlight() {
    this.tooltip.style("display", "none");
  }

  enableHover(move, leave) {
    // Enable hover events for the chart. On move, determine which band is being
    // hovered over and send an object of its OHLCV data to the move callback.
    // The leave callback is triggered when the pointer leaves the SVG elem
    // Calculate the Voronoi of a single line of x-coordinates
    const points = d3.map(this.X, (d) => [
      this.xScale(d) + this.bandWidth / 2,
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
      let data = {
        i: index,
        x: this.X[index],
        o: this.Yo[index],
        h: this.Yh[index],
        l: this.Yl[index],
        c: this.Yc[index],
        v: this.Yv[index],
        // TODO Return formatted values?
      };

      if (index > 0) {
        data.prev = this.Yc[index - 1];
        if (data.prev) {
          data.delta = data.c - data.prev;
          data.percent = data.delta / data.prev;
          data.color = this.options.OHLC_COLORS[1 + Math.sign(-data.delta)];
        }
      }

      // TODO Always enable highlight?
      if (move) {
        move.call(this, data);
      }
    };

    this.svg.on(
      "pointermove",
      throttle(pointermove, this.options.eventLatency),
    );

    if (leave) {
      this.svg.on("pointerleave", leave);
    }
  }
}

/*
OHLCV chart
*/
import * as d3 from "d3";

import { maxTickWidth } from "./layout";
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

  getMargin(width, height) {
    const margin = {
      top: 15,
      right: 25,
      bottom: 25,
      left: 40,
    };

    // Adjust the left margin to accommodate the price ticks
    margin.left = maxTickWidth(
      margin,
      height,
      this.getDomainY(),
      this.tickFormatY,
      this.options,
    );

    // Adjust the right margin to accommodate the volume tick
    margin.right = maxTickWidth(
      margin,
      height,
      this.yDomainVolume,
      volume,
      this.options,
    );
    return margin;
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

  render(elem) {
    // Determine the size of the DOM element
    const [width, height] = this.getDimensions(elem);
    const dimensions = { width, height };
    const margin = this.getMargin(width, height);

    // TODO How to generalize different chart sections? sub-axes?
    const chartHeight = height - margin.top - margin.bottom;
    this.chartHeight = chartHeight;
    const pricePortion = 0.9;
    const priceHeight = chartHeight * pricePortion;

    const yRange = [margin.top + priceHeight, margin.top];
    const yRangeVolume = [margin.top + chartHeight, margin.top + priceHeight];

    const yFormat = ",f";
    const yLabel = "";

    // NOTE If dates are missing, we can't use the timeWeek ranges without
    // checking if the tick has values
    // TODO Number of x-ticks, number of y-ticks - function of width?
    let interval = parseInt(this.X.length / 10);
    if (interval < 1) {
      interval = 1;
    }

    let xTicks = d3.filter(this.X, (d, i) => i % interval === 0);

    // Construct scales and axes
    // NOTE scaleBand takes all 'categorical' x-axis items - not just extent
    // TODO Play further with padding and align
    this.xScale = d3
      .scaleBand(this.X, this.getRangeX(dimensions, margin))
      .padding(this.options.BAND_PADDING)
      .align(0.1);
    const yScale = d3.scaleLinear(this.getDomainY(), yRange);
    const yScaleVolume = d3.scaleLinear(this.yDomainVolume, yRangeVolume);

    // NOTE The date formatter needs to be created because it uses a
    // closure to determine a new year
    // TODO A method to provide custom formatting
    const dateFormatter = makeDateFormatter();
    const xAxis = d3
      .axisBottom(this.xScale)
      .tickFormat(dateFormatter)
      .tickValues(xTicks)
      .tickSize(this.options.X_TICK_SIZE);

    // The band width will be used for correctly positioning the tooltip
    this.bandWidth = this.xScale.step();

    // TODO Set number of ticks
    const yAxis = d3
      .axisLeft(yScale)
      .ticks(priceHeight / 40, yFormat)
      .tickSize(this.options.Y_TICK_SIZE);

    const yAxisVolume = d3
      .axisRight(yScaleVolume)
      .ticks(1) // Never show more than 1 non-zero tick for the volume
      .tickFormat(volume)
      .tickSize(3);

    // Create SVG
    this.createSVG(elem, dimensions);

    const bandPadding = (this.bandWidth * this.options.BAND_PADDING) / 2;

    // X-axis
    this.svg
      .append("g")
      .style("font-size", this.options.FONT_SIZE)
      .attr(
        "transform",
        `translate(${bandPadding},${height - margin.bottom + this.options.X_TICK_GUTTER})`,
      )
      .call(xAxis)
      .call((g) => g.select(".domain").remove());

    // Price y-axis
    this.svg
      .append("g")
      .style("font-size", this.options.FONT_SIZE)
      .attr(
        "transform",
        `translate(${margin.left - this.options.Y_TICK_GUTTER},0)`,
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
          .attr(
            "x2",
            width + this.options.Y_TICK_GUTTER - margin.left - margin.right,
          ),
      )
      .call((g) =>
        g
          .append("text")
          .attr("x", -margin.left)
          .attr("y", 10)
          .attr("fill", "currentColor")
          .attr("text-anchor", "start")
          .text(yLabel),
      );

    // Volume y-axis
    this.svg
      .append("g")
      .style("font-size", this.options.FONT_SIZE)
      .attr("transform", `translate(${width - margin.right},0)`)
      .call(yAxisVolume)
      .call((g) => g.select(".domain").remove())
      .call((g) =>
        g
          .append("text")
          .attr("x", -margin.left)
          .attr("fill", "currentColor")
          .attr("text-anchor", "start")
          .text(yLabel),
      );

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

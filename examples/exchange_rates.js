/*
Example exchange rate chart that extends a line chart
*/
import { Line } from "../line";
import { discreteColorMap } from "../colors";

const percentChange = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});

function Q(d) {
  // Format a Date as a quarter and year
  const q = parseInt(d.getUTCMonth() / 3) + 1;
  return `${q}Q ${d.getUTCFullYear()}`;
}

export class ExchangeRates extends Line {
  tickFormatY = d3.format(",.1%");
  tickFormatX = (v, i) => v.getUTCFullYear();

  getMargin(height) {
    // Create a fake axis to test label tick size
    const hidden = d3
      .select("body")
      .append("svg")
      .attr("width", 500)
      .attr("height", height)
      .style("visibility", "hidden"); // "display: none" does not work

    const margin = {
      top: 15,
      right: 15,
      bottom: 15,
      left: 15,
    };

    let yScale = d3
      .scaleLinear()
      .domain(this.getDomainY())
      .range(this.getRangeY({ width: 0, height }, margin));

    let yAxis = d3
      .axisLeft(yScale)
      .tickFormat(this.tickFormatY)
      .tickSize(0)
      .ticks(8); // TODO Number of ticks

    const g = hidden
      .append("g")
      .style("font-size", this.options.FONT_SIZE)
      .call(yAxis);

    // Measure the tick labels
    const labels = g.selectAll(".tick text");

    // const labels2 = g.selectAll(".tick text");
    // console.log(labels2, typeof(labels2), labels2.text());

    let width = margin.left;
    labels.each(function () {
      const bbox = this.getBBox();
      if (bbox.width > width) {
        width = bbox.width;
      }
    });

    // Add some padding
    margin.left = width + this.options.X_TICK_GUTTER + 5;
    return margin;
  }

  getTickValuesX() {
    // Show a tick on the Q1 of every year, instead of Jan 1st
    const [start, end] = this.getDomainX();
    const years = d3.range(
      start.getUTCFullYear() + 1,
      end.getUTCFullYear() + 1,
    );
    return d3.map(years, (year) => new Date(year, 2, 31));
  }

  parse(data, hide) {
    // Parse data object, determine:
    // * x, y, z values as desired types
    // * items lookup by any property
    // * color mapping (discrete / scale)
    // Is defined lookup
    // grouping? for tooltips?
    let values = data.values;
    if (hide && hide.size > 0) {
      // Remove the items from the values before parsing
      values = data.values.filter((item) => !hide.has(item[1]));
    }

    // TODO This data parse is specific to line series data
    this.X = d3.map(values, (d) => d3.isoParse(d[0]));
    this.Y = d3.map(values, (d) => d[2]);
    this.Z = d3.map(values, (d) => d[1]);

    // Items stores additional info on Z axis keys
    this.items = data.items;

    // The items use abbrev as a key
    this.byKey = Object.fromEntries(this.items.map((obj) => [obj.abbrev, obj]));

    // Defined?
    // TODO This doesn't work for missing values
    const defined = (d, i) => !isNaN(this.X[i]) && !isNaN(this.Y[i]);
    this.D = d3.map(values, defined);

    // grouping
    this.I = d3.range(this.X.length);
    this.grouping = d3.group(this.I, (i) => this.Z[i]); // {name: [indexes...]}

    // Colors
    // TODO discrete v continuous?
    this.setColors(data);
  }

  hide(items, elem) {
    this.clear();
    this.parse(this.data, new Set(items));
    this.render(elem);
  }

  setColors(data) {
    const abbrevs = d3.map(this.items, (d) => d.abbrev);
    const colors = discreteColorMap(abbrevs, d3.interpolateRainbow);
    this.colors = d3.scaleOrdinal().domain(abbrevs).range(colors);
  }

  formatX(value) {
    // Function for formatting X values, called before sending to hover data callbacks
    return Q(value);
  }

  formatY(value) {
    // Function for formatting Y values, called before sending to hover data callbacks
    return percentChange.format(value);
  }

  formatZ(key) {
    // Function for formatting Z values, called before sending to hover data callbacks
    return this.byKey[key].name;
  }

  getLegend() {
    // Return the z items along with their colors
    return d3.map(this.items, (d) => {
      return Object.assign({ color: this.getColor(d.abbrev) }, d);
    });
  }
}

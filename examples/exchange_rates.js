/*
Example exchange rate chart that extends a line chart
*/
import { Line } from "../line";
import { maxTickWidth } from "../layout";
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

  getMargin(width, height) {
    const margin = {
      top: 15,
      right: 15,
      bottom: 15,
      left: 15,
    };

    margin.left = maxTickWidth(
      margin,
      height,
      this.getDomainY(),
      this.tickFormatY,
      this.options,
    )

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

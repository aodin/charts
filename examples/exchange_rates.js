/*
Example exchange rate chart that extends a line chart
*/
import { Line } from "../line";
import { discreteColorMap } from "../colors"

export class ExchangeRates extends Line {
  parse(data) {
    // Parse data object, determine:
    // * x, y, z values as desired types
    // * items lookup by any property
    // * color mapping (discrete / scale)
    // Is defined lookup
    // grouping? for tooltips?

    // TODO This data parse is specific to line series data
    this.X = d3.map(data.values, (d) => d3.isoParse(d[0]));
    this.Y = d3.map(data.values, (d) => d[2]);
    this.Z = d3.map(data.values, (d) => d[1]);

    this.z = data.categories;

    // Defined?
    // TODO This doesn't work for missing values
    const defined = (d, i) => !isNaN(this.X[i]) && !isNaN(this.Y[i]);
    this.D = d3.map(data.values, defined);

    // grouping
    this.I = d3.range(this.X.length);
    this.grouping = d3.group(this.I, (i) => this.Z[i]); // {name: [indexes...]}

    // Colors
    // TODO discrete v continuous?
    this.setColors(data);
  }

  setColors(data) {
    const abbrevs = d3.map(data.categories, (d) => d.abbrev);
    const colors = discreteColorMap(abbrevs, d3.interpolateRainbow);
    this.colors = d3.scaleOrdinal().domain(abbrevs).range(colors);
  }
}

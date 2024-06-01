// Parse basic timeseries data, with indexes:
// [0] = X data
// [1] = Y data
// [2] = Z data (or categorical)

// TODO How to pass categories via data?

export class TimeseriesData {
  constructor() {
    this.X = d3.map(data.values, (d) => d3.isoParse(d[0]));
    this.Y = d3.map(data.values, (d) => d[1]);
    this.Z = d3.map(data.values, (d) => d[2]);
  }

  // TODO getters?

  getDomainX() {
    return d3.extent(this.X);
  }

  getRangeX(dimensions, margin) {
    return [margin.left, dimensions.width - margin.right];
  }

  getDomainY() {
    return d3.extent(this.Y);
  }

  getRangeY(dimensions, margin) {
    return [dimensions.height - margin.bottom, margin.top];
  }
}

// Parse basic timeseries data, with indexes:
// [0] = X data
// [1] = Y data
// [2] = Z data (or categorical items)

class Data {
  // TODO Separate into values and items?
  // Optional tick values?
}

export class TimeseriesArray {
  // By default, the Data parsing assumes that values are an array of arrays,
  // e.g. values = [[x, y, z], [x, y, z]...], with the X value being an ISO timestamp.
  constructor(data) {
    this.X = d3.map(data, (d) => d3.isoParse(d[0]));
    this.Y = d3.map(data, (d) => d[1]);
    this.Z = d3.map(data, (d) => d[2]);
    this.D = getDefined(data);

    // By default, the list of items are determined from distinct Z values
    this.items = new Set(this.Z);
  }

  getItems(data) {
    // By default, items are determined by unique values
    // TODO They should be in order of appearance in the values
  }

  getDefined(data) {
    // Determine if the values at a given index are defined
    // TODO How to test all possible dimensions for what's missing?
    // TODO Should this use the already parsed values?
    const defined = (d, i) => !isNaN(d[i][0]) && !isNaN(d[i][1]);
    return d3.map(data, defined);
  }

  // TODO Use getters?

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

// How to handle items?
// If they exist, they are either a:
// 1. Single value: string/number
// 2. Object, with one property being what's in the values

// We can always use mappers...

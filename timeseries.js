const monthFormat = d3.timeFormat("%B %Y");

// Depending on x-axis size, either show Q1s or all quarters as x-axis ticks
// let qs = new d3.InternSet(this.X);
// if (qs.size > 15) {
//   const [start, end] = d3.extent(this.X);
//   const years = d3.range(start.getUTCFullYear(), end.getUTCFullYear() + 1);
//   qs = d3.map(years, (year) => new Date(year, 2, 31));
// }

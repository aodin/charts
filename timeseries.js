export const month = d3.utcFormat("%b");
export const monthDay = d3.utcFormat("%b %-d");
export const monthYear = d3.utcFormat("%b %Y");
export const monthDayYear = d3.utcFormat("%b %-d, %Y");
export const fullMonthDayYear = d3.utcFormat("%B %-d, %Y");

export function makeDateFormatter() {
  let lastYear = null;
  return function (d) {
    const year = d.getUTCFullYear();
    if (lastYear !== year) {
      lastYear = year;
      return monthDayYear(d);
    }
    return monthDay(d);
  };
}

export function makeMonthlyDateFormatter() {
  let lastYear = null;
  return function (d) {
    const year = d.getUTCFullYear();
    if (lastYear !== year) {
      lastYear = year;
      return monthYear(d);
    }
    return month(d);
  };
}

// Depending on x-axis size, either show Q1s or all quarters as x-axis ticks
// let qs = new d3.InternSet(this.X);
// if (qs.size > 15) {
//   const [start, end] = d3.extent(this.X);
//   const years = d3.range(start.getUTCFullYear(), end.getUTCFullYear() + 1);
//   qs = d3.map(years, (year) => new Date(year, 2, 31));
// }

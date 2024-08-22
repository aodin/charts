import * as d3 from "d3";

export function lowerBoundDigits(values, bound = 0.1) {
  // How many significant digits are needed to represent the lower bound of values?
  if (!values || !values.length) {
    return null;
  }
  // Only works for positive values
  const lowerBound = d3.quantile(values, bound);
  if (lowerBound > 0) {
    return parseInt(Math.floor(Math.log10(lowerBound)));
  }
  return null;
}

export function divideData(data, value = 1.0) {
  return d3.map(data, (d) => ({ ...d, y: d.y ? d.y / value : d.y }));
}

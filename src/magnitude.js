import * as d3 from "d3";

export function lowerBoundDigits(values, bound = 0.1) {
  // Determine how many significant digits should be used to represent the lower
  // bound of values
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

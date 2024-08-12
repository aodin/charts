import * as d3 from "d3";

export function quantizeScheme(n, scheme, min = 0.0, max = 1.0) {
  if (n === 1) {
    // If there is only one item, just use the middle of the scheme
    return [scheme((max - min) / 2.0 + min)];
  }
  return d3.quantize((t) => scheme(t * (max - min) + min), n);
}

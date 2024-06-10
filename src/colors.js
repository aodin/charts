export function discreteColorMap(items, colorMap, start = 0.0, end = 1.0) {
  const range = end - start;
  const step = items.length > 1 ? range / items.length : range / 2;
  return d3.map(items, (d, i) => colorMap(end - step * i - step / 2));
}

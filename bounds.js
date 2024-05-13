export function getBounds(
  elem,
  { ratio = 0.2, maxWidth = 1600, minWidth = 400, minHeight = 300 } = {},
) {
  const plot = document.querySelector(elem);
  let width = d3.min([plot.offsetWidth, maxWidth]);
  width = d3.max([plot.offsetWidth, minWidth]);
  let height = d3.max([parseInt(ratio * width), minHeight]);
  return [width, height];
}

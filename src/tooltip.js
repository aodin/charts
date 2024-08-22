export function placeTooltip(container, tooltip, dx, dy, padding=5) {
  // Return x and y offsets and the text-align that will optimally place the tooltip
  // in the container. The container and tooltip must be DOM elements with offset
  // properties. The dx and dy should be relative to the top-left of the container.
  let x = 0;
  let y = -tooltip.offsetHeight - padding;
  let align = "left";

  if (dx > (container.offsetWidth - tooltip.offsetWidth - padding)) {
    // Right side of container
    x = -tooltip.offsetWidth - padding;
    align = "right";
  }

  if (dy < (container.offsetHeight - tooltip.offsetHeight - padding)) {
    // Top of the container
    y = padding;
  }

  return [x, y, align];
}

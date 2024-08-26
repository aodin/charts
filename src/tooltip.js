export function placeTooltip(container, tooltip, dx, dy, padding = 5) {
  // Returns x and y page coordinates and text-align that will optimally place the
  // tooltip in the container. The container and tooltip must be DOM elements with
  // offset properties. The dx and dy should be relative to the top-left of the svg.
  let x = 0;
  let y = -tooltip.offsetHeight - padding;
  let align = "left";

  // TODO Limit these to half the container?
  if (dx > container.offsetWidth - tooltip.offsetWidth - padding) {
    // Right side of container
    x = -tooltip.offsetWidth - padding;
    align = "right";
  }

  if (dy < tooltip.offsetHeight + padding) {
    // Top of the container
    y = padding;
  }

  return [x + container.offsetLeft + dx, y + container.offsetTop + dy, align];
}

export function placeTooltipTop(container, tooltip, dx, dy, padding = 5) {
  // Similar to placeTooltip, but always places the tooltip above the dx, dy

  let x = 0;
  let y = -tooltip.offsetHeight - padding;
  let align = "left";

  // TODO Limit these to half the container?
  if (dx > container.offsetWidth - tooltip.offsetWidth - padding) {
    // Right side of container
    x = -tooltip.offsetWidth - padding;
    align = "right";
  }

  return [x + container.offsetLeft + dx, y + container.offsetTop + dy, align];
}

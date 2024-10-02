export function placeTooltip(container, tooltip, dx, dy, padding = 5) {
  // Returns x and y page coordinates and text-align that will optimally place the
  // tooltip in the container. The container and tooltip must be DOM elements with
  // offset properties. The dx and dy should be page x and y of the event.
  const bbox = container.getBoundingClientRect();
  const px = dx - bbox.left - window.scrollX;
  const py = dy - bbox.top - window.scrollY;

  let x = padding;
  let y = -tooltip.offsetHeight - padding;
  let align = "left";

  // TODO Limit to half the container?
  if (px > bbox.width - tooltip.offsetWidth - padding) {
    // Right side of container
    x = -tooltip.offsetWidth - padding;
    align = "right";
  }

  if (py < tooltip.offsetHeight + padding) {
    // Top of the container
    y = padding;
  }

  return [dx + x, dy + y, align];
}

export function placeTooltipTop(container, tooltip, dx, dy, padding = 5) {
  // Similar to placeTooltip, but always places the tooltip above the dx, dy
  const bbox = container.getBoundingClientRect();
  const px = dx - bbox.left - window.scrollX;

  let x = padding;
  let y = -tooltip.offsetHeight - padding;
  let align = "left";

  // TODO Limit to half the container?
  if (px > bbox.width - tooltip.offsetWidth - padding) {
    // Right side of container
    x = -tooltip.offsetWidth - padding;
    align = "right";
  }

  return [dx + x, dy + y, align];
}

export function pageXY(node) {
  // Get the page x and y of the given node
  const svg = node.ownerSVGElement || node;
  if (svg.createSVGPoint) {
    let point = svg.createSVGPoint();
    point = point.matrixTransform(node.getScreenCTM());
    return [point.x + +window.scrollX, point.y + +window.scrollY];
  }
  if (node.getBoundingClientRect) {
    // Calculate the page coordinates by adding the scroll offsets
    const rect = node.getBoundingClientRect();
    return [rect.left + window.scrollX, rect.top + window.scrollY];
  }
  return [undefined, undefined];
}

/*
Animation helper functions.
*/

import * as d3 from "d3";

export function animatedDashArray(pattern, totalLength) {
  // Returns the stroke-dasharray string that can be used to animate a dashed line
  // Pattern should be given as an array of integers
  const dash = pattern.join(" "); // The pattern that will be repeated as a string
  const dashLength = d3.sum(pattern);
  const count = Math.ceil(totalLength / dashLength);
  const repeated = Array.from({ length: count }).join(dash + " ");

  // After the repeated portion, show an empty section the length of the line
  // This empty section will give the appearance of opening as its offset is changed
  return `${repeated} 0 ${Math.ceil(totalLength)}`;
}

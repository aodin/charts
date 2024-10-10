/*
Animation helper functions.
*/

import * as d3 from "d3";

export function animatedDashArray(pattern, totalLength) {
  pattern = pattern || [];
  // Returns the stroke-dasharray string that can be used to animate a dashed line
  // Pattern should be an array of integers, with an empty array being a solid line
  if (!pattern.length) return `${totalLength} ${totalLength}`;

  if (pattern.length % 2) {
    pattern = pattern.concat(pattern);
  }

  const dash = pattern.join(" "); // The pattern that will be repeated as a string
  const dashLength = d3.sum(pattern);
  if (!dashLength) return `${totalLength} ${totalLength}`;
  const count = Math.ceil(totalLength / dashLength);
  const repeated = new Array(count).fill(dash).join(" ");

  // After the repeated portion, show an empty section the length of the line
  // This empty section will give the appearance of opening as its offset is changed
  return `${repeated} 0 ${Math.ceil(totalLength)}`;
}

export function animatedDashOffset(pattern, totalLength) {
  // Returns the stroke-dashoffset string that can be used to animate a dashed line
  pattern = pattern || [];

  if (pattern.length % 2) {
    pattern = pattern.concat(pattern);
  }

  const dashLength = d3.sum(pattern);
  if (dashLength) {
    return (t) => Math.round(((1 - t) * totalLength) / dashLength) * dashLength;
  }
  return d3.interpolate(totalLength, 0);
}

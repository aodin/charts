import * as d3 from "d3";

export const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
}).format;

export const percentChange = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
}).format;

export const magnitude = new Intl.NumberFormat("en-US", {
  notation: "compact",
  compactDisplay: "short",
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
}).format;

export const units = d3.format(",.0f");

export const volume = function (value) {
  if (!value) return; // Never show 0
  if (value >= 1e9) return `${value / 1e9}B`; // Billions
  if (value >= 1e6) return `${value / 1e6}M`; // Millions
  return units(value);
};

import * as d3 from "d3";

export const month = d3.utcFormat("%b");
export const monthDay = d3.utcFormat("%b %-d");
export const monthYear = d3.utcFormat("%b %Y");
export const monthDayYear = d3.utcFormat("%b %-d, %Y");
export const fullMonthDayYear = d3.utcFormat("%B %-d, %Y");

export function makeDateFormatter() {
  let lastYear = null;
  return function (d) {
    const year = d.getUTCFullYear();
    if (lastYear !== year) {
      lastYear = year;
      return monthDayYear(d);
    }
    return monthDay(d);
  };
}

export function makeMonthlyDateFormatter() {
  let lastYear = null;
  return function (d) {
    const year = d.getUTCFullYear();
    if (lastYear !== year) {
      lastYear = year;
      return monthYear(d);
    }
    return month(d);
  };
}

export function quarter(d) {
  // Format a Date as a quarter and year
  const q = parseInt(d.getUTCMonth() / 3) + 1;
  return `${q}Q ${d.getUTCFullYear()}`;
}

export const year = (d) => d.getUTCFullYear();

export function quarterToIso(value) {
  // Convert a quarter in the format (q)Q(yyyy) - e.g. 1Q2024 - to an ISO date
  value = String(value).replace(" ", "");
  let year = "";
  if (value.length === 4) {
    year = `20${value.substring(2)}`;
  } else if (value.length === 6) {
    year = value.substring(2);
  }
  if (!year) return null;
  let q = parseInt(value.substring(0, 1));
  let month = `${q * 3}`.padStart(2, "0");
  let day = ["", "31", "30", "30", "31"][q];
  return d3.isoParse(`${year}-${month}-${day}`);
}

export function yearToIso(value) {
  // Convert a year to an ISO date
  if (value.length !== 4) return null;
  const year = parseInt(value);
  return d3.isoParse(`${year}-01-01`);
}

export function unixDateRange(start, end) {
  // Return an inclusive array of all dates from start to end
  return d3.unixDay.range(start, d3.unixDay.offset(end, 1));
}

import * as d3 from "d3";

export function parseArray(d) {
  return {
    x: d3.isoParse(d[0]),
    o: d[1],
    h: d[2],
    l: d[3],
    c: d[4],
    v: d[5],
  };
}

export function parseVerboseObject(d) {
  return {
    x: d3.isoParse(d.date),
    o: d.open,
    h: d.high,
    l: d.low,
    c: d.close,
    v: d.volume,
  };
}

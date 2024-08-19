import * as d3 from "d3";

export function parseArrayOHLCV(d) {
  return {
    x: d3.isoParse(d[0]),
    o: d[1],
    h: d[2],
    l: d[3],
    c: d[4],
    v: d[5],
  };
}

export function parseVerboseOHLCV(d) {
  return {
    x: d3.isoParse(d.date),
    o: d.open,
    h: d.high,
    l: d.low,
    c: d.close,
    v: d.volume,
  };
}

export function parse3dArray(d) {
  return {
    x: d[0],
    y: d[1],
    z: d[2],
  };
}

export function parseTimeSeries3dArray(d) {
  return {
    x: d3.isoParse(d[0]),
    y: d[1],
    z: d[2],
  };
}

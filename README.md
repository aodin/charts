Charts
======

Modular [D3.js](https://d3js.org) charts. View a live demo at https://aodin.github.io/charts/.

Install with:

```
npm i @aodin/charts
```

Chart are designed as extensible classes with basic defaults. Extend the existing classes to alter behaviors.

```js
import * as d3 from "d3";
import { LineChart } from "@aodin/charts";

export class Example extends LineChart {
  // For example, to create a LineChart with its y-axis on the right...
  yAxis(g, y) {
    g.call(d3.axisRight(y));
  }
}
```

There are also pre-built files in `/dist/`. These charts expect an array of objects as the data parameter, e.g. `[{x, y, z}...]`, but a different parser can be specified as the second argument of the constructor.

```js
const data = [
  ["2020-01-01", 100, "A"],
  ["2020-02-01", 110, "A"],
  ["2020-03-01", 120, "A"],
  ["2020-04-01", 125, "A"],
  ["2020-05-01", 115, "A"],
  ["2020-06-01", 110, "A"],
];

export function parseArray(d) {
  return {
    x: d3.isoParse(d[0]),
    y: d[1],
    z: d[2],
  };
}

// If provided an SVG, it will attempt to use that element's width and height.
// Otherwise, an SVG element will be created underneath the provided selector.
charts.TimeSeries(data, parseArray).render("#element");
```

See [examples](/examples) for example line, area, bar, pie, and OHLCV candlestick charts.


### Development

Test with: `npm test`

Build `dist` files with: `npm run dist`

Happy hacking!

aodin, 2024

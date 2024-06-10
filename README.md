Charts
======

Modular [D3.js](https://d3js.org) charts.

Install with:

```
npm i @aodin/charts
```

Chart are designed as extensible classes with basic defaults. Extend the existing classes to alter behaviors.

```js
import { Line } from "@aodin/charts/line";

export class Example extends Line {
  // Parse an array of objects instead of an array of arrays
  parseX(data) {
    return d3.map(data.values, (d) => d3.isoParse(d.x));
  }

  parseY(data) {
    return d3.map(data.values, (d) => d.y);
  }

  parseZ(data) {
    return d3.map(data.values, (d) => d.z);
  }
}
```

There are also pre-built files in `/dist/`. These charts expect an array of arrays for data, e.g. `[[x, y, z]...]`. They can be called with:

```js
(new charts.Line(data)).render("#element");
```

See [examples](/examples) for example line, area, bar, and OHLCV candlestick charts. You can also view live demos at https://aodin.github.io/charts/


### Development

Build with:

```
npm run build
```

Happy hacking!

aodin, 2024
